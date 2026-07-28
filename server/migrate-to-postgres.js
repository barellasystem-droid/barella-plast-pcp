// Script único: lê os dados reais do SQLite local (data/barella.db) e insere
// no Postgres (Supabase) apontado por DATABASE_URL. Rode uma vez, localmente,
// depois de configurar o projeto no Supabase e antes do primeiro deploy.
//
// Uso (PowerShell):
//   $env:DATABASE_URL = "postgresql://...supabase connection string (Transaction pooler)..."
//   node server/migrate-to-postgres.js
//
// Usa sql.js (SQLite compilado para WebAssembly, puro JS) em vez de
// better-sqlite3 para ler o arquivo antigo — não precisa compilar nada
// (sem Python/Visual Studio), só ler bytes e rodar queries em memória.
//
// É seguro rodar mais de uma vez: cada INSERT usa ON CONFLICT DO NOTHING, então
// linhas já migradas não são duplicadas nem sobrescritas.

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const db = require('./db'); // Postgres (pg) — ver server/db.js

const SQLITE_PATH = path.join(__dirname, '..', 'data', 'barella.db');

function readAllRows(sqlite, table) {
  let stmt;
  try {
    stmt = sqlite.prepare(`SELECT * FROM ${table}`);
  } catch (err) {
    if (String(err.message).includes('no such table')) return null; // tabela não existe nesse banco (schema mais antigo)
    throw err;
  }
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function copyTable(sqlite, table, columns, conflictCols) {
  const rows = readAllRows(sqlite, table);
  if (rows === null) {
    console.log(`  ${table}: tabela não existe nesse banco SQLite (schema mais antigo) — pulando.`);
    return 0;
  }
  if (rows.length === 0) {
    console.log(`  ${table}: nada para migrar (0 linhas no SQLite).`);
    return 0;
  }

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
               ON CONFLICT (${conflictCols.join(', ')}) DO NOTHING`;

  let inserted = 0;
  for (const row of rows) {
    const values = columns.map((c) => row[c]);
    const result = await db.query(sql, values);
    inserted += result.rowCount;
  }
  console.log(`  ${table}: ${inserted}/${rows.length} linha(s) inserida(s) (${rows.length - inserted} já existiam).`);
  return inserted;
}

// Ajusta a sequence (usada para gerar novos IDs OG-xxxxx/OM-xxxxx/AP-xxxxx) para
// começar depois do maior número já usado nos dados migrados, evitando colisão.
async function bumpSequence(seqName, table) {
  const { rows } = await db.query(`SELECT id FROM ${table}`);
  let max = 0;
  for (const r of rows) {
    const n = parseInt(String(r.id).split('-')[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  if (max > 0) {
    await db.query(`SELECT setval($1, $2)`, [seqName, max]);
    console.log(`  ${seqName} ajustada para começar em ${max + 1}.`);
  }
}

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    throw new Error(`Arquivo SQLite não encontrado em ${SQLITE_PATH}.`);
  }

  await db.ready; // garante que o schema do Postgres já foi criado

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(SQLITE_PATH);
  const sqlite = new SQL.Database(fileBuffer);

  console.log('Migrando dados do SQLite para o Postgres...\n');

  await copyTable(sqlite, 'users', ['id', 'username', 'password_hash', 'name', 'role', 'created_at'], ['id']);
  await copyTable(sqlite, 'permissions', ['tab_id', 'role', 'can_view', 'can_edit'], ['tab_id', 'role']);
  await copyTable(sqlite, 'products', ['code', 'name', 'molde', 'maquina', 'prod_dia', 'peso', 'virgem', 'moido', 'pigmento', 'cavidades'], ['code']);
  await copyTable(sqlite, 'raw_materials', ['code', 'descricao', 'fornecedor', 'tipo', 'unidade', 'estoque'], ['code']);
  await copyTable(sqlite, 'product_materials', ['id', 'product_code', 'raw_material_code', 'percentual', 'created_at'], ['id']);
  await copyTable(sqlite, 'operators', ['id', 'name', 'active', 'created_at'], ['id']);
  await copyTable(sqlite, 'injetoras', ['id', 'nome', 'ativa', 'created_at'], ['id']);
  await copyTable(sqlite, 'orders_geral', ['id', 'date', 'priority', 'product_code', 'qtd_planejada', 'status', 'prazo', 'obs', 'created_at'], ['id']);
  await copyTable(sqlite, 'orders_maquina', ['id', 'op_geral_id', 'date', 'injetora', 'qtd_programada', 'op1', 'op2', 'op3', 'status', 'created_at'], ['id']);
  await copyTable(sqlite, 'apontamentos', ['id', 'op_maquina_id', 'date', 'turno', 'qtd_produzida', 'refugo', 'hora_inicio', 'hora_fim', 'parada', 'motivo', 'obs', 'operador', 'created_at'], ['id']);

  console.log('\nAjustando sequences de ID...');
  await bumpSequence('orders_geral_seq', 'orders_geral');
  await bumpSequence('orders_maquina_seq', 'orders_maquina');
  await bumpSequence('apontamentos_seq', 'apontamentos');

  sqlite.close();
  await db.pool.end();
  console.log('\nMigração concluída.');
}

main().catch((err) => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
