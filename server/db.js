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

    -- Cadastro público (auto-registro): dados de perfil além de login/senha.
    -- ADD COLUMN IF NOT EXISTS porque users já existe em produção com dados reais.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS cep TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS rua TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS numero TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bairro TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf ON users(cpf) WHERE cpf IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(lower(email)) WHERE email IS NOT NULL;

    -- Módulo de estoque: Matéria Prima (raw_materials.estoque, já existia),
    -- Em Processo e Produto Acabado, mais o carimbo de entrega de material por OP.
    ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS estoque_em_processo REAL DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS estoque_pa REAL DEFAULT 0;
    ALTER TABLE orders_geral ADD COLUMN IF NOT EXISTS entregue_em TIMESTAMPTZ;
    ALTER TABLE orders_geral ADD COLUMN IF NOT EXISTS entregue_por TEXT;

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      raw_material_code TEXT,
      product_code TEXT,
      quantidade REAL NOT NULL,
      referencia TEXT,
      obs TEXT,
      usuario TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_stock_movements_rawmat ON stock_movements(raw_material_code);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_code);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);

    ALTER TABLE operators ADD COLUMN IF NOT EXISTS turno TEXT;
    ALTER TABLE operators ADD COLUMN IF NOT EXISTS funcao TEXT;

    -- Expedição: cadastro de fornecedor + romaneio (cabeçalho + itens de
    -- produto acabado). Finalizar um romaneio debita estoque_pa (pode ficar
    -- negativo, mesma lógica já usada em estoque_em_processo); reabrir reverte.
    CREATE TABLE IF NOT EXISTS fornecedores (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS romaneios (
      id TEXT PRIMARY KEY,
      supplier_id TEXT,
      date TEXT,
      caminhao TEXT,
      motorista TEXT,
      assinatura TEXT,
      status TEXT NOT NULL DEFAULT 'aberto',
      finalizado_em TIMESTAMPTZ,
      finalizado_por TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE SEQUENCE IF NOT EXISTS romaneios_seq;

    CREATE TABLE IF NOT EXISTS romaneio_itens (
      id TEXT PRIMARY KEY,
      romaneio_id TEXT NOT NULL REFERENCES romaneios(id) ON DELETE CASCADE,
      product_code TEXT NOT NULL,
      quantidade REAL NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_romaneio_itens_romaneio ON romaneio_itens(romaneio_id);
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
