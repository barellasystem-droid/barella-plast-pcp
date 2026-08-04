const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireEdit, blockPending } = require('../auth');

const router = express.Router();
const TAB = 'fornecedores';

// Qualquer usuário autenticado (e aprovado) pode ler essa lista: a aba
// Expedição depende dela pro combo de fornecedor mesmo que o perfil não tenha
// acesso à aba Fornecedores em si. Edição continua travada por requireEdit(TAB).
router.get('/', requireAuth, blockPending, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM fornecedores ORDER BY nome');
  res.json(rows);
});

router.post('/', requireAuth, requireEdit(TAB), async (req, res) => {
  const { nome } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome do fornecedor é obrigatório.' });

  const id = crypto.randomUUID();
  await db.query('INSERT INTO fornecedores (id, nome, ativo) VALUES ($1, $2, 1)', [id, nome.trim()]);
  res.status(201).json({ id, nome: nome.trim(), ativo: 1 });
});

router.put('/:id', requireAuth, requireEdit(TAB), async (req, res) => {
  const { nome } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome do fornecedor é obrigatório.' });
  await db.query('UPDATE fornecedores SET nome = $1 WHERE id = $2', [nome.trim(), req.params.id]);
  res.json({ ok: true });
});

// Ativar/inativar em vez de excluir: preserva o histórico de romaneios que já
// referenciam esse fornecedor.
router.patch('/:id/active', requireAuth, requireEdit(TAB), async (req, res) => {
  const ativo = req.body?.active ? 1 : 0;
  await db.query('UPDATE fornecedores SET ativo = $1 WHERE id = $2', [ativo, req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
