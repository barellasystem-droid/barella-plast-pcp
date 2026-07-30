const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireView, requireEdit, blockPending } = require('../auth');

const router = express.Router();
const TAB = 'programacaoGeral';

// Any authenticated (and approved) user can read this list: other tabs (Apontamento,
// Dashboard, Consolidado MP, Comparativos) need to join against it even if their
// profile can't see/edit this tab directly. Edit/delete below stays gated by requireEdit(TAB).
router.get('/', requireAuth, blockPending, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM orders_geral ORDER BY created_at');
  res.json(rows);
});

router.post('/', requireAuth, requireEdit(TAB), async (req, res) => {
  const o = req.body || {};
  if (!o.productCode || !o.qtdPlanejada) return res.status(400).json({ error: 'Produto e quantidade planejada são obrigatórios.' });

  const { rows: [{ nextval }] } = await db.query("SELECT nextval('orders_geral_seq')");
  const id = 'OG-' + String(nextval).padStart(5, '0');

  await db.query(
    `INSERT INTO orders_geral (id, date, priority, product_code, qtd_planejada, status, prazo, obs)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, o.date || '', o.priority || 'Média', o.productCode, Number(o.qtdPlanejada) || 0, o.status || 'Planejada', o.prazo || '', o.obs || '']
  );
  res.status(201).json({ id, ...o });
});

router.patch('/:id/status', requireAuth, requireEdit(TAB), async (req, res) => {
  await db.query('UPDATE orders_geral SET status = $1 WHERE id = $2', [req.body.status, req.params.id]);
  res.json({ ok: true });
});

router.put('/:id', requireAuth, requireEdit(TAB), async (req, res) => {
  const o = req.body || {};
  if (!o.productCode || !o.qtdPlanejada) return res.status(400).json({ error: 'Produto e quantidade planejada são obrigatórios.' });

  await db.query(
    `UPDATE orders_geral SET date=$1, priority=$2, product_code=$3, qtd_planejada=$4, prazo=$5, obs=$6 WHERE id=$7`,
    [o.date || '', o.priority || 'Média', o.productCode, Number(o.qtdPlanejada) || 0, o.prazo || '', o.obs || '', req.params.id]
  );
  res.json({ ok: true });
});

// Almoxarifado confirma que já entregou o material dessa OP no chão de
// fábrica: tira de Matéria Prima, põe em Em Processo (por matéria-prima,
// seguindo a composição do produto). Bloqueia se já tiver sido confirmado
// antes, e bloqueia (com erro claro) se faltar estoque de alguma matéria-prima.
router.patch('/:id/entregar-material', requireAuth, requireEdit(TAB), async (req, res) => {
  const { rows: ogRows } = await db.query('SELECT * FROM orders_geral WHERE id = $1', [req.params.id]);
  const og = ogRows[0];
  if (!og) return res.status(404).json({ error: 'OP Geral não encontrada.' });
  if (og.entregue_em) return res.status(409).json({ error: 'O material dessa OP já foi confirmado como entregue.' });

  const { rows: prodRows } = await db.query('SELECT peso FROM products WHERE code = $1', [og.product_code]);
  const peso = Number(prodRows[0]?.peso) || 0;
  const { rows: compRows } = await db.query('SELECT raw_material_code, percentual FROM product_materials WHERE product_code = $1', [og.product_code]);
  if (!compRows.length) return res.status(400).json({ error: 'Esse produto não tem composição de matéria-prima cadastrada.' });

  const kgTotal = (Number(og.qtd_planejada) || 0) * peso / 1000;
  const itens = compRows
    .map(c => ({ rawMaterialCode: c.raw_material_code, kg: kgTotal * (Number(c.percentual) || 0) / 100 }))
    .filter(i => i.kg > 0);
  if (!itens.length) return res.status(400).json({ error: 'Kg necessário calculado é zero — confira o peso do produto e a quantidade planejada.' });

  try {
    await db.withTransaction(async (client) => {
      for (const item of itens) {
        const { rows } = await client.query('SELECT estoque FROM raw_materials WHERE code = $1 FOR UPDATE', [item.rawMaterialCode]);
        const disponivel = rows[0] ? Number(rows[0].estoque) || 0 : 0;
        if (disponivel < item.kg) {
          throw Object.assign(
            new Error(`Estoque insuficiente de "${item.rawMaterialCode}": disponível ${disponivel.toFixed(2)} kg, necessário ${item.kg.toFixed(2)} kg.`),
            { status: 409 }
          );
        }
      }
      for (const item of itens) {
        await client.query(
          'UPDATE raw_materials SET estoque = estoque - $1, estoque_em_processo = estoque_em_processo + $1 WHERE code = $2',
          [item.kg, item.rawMaterialCode]
        );
        await client.query(
          `INSERT INTO stock_movements (id, tipo, raw_material_code, quantidade, referencia, usuario)
           VALUES ($1, 'transferencia_processo', $2, $3, $4, $5)`,
          [crypto.randomUUID(), item.rawMaterialCode, item.kg, og.id, req.user.username]
        );
      }
      await client.query('UPDATE orders_geral SET entregue_em = now(), entregue_por = $1 WHERE id = $2', [req.user.username, og.id]);
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  res.json({ ok: true });
});

// Desfaz a confirmação de entrega: devolve o material transferido de volta
// pra Matéria Prima e libera o botão "Confirmar entrega" de novo. Não mexe
// em nenhum apontamento que já tenha sido lançado depois — se isso deixar o
// "Em Processo" negativo, é um sinal real de descompasso, não escondo.
router.patch('/:id/desmarcar-entrega', requireAuth, requireEdit(TAB), async (req, res) => {
  const { rows: ogRows } = await db.query('SELECT * FROM orders_geral WHERE id = $1', [req.params.id]);
  const og = ogRows[0];
  if (!og) return res.status(404).json({ error: 'OP Geral não encontrada.' });
  if (!og.entregue_em) return res.status(409).json({ error: 'Essa OP ainda não teve material entregue.' });

  await db.withTransaction(async (client) => {
    const { rows: movs } = await client.query(
      `SELECT * FROM stock_movements WHERE referencia = $1 AND tipo = 'transferencia_processo'`,
      [og.id]
    );
    for (const m of movs) {
      await client.query(
        'UPDATE raw_materials SET estoque = estoque + $1, estoque_em_processo = estoque_em_processo - $1 WHERE code = $2',
        [m.quantidade, m.raw_material_code]
      );
    }
    await client.query(`DELETE FROM stock_movements WHERE referencia = $1 AND tipo = 'transferencia_processo'`, [og.id]);
    await client.query('UPDATE orders_geral SET entregue_em = NULL, entregue_por = NULL WHERE id = $1', [og.id]);
  });

  res.json({ ok: true });
});

router.delete('/:id', requireAuth, requireEdit(TAB), async (req, res) => {
  await db.query('DELETE FROM orders_geral WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
