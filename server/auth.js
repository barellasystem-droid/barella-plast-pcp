const jwt = require('jsonwebtoken');
const db = require('./db');

// Em produção o servidor recusa iniciar sem um JWT_SECRET de verdade definido
// como variável de ambiente (evita cair no valor padrão inseguro em silêncio).
// Fora de produção, mantém um fallback para facilitar o dia a dia de desenvolvimento.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error(
    'ERRO FATAL: a variável de ambiente JWT_SECRET não está definida.\n' +
    'Defina um valor longo e aleatório antes de rodar em produção, por exemplo:\n' +
    '  set JWT_SECRET=um-valor-bem-longo-e-aleatorio   (Windows)\n' +
    '  export JWT_SECRET=um-valor-bem-longo-e-aleatorio (Linux/macOS)'
  );
}
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-before-real-deployment';
if (!process.env.JWT_SECRET) {
  console.warn('AVISO: JWT_SECRET não definido — usando valor padrão de desenvolvimento. Não use isso em produção.');
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '12h' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

async function getPermission(tabId, role) {
  const { rows } = await db.query('SELECT can_view, can_edit FROM permissions WHERE tab_id = $1 AND role = $2', [tabId, role]);
  return rows[0];
}

// Bloqueia quem está com cadastro pendente de aprovação (role 'pendente') de
// rotas que hoje são "qualquer usuário autenticado pode ler" — sem isso, uma
// conta recém-cadastrada pela internet (ainda não vetada por um Administrador)
// conseguiria ler dados de produção direto pela API, mesmo sem ver nada na tela.
function blockPending(req, res, next) {
  if (req.user.role === 'pendente') {
    return res.status(403).json({ error: 'Seu cadastro ainda não foi aprovado por um Administrador.' });
  }
  next();
}

// Middleware factory: requires the logged-in user's role to have VIEW access to tabId
function requireView(tabId) {
  return async (req, res, next) => {
    const perm = await getPermission(tabId, req.user.role);
    if (!perm || !perm.can_view) return res.status(403).json({ error: `Seu perfil não tem acesso à aba "${tabId}".` });
    next();
  };
}

// Middleware factory: requires the logged-in user's role to have EDIT access to tabId
function requireEdit(tabId) {
  return async (req, res, next) => {
    const perm = await getPermission(tabId, req.user.role);
    if (!perm || !perm.can_edit) return res.status(403).json({ error: `Seu perfil não pode editar a aba "${tabId}".` });
    next();
  };
}

module.exports = { signToken, requireAuth, requireView, requireEdit, blockPending, getPermission, JWT_SECRET };
