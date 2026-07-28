const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireEdit } = require('../auth');

const router = express.Router();
const TAB = 'injetoras';

// Any authenticated user can read this list: Cadastros (máquina padrão) e
// Distribuição Injetoras precisam dela para os combos mesmo sem poder editar esta aba.
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM injetoras ORDER BY nome');
  res.json(rows);
});

router.post('/', requireAuth, requireEdit(TAB), async (req, res) => {
  const { nome } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome da injetora é obrigatório.' });

  const id = crypto.randomUUID();
  await db.query('INSERT INTO injetoras (id, nome, ativa) VALUES ($1, $2, 1)', [id, nome.trim()]);
  res.status(201).json({ id, nome: nome.trim(), ativa: 1 });
});

// Ativar/inativar em vez de excluir: preserva o histórico de OPs de máquina e
// produtos que já referenciam o nome dessa injetora.
router.patch('/:id/active', requireAuth, requireEdit(TAB), async (req, res) => {
  const ativa = req.body?.active ? 1 : 0;
  await db.query('UPDATE injetoras SET ativa = $1 WHERE id = $2', [ativa, req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
