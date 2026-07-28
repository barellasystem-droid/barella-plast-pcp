const express = require('express');
const db = require('../db');
const { requireAuth, requireView, requireEdit } = require('../auth');

const router = express.Router();
const TAB = 'distribuicaoInjetoras';

// Any authenticated user can read this list: other tabs (Apontamento, Dashboard,
// Consolidado MP, Comparativos) need to join against it even if their profile
// can't see/edit this tab directly. Edit/delete below stays gated by requireEdit(TAB).
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM orders_maquina ORDER BY created_at');
  res.json(rows);
});

router.post('/', requireAuth, requireEdit(TAB), async (req, res) => {
  const o = req.body || {};
  if (!o.opGeralId || !o.qtdProgramada) return res.status(400).json({ error: 'OP geral e quantidade programada são obrigatórios.' });

  const { rows: [{ nextval }] } = await db.query("SELECT nextval('orders_maquina_seq')");
  const id = 'OM-' + String(nextval).padStart(5, '0');

  await db.query(
    `INSERT INTO orders_maquina (id, op_geral_id, date, injetora, qtd_programada, op1, op2, op3, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, o.opGeralId, o.date || '', o.injetora, Number(o.qtdProgramada) || 0, o.op1 || '', o.op2 || '', o.op3 || '', o.status || 'Planejada']
  );
  res.status(201).json({ id, ...o });
});

router.put('/:id', requireAuth, requireEdit(TAB), async (req, res) => {
  const o = req.body || {};
  if (!o.opGeralId || !o.qtdProgramada) return res.status(400).json({ error: 'OP geral e quantidade programada são obrigatórios.' });

  await db.query(
    `UPDATE orders_maquina SET op_geral_id=$1, date=$2, injetora=$3, qtd_programada=$4, op1=$5, op2=$6, op3=$7, status=$8 WHERE id=$9`,
    [o.opGeralId, o.date || '', o.injetora, Number(o.qtdProgramada) || 0, o.op1 || '', o.op2 || '', o.op3 || '', o.status || 'Planejada', req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, requireEdit(TAB), async (req, res) => {
  await db.query('DELETE FROM orders_maquina WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
