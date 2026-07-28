const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./db');
const { TABS, DEFAULT_PERMISSIONS, SEED_USERS, SEED_PRODUCTS, SEED_RAW, SEED_PRODUCT_MATERIALS, SEED_INJETORAS } = require('./constants');

async function seed() {
  await db.ready;

  const { rows: [{ c: userCount }] } = await db.query('SELECT COUNT(*) AS c FROM users');
  if (Number(userCount) === 0) {
    for (const u of SEED_USERS) {
      await db.query(
        'INSERT INTO users (id, username, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)',
        [u.id, u.username, bcrypt.hashSync(u.password, 10), u.name, u.role]
      );
    }
    console.log(`Usuários de demonstração criados (${SEED_USERS.length}). Senhas: ver README.md`);
  }

  // ON CONFLICT DO NOTHING: preenche qualquer combinação [aba, perfil] que ainda
  // não exista (ex.: uma aba nova adicionada depois que o banco já estava em uso),
  // sem sobrescrever permissões que o administrador já tenha ajustado pela tela.
  let permAdded = 0;
  for (const tabId of TABS) {
    const cfg = DEFAULT_PERMISSIONS[tabId];
    for (const role of ['admin', 'pcp', 'operador', 'almoxarifado', 'qualidade', 'gerencia']) {
      const result = await db.query(
        `INSERT INTO permissions (tab_id, role, can_view, can_edit) VALUES ($1, $2, $3, $4)
         ON CONFLICT (tab_id, role) DO NOTHING`,
        [tabId, role, cfg.view.includes(role) ? 1 : 0, cfg.edit.includes(role) ? 1 : 0]
      );
      permAdded += result.rowCount;
    }
  }
  if (permAdded > 0) console.log(`Matriz de permissões: ${permAdded} combinação(ões) aba/perfil adicionada(s).`);

  const { rows: [{ c: prodCount }] } = await db.query('SELECT COUNT(*) AS c FROM products');
  if (Number(prodCount) === 0) {
    for (const p of SEED_PRODUCTS) {
      await db.query(
        `INSERT INTO products (code, name, molde, maquina, prod_dia, peso, virgem, moido, pigmento, cavidades)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [p.code, p.name, p.molde, p.maquina, p.prodDia, p.peso, p.virgem, p.moido, p.pigmento, p.cavidades]
      );
    }
    console.log(`Produtos de demonstração criados (${SEED_PRODUCTS.length}).`);
  }

  const { rows: [{ c: rawCount }] } = await db.query('SELECT COUNT(*) AS c FROM raw_materials');
  if (Number(rawCount) === 0) {
    for (const r of SEED_RAW) {
      await db.query(
        `INSERT INTO raw_materials (code, descricao, fornecedor, tipo, unidade, estoque)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [r.code, r.descricao, r.fornecedor, r.tipo, r.unidade, r.estoque]
      );
    }
    console.log(`Matérias-primas de demonstração criadas (${SEED_RAW.length}).`);
  }

  const { rows: [{ c: pmCount }] } = await db.query('SELECT COUNT(*) AS c FROM product_materials');
  if (Number(pmCount) === 0) {
    for (const m of SEED_PRODUCT_MATERIALS) {
      await db.query(
        `INSERT INTO product_materials (id, product_code, raw_material_code, percentual)
         VALUES ($1, $2, $3, $4)`,
        [crypto.randomUUID(), m.productCode, m.rawMaterialCode, m.percentual]
      );
    }
    console.log(`Composição de matéria-prima dos produtos de demonstração criada (${SEED_PRODUCT_MATERIALS.length} itens).`);
  }

  const { rows: [{ c: injCount }] } = await db.query('SELECT COUNT(*) AS c FROM injetoras');
  if (Number(injCount) === 0) {
    for (const inj of SEED_INJETORAS) {
      await db.query('INSERT INTO injetoras (id, nome, ativa) VALUES ($1, $2, 1)', [crypto.randomUUID(), inj.nome]);
    }
    console.log(`Injetoras de demonstração criadas (${SEED_INJETORAS.length}).`);
  }

  console.log('Seed concluído.');
  await db.pool.end();
}

seed().catch((err) => {
  console.error('Erro ao rodar o seed:', err);
  process.exit(1);
});
