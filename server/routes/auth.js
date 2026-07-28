const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { signToken, requireAuth } = require('../auth');
const { TABS } = require('../constants');

const router = express.Router();

// Cadastro público: qualquer pessoa pode se cadastrar, mas cai com role
// 'pendente' (sem acesso a nenhuma aba) até um Administrador definir a
// função real em Usuários. Já retorna token pra cair direto na tela de
// aguardando aprovação, sem exigir login separado.
router.post('/register', async (req, res) => {
  const { username, password, name, phone, cpf, cep, rua, numero, bairro } = req.body || {};
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Usuário, senha e nome completo são obrigatórios.' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres.' });
  }
  if (!phone || !cpf || !cep || !rua || !numero || !bairro) {
    return res.status(400).json({ error: 'Preencha todos os dados de cadastro (telefone, CPF e endereço).' });
  }

  const cleanCpf = String(cpf).replace(/\D/g, '');
  if (cleanCpf.length !== 11) {
    return res.status(400).json({ error: 'CPF inválido — informe os 11 dígitos.' });
  }

  const { rows: existingUser } = await db.query('SELECT 1 FROM users WHERE lower(username) = lower($1)', [String(username).trim()]);
  if (existingUser[0]) return res.status(409).json({ error: 'Já existe um usuário com esse login.' });

  const { rows: existingCpf } = await db.query('SELECT 1 FROM users WHERE cpf = $1', [cleanCpf]);
  if (existingCpf[0]) return res.status(409).json({ error: 'Já existe um cadastro com esse CPF.' });

  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO users (id, username, password_hash, name, role, phone, cpf, cep, rua, numero, bairro)
     VALUES ($1, $2, $3, $4, 'pendente', $5, $6, $7, $8, $9, $10)`,
    [id, String(username).trim(), bcrypt.hashSync(String(password), 10), name.trim(), phone.trim(), cleanCpf, cep.trim(), rua.trim(), String(numero).trim(), bairro.trim()]
  );

  const user = { id, username: String(username).trim(), name: name.trim(), role: 'pendente' };
  const token = signToken(user);
  res.status(201).json({ token, user });
});

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
