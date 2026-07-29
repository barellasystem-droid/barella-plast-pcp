const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireView, requireEdit, blockPending } = require('../auth');

const router = express.Router();
const TAB = 'apontamento';

// Any authenticated (and approved) user can read this list: other tabs (Apontamento,
// Dashboard, Consolidado MP, Comparativos) need to join against it even if their
// profile can't see/edit this tab directly. Edit/delete below stays gated by requireEdit(TAB).
router.get('/', requireAuth, blockPending, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM apontamentos ORDER BY created_at');
  res.json(rows);
});

function isBlank(v) { return v === undefined || v === null || v === ''; }

router.post('/', requireAuth, requireEdit(TAB), async (req, res) => {
  const a = req.body || {};
  if (!a.opMaquinaId) return res.status(400).json({ error: 'Selecione a OP de máquina.' });
  if (isBlank(a.qtdProduzida)) return res.status(400).json({ error: 'Quantidade produzida é obrigatória.' });
  if (isBlank(a.refugo)) return res.status(400).json({ error: 'Refugo é obrigatório.' });
  if (isBlank(a.horaInicio)) return res.status(400).json({ error: 'Hora início é obrigatória.' });
  if (isBlank(a.horaFim)) return res.status(400).json({ error: 'Hora fim é obrigatória.' });

  const { rows: [{ nextval }] } = await db.query("SELECT nextval('apontamentos_seq')");
  const id = 'AP-' + String(nextval).padStart(5, '0');
  const operador = a.operador || '';
  const qtdProduzida = Number(a.qtdProduzida) || 0;
  const refugo = Number(a.refugo) || 0;
  const qtdBoa = Math.max(qtdProduzida - refugo, 0);

  // Descobre produto/composição da OP de máquina apontada, pra debitar Em
  // Processo (matéria-prima) e creditar Produto Acabado (peças boas).
  const { rows: omRows } = await db.query('SELECT * FROM orders_maquina WHERE id = $1', [a.opMaquinaId]);
  const om = omRows[0];
  let productCode = null;
  let materiais = [];
  if (om) {
    const { rows: ogRows } = await db.query('SELECT product_code FROM orders_geral WHERE id = $1', [om.op_geral_id]);
    productCode = ogRows[0]?.product_code || null;
    if (productCode) {
      const { rows: prodRows } = await db.query('SELECT peso FROM products WHERE code = $1', [productCode]);
      const kgConsumido = qtdProduzida * (Number(prodRows[0]?.peso) || 0) / 1000;
      const { rows: compRows } = await db.query('SELECT raw_material_code, percentual FROM product_materials WHERE product_code = $1', [productCode]);
      materiais = compRows
        .map(c => ({ rawMaterialCode: c.raw_material_code, kg: kgConsumido * (Number(c.percentual) || 0) / 100 }))
        .filter(m => m.kg > 0);
    }
  }

  await db.withTransaction(async (client) => {
    await client.query(
      `INSERT INTO apontamentos (id, op_maquina_id, date, turno, qtd_produzida, refugo, hora_inicio, hora_fim, parada, motivo, obs, operador)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, a.opMaquinaId, a.date || '', a.turno, qtdProduzida, refugo, a.horaInicio || '', a.horaFim || '', Number(a.parada) || 0, a.motivo || '', a.obs || '', operador]
    );

    // Desconta de Em Processo (pode ficar negativo — sinaliza que a entrega
    // registrada não bateu com o que foi realmente consumido, não escondo isso).
    for (const m of materiais) {
      await client.query('UPDATE raw_materials SET estoque_em_processo = estoque_em_processo - $1 WHERE code = $2', [m.kg, m.rawMaterialCode]);
      await client.query(
        `INSERT INTO stock_movements (id, tipo, raw_material_code, quantidade, referencia, usuario)
         VALUES ($1, 'consumo_processo', $2, $3, $4, $5)`,
        [crypto.randomUUID(), m.rawMaterialCode, m.kg, id, req.user.username]
      );
    }
    if (productCode && qtdBoa > 0) {
      await client.query('UPDATE products SET estoque_pa = estoque_pa + $1 WHERE code = $2', [qtdBoa, productCode]);
      await client.query(
        `INSERT INTO stock_movements (id, tipo, product_code, quantidade, referencia, usuario)
         VALUES ($1, 'entrada_pa', $2, $3, $4, $5)`,
        [crypto.randomUUID(), productCode, qtdBoa, id, req.user.username]
      );
    }
  });

  res.status(201).json({ id, ...a, operador });
});

// Apagar um apontamento reverte os efeitos de estoque que ele gerou (devolve
// o kg pra Em Processo, tira as peças de Produto Acabado) — senão corrigir um
// lançamento errado deixaria os 3 estoques desalinhados pra sempre.
router.delete('/:id', requireAuth, requireEdit(TAB), async (req, res) => {
  await db.withTransaction(async (client) => {
    const { rows: movs } = await client.query(
      `SELECT * FROM stock_movements WHERE referencia = $1 AND tipo IN ('consumo_processo', 'entrada_pa')`,
      [req.params.id]
    );
    for (const m of movs) {
      if (m.tipo === 'consumo_processo' && m.raw_material_code) {
        await client.query('UPDATE raw_materials SET estoque_em_processo = estoque_em_processo + $1 WHERE code = $2', [m.quantidade, m.raw_material_code]);
      } else if (m.tipo === 'entrada_pa' && m.product_code) {
        await client.query('UPDATE products SET estoque_pa = estoque_pa - $1 WHERE code = $2', [m.quantidade, m.product_code]);
      }
    }
    await client.query(`DELETE FROM stock_movements WHERE referencia = $1 AND tipo IN ('consumo_processo', 'entrada_pa')`, [req.params.id]);
    await client.query('DELETE FROM apontamentos WHERE id = $1', [req.params.id]);
  });
  res.json({ ok: true });
});

module.exports = router;
