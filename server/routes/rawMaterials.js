const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireView, requireEdit, blockPending } = require('../auth');

const router = express.Router();
const TAB = 'materiasPrimas';

// Any authenticated (and approved) user can read this list: other tabs (Apontamento,
// Dashboard, Consolidado MP, Comparativos) need to join against it even if their
// profile can't see/edit this tab directly. Edit/delete below stays gated by requireEdit(TAB).
router.get('/', requireAuth, blockPending, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM raw_materials ORDER BY code');
  res.json(rows);
});

router.post('/', requireAuth, requireEdit(TAB), async (req, res) => {
  const r = req.body || {};
  if (!r.code || !r.descricao) return res.status(400).json({ error: 'Código e descrição são obrigatórios.' });
  const { rows: existing } = await db.query('SELECT 1 FROM raw_materials WHERE code = $1', [r.code]);
  if (existing[0]) return res.status(409).json({ error: 'Já existe uma matéria-prima com esse código.' });

  await db.query(
    `INSERT INTO raw_materials (code, descricao, fornecedor, tipo, unidade, estoque)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [r.code, r.descricao, r.fornecedor || '', r.tipo || 'Virgem', r.unidade || 'kg', Number(r.estoque) || 0]
  );
  res.status(201).json(r);
});

// Corrigir o estoque na mão aqui continua permitido (contagem de inventário
// etc.), mas agora toda diferença vira um registro em stock_movements — dá
// pra auditar depois quem mudou o número e quando.
router.put('/:code', requireAuth, requireEdit(TAB), async (req, res) => {
  const r = req.body || {};
  if (!r.descricao) return res.status(400).json({ error: 'Descrição é obrigatória.' });

  const { rows: currentRows } = await db.query('SELECT estoque FROM raw_materials WHERE code = $1', [req.params.code]);
  const before = currentRows[0] ? Number(currentRows[0].estoque) || 0 : 0;
  const after = Number(r.estoque) || 0;
  const delta = after - before;

  await db.withTransaction(async (client) => {
    await client.query(
      `UPDATE raw_materials SET descricao=$1, fornecedor=$2, tipo=$3, unidade=$4, estoque=$5 WHERE code=$6`,
      [r.descricao, r.fornecedor || '', r.tipo || 'Virgem', r.unidade || 'kg', after, req.params.code]
    );
    if (delta !== 0) {
      await client.query(
        `INSERT INTO stock_movements (id, tipo, raw_material_code, quantidade, obs, usuario)
         VALUES ($1, 'ajuste_mp', $2, $3, $4, $5)`,
        [crypto.randomUUID(), req.params.code, delta, 'Ajuste manual via cadastro de matérias-primas', req.user.username]
      );
    }
  });
  res.json({ ok: true });
});

router.delete('/:code', requireAuth, requireEdit(TAB), async (req, res) => {
  await db.query('DELETE FROM raw_materials WHERE code = $1', [req.params.code]);
  res.json({ ok: true });
});

module.exports = router;
