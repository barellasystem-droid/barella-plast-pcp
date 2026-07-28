const express = require('express');
require('express-async-errors'); // faz o Express 4 encaminhar erros de rotas `async` pro error handler abaixo, em vez de travar com uma resposta HTML genérica
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();

// Necessário na Vercel (e em qualquer ambiente atrás de proxy reverso) para
// o express-rate-limit conseguir ler o IP real do X-Forwarded-For.
app.set('trust proxy', 1);

app.use(helmet());

// O frontend é servido da mesma origem (mesmo domínio) tanto localmente quanto
// na Vercel, então CORS aberto não é necessário. ALLOWED_ORIGIN permite liberar
// uma origem extra quando fizer sentido (ex.: acessar a API a partir de outro domínio/app).
if (process.env.ALLOWED_ORIGIN) {
  app.use(cors({ origin: process.env.ALLOWED_ORIGIN.split(',').map(o => o.trim()) }));
}

app.use(express.json());

// Limita tentativas de login por IP para dificultar ataques de força bruta.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' },
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', loginLimiter);

// Cold start numa função serverless pode correr em paralelo com o
// CREATE TABLE IF NOT EXISTS de db.js — garante que o schema já existe
// antes de qualquer request tocar o banco.
app.use(async (req, res, next) => {
  try {
    await db.ready;
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/products', require('./routes/products'));
app.use('/api/product-materials', require('./routes/productMaterials'));
app.use('/api/operators', require('./routes/operators'));
app.use('/api/injetoras', require('./routes/injetoras'));
app.use('/api/raw-materials', require('./routes/rawMaterials'));
app.use('/api/orders-geral', require('./routes/ordersGeral'));
app.use('/api/orders-maquina', require('./routes/ordersMaquina'));
app.use('/api/apontamentos', require('./routes/apontamentos'));

// Error handler final: qualquer erro não tratado (inclusive vindo de rotas
// async, graças ao express-async-errors) cai aqui em vez de virar uma
// página HTML genérica que o frontend não consegue interpretar como JSON.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Erro interno do servidor. Tente novamente em instantes.' });
});

module.exports = app;
