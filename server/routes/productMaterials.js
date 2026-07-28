const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// Any authenticated user can read this: other tabs (Programação Geral, Distribuição,
// Consolidado MP, OP para Impressão) need the composição to compute kg per matéria-prima
// even if their profile can't edit the aba "cadastros". Editing happens via
// POST/PUT /api/products, which replaces the rows for a product atomically.
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT id, product_code, raw_material_code, percentual FROM product_materials ORDER BY product_code');
  res.json(rows);
});

module.exports = router;
