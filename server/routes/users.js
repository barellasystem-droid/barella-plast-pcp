const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireView, requireEdit } = require('../auth');
const { ROLES } = require('../constants');

const router = express.Router();

router.get('/', requireAuth, requireView('usuarios'), async (req, res) => {
  const { rows } = await db.query('SELECT id, username, name, role, created_at FROM users ORDER BY created_at');
  res.json(rows);
});

router.post('/', requireAuth, requireEdit('usuarios'), async (req, res) => {
  const { username, password, name, role } = req.body || {};
  if (!username || !password || !name || !role) return res.status(400).json({ error: 'Preencha todos os campos.' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Perfil inválido.' });
  if (String(password).length < 8) return res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres.' });

  const { rows: existing } = await db.query('SELECT 1 FROM users WHERE lower(username) = lower($1)', [username]);
  if (existing[0]) return res.status(409).json({ error: 'Já existe um usuário com esse login.' });

  const id = crypto.randomUUID();
  await db.query(
    'INSERT INTO users (id, username, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)',
    [id, username.trim(), bcrypt.hashSync(String(password), 10), name.trim(), role]
  );

  res.status(201).json({ id, username, name, role });
});

router.delete('/:id', requireAuth, requireEdit('usuarios'), async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Você não pode remover seu próprio usuário.' });
  await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
