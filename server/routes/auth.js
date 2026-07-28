const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../auth');
const { TABS } = require('../constants');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Informe usuário e senha.' });

  const { rows } = await db.query('SELECT * FROM users WHERE lower(username) = lower($1)', [String(username).trim()]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
});

// Returns the current user plus the full permission matrix for their role,
// so the frontend knows which tabs to show and whether each is editable.
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT tab_id, can_view, can_edit FROM permissions WHERE role = $1', [req.user.role]);
  const permissions = {};
  for (const tabId of TABS) permissions[tabId] = { view: false, edit: false };
  for (const r of rows) permissions[r.tab_id] = { view: !!r.can_view, edit: !!r.can_edit };
  res.json({ user: req.user, permissions });
});

module.exports = router;
