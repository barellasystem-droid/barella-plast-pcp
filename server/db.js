const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não definida. Configure a connection string do Postgres (Supabase) antes de iniciar.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS permissions (
      tab_id TEXT NOT NULL,
      role TEXT NOT NULL,
      can_view INTEGER NOT NULL DEFAULT 0,
      can_edit INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (tab_id, role)
    );

    CREATE TABLE IF NOT EXISTS products (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      molde TEXT,
      maquina TEXT,
      prod_dia REAL,
      peso REAL,
      virgem REAL,
      moido REAL,
      pigmento REAL,
      cavidades INTEGER
    );

    CREATE TABLE IF NOT EXISTS raw_materials (
      code TEXT PRIMARY KEY,
      descricao TEXT NOT NULL,
      fornecedor TEXT,
      tipo TEXT,
      unidade TEXT DEFAULT 'kg',
      estoque REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS product_materials (
      id TEXT PRIMARY KEY,
      product_code TEXT NOT NULL,
      raw_material_code TEXT NOT NULL,
      percentual REAL NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_product_materials_product ON product_materials(product_code);

    CREATE TABLE IF NOT EXISTS operators (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS injetoras (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      ativa INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS orders_geral (
      id TEXT PRIMARY KEY,
      date TEXT,
      priority TEXT,
      product_code TEXT,
      qtd_planejada REAL,
      status TEXT DEFAULT 'Planejada',
      prazo TEXT,
      obs TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS orders_maquina (
      id TEXT PRIMARY KEY,
      op_geral_id TEXT,
      date TEXT,
      injetora TEXT,
      qtd_programada REAL,
      op1 TEXT,
      op2 TEXT,
      op3 TEXT,
      status TEXT DEFAULT 'Planejada',
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS apontamentos (
      id TEXT PRIMARY KEY,
      op_maquina_id TEXT,
      date TEXT,
      turno TEXT,
      qtd_produzida REAL,
      refugo REAL,
      hora_inicio TEXT,
      hora_fim TEXT,
      parada REAL,
      motivo TEXT,
      obs TEXT,
      operador TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE SEQUENCE IF NOT EXISTS orders_geral_seq;
    CREATE SEQUENCE IF NOT EXISTS orders_maquina_seq;
    CREATE SEQUENCE IF NOT EXISTS apontamentos_seq;
  `);
}

// Roda uma vez por cold start (o módulo fica em cache); todo lugar que usa o
// pool aguarda essa promise antes da primeira consulta (ver server/app.js).
const ready = init();

// Executa uma função dentro de uma transação, usando uma única conexão do
// pool — necessário para o replaceMaterials de routes/products.js, que faz
// DELETE + vários INSERT que precisam ser tudo ou nada.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, ready, query: (text, params) => pool.query(text, params), withTransaction };
