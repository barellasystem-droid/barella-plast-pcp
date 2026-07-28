const express = require('express');
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

router.delete('/:id', requireAuth, requireEdit(TAB), async (req, res) => {
  await db.query('DELETE FROM orders_geral WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
