const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireEdit, blockPending } = require('../auth');

const router = express.Router();
const TAB = 'operadores';

// Any authenticated (and approved) user can read this list: Distribuição Injetoras
// needs the active operators for its dropdowns even if their profile can't edit this aba.
router.get('/', requireAuth, blockPending, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM operators ORDER BY name');
  res.json(rows);
});

router.post('/', requireAuth, requireEdit(TAB), async (req, res) => {
  const { name, turno, funcao } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nome do operador é obrigatório.' });

  const id = crypto.randomUUID();
  await db.query(
    'INSERT INTO operators (id, name, active, turno, funcao) VALUES ($1, $2, 1, $3, $4)',
    [id, name.trim(), turno || '', funcao || '']
  );
  res.status(201).json({ id, name: name.trim(), active: 1, turno: turno || '', funcao: funcao || '' });
});

// Só corrige o cadastro para daqui pra frente — OPs de máquina e apontamentos
// já lançados guardam o nome como estava no momento, não são retroativamente alterados.
router.put('/:id', requireAuth, requireEdit(TAB), async (req, res) => {
  const { name, turno, funcao } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nome do operador é obrigatório.' });
  await db.query(
    'UPDATE operators SET name = $1, turno = $2, funcao = $3 WHERE id = $4',
    [name.trim(), turno || '', funcao || '', req.params.id]
  );
  res.json({ ok: true });
});

// Ativar/inativar em vez de excluir: preserva o nome já gravado nas OPs de
// máquina e apontamentos existentes (desligamento ou mudança de setor).
router.patch('/:id/active', requireAuth, requireEdit(TAB), async (req, res) => {
  const active = req.body?.active ? 1 : 0;
  await db.query('UPDATE operators SET active = $1 WHERE id = $2', [active, req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
