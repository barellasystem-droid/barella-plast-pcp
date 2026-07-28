const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireView, requireEdit } = require('../auth');

const router = express.Router();
const TAB = 'cadastros';

// Any authenticated user can read this list: other tabs (Apontamento, Dashboard,
// Consolidado MP, Comparativos) need to join against it even if their profile
// can't see/edit this tab directly. Edit/delete below stays gated by requireEdit(TAB).
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM products ORDER BY code');
  res.json(rows);
});

// Replaces every product_materials row for a product with the given list —
// the composição is edited as a whole list from the frontend, not row by row.
async function replaceMaterials(productCode, materials) {
  await db.withTransaction(async (client) => {
    await client.query('DELETE FROM product_materials WHERE product_code = $1', [productCode]);
    for (const m of materials) {
      if (!m || !m.rawMaterialCode) continue;
      await client.query(
        `INSERT INTO product_materials (id, product_code, raw_material_code, percentual)
         VALUES ($1, $2, $3, $4)`,
        [crypto.randomUUID(), productCode, m.rawMaterialCode, Number(m.percentual) || 0]
      );
    }
  });
}

router.post('/', requireAuth, requireEdit(TAB), async (req, res) => {
  const p = req.body || {};
  if (!p.code || !p.name) return res.status(400).json({ error: 'Código e nome do produto são obrigatórios.' });
  const { rows: existing } = await db.query('SELECT 1 FROM products WHERE code = $1', [p.code]);
  if (existing[0]) return res.status(409).json({ error: 'Já existe um produto com esse código.' });

  await db.query(
    `INSERT INTO products (code, name, molde, maquina, prod_dia, peso, cavidades)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [p.code, p.name, p.molde || '', p.maquina || '', Number(p.prodDia) || 0, Number(p.peso) || 0, Number(p.cavidades) || 0]
  );
  await replaceMaterials(p.code, Array.isArray(p.materials) ? p.materials : []);
  res.status(201).json(p);
});

router.put('/:code', requireAuth, requireEdit(TAB), async (req, res) => {
  const p = req.body || {};
  await db.query(
    `UPDATE products SET name=$1, molde=$2, maquina=$3, prod_dia=$4, peso=$5, cavidades=$6 WHERE code=$7`,
    [p.name, p.molde || '', p.maquina || '', Number(p.prodDia) || 0, Number(p.peso) || 0, Number(p.cavidades) || 0, req.params.code]
  );
  await replaceMaterials(req.params.code, Array.isArray(p.materials) ? p.materials : []);
  res.json({ ok: true });
});

router.delete('/:code', requireAuth, requireEdit(TAB), async (req, res) => {
  await db.query('DELETE FROM product_materials WHERE product_code = $1', [req.params.code]);
  await db.query('DELETE FROM products WHERE code = $1', [req.params.code]);
  res.json({ ok: true });
});

module.exports = router;
