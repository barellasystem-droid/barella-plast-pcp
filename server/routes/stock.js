const express = require('express');
const crypto = require('crypto');
const { XMLParser } = require('fast-xml-parser');
const db = require('../db');
const { requireAuth, requireView, requireEdit } = require('../auth');

const router = express.Router();
const TAB = 'estoque';

router.get('/movements', requireAuth, requireView(TAB), async (req, res) => {
  const { raw_material_code, product_code, limit } = req.query;
  const conditions = [];
  const params = [];
  if (raw_material_code) { params.push(raw_material_code); conditions.push(`raw_material_code = $${params.length}`); }
  if (product_code) { params.push(product_code); conditions.push(`product_code = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(Number(limit) || 200, 500));
  const { rows } = await db.query(
    `SELECT * FROM stock_movements ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  res.json(rows);
});

router.post('/entrada-manual', requireAuth, requireEdit(TAB), async (req, res) => {
  const { rawMaterialCode, quantidade, referencia, obs } = req.body || {};
  const qtd = Number(quantidade);
  if (!rawMaterialCode || !qtd || qtd <= 0) {
    return res.status(400).json({ error: 'Selecione a matéria-prima e informe uma quantidade maior que zero.' });
  }

  const { rows: existing } = await db.query('SELECT 1 FROM raw_materials WHERE code = $1', [rawMaterialCode]);
  if (!existing[0]) return res.status(404).json({ error: 'Matéria-prima não encontrada.' });

  await db.withTransaction(async (client) => {
    await client.query('UPDATE raw_materials SET estoque = estoque + $1 WHERE code = $2', [qtd, rawMaterialCode]);
    await client.query(
      `INSERT INTO stock_movements (id, tipo, raw_material_code, quantidade, referencia, obs, usuario)
       VALUES ($1, 'entrada_mp', $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), rawMaterialCode, qtd, referencia || '', obs || '', req.user.username]
    );
  });
  res.status(201).json({ ok: true });
});

/* ---------------- Entrada por Nota Fiscal (XML) ---------------- */

function asArray(x) { return x === undefined || x === null ? [] : (Array.isArray(x) ? x : [x]); }

// Leitura "melhor esforço" do layout padrão de NF-e (v4.00): aceita tanto
// <nfeProc><NFe><infNFe>... quanto <NFe><infNFe>... direto. Se a nota vier
// num layout muito diferente disso, cai no erro claro abaixo em vez de dar
// resultado errado — o lançamento manual continua funcionando como alternativa.
function extractNFe(xmlText) {
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  let parsed;
  try { parsed = parser.parse(xmlText); } catch (e) { throw new Error('Não foi possível ler esse arquivo como XML.'); }

  const nfe = parsed?.nfeProc?.NFe || parsed?.NFe;
  const infNFe = nfe?.infNFe;
  if (!infNFe) throw new Error('XML não parece ser uma NF-e (não encontrei a tag infNFe).');

  const nNF = infNFe?.ide?.nNF ?? '';
  const emitente = infNFe?.emit?.xNome ?? infNFe?.emit?.xFant ?? '';
  const dets = asArray(infNFe.det);
  const itens = dets
    .map(d => {
      const prod = d?.prod || {};
      return {
        cProd: String(prod.cProd ?? '').trim(),
        xProd: String(prod.xProd ?? '').trim(),
        uCom: String(prod.uCom ?? '').trim(),
        qCom: Number(prod.qCom) || 0,
      };
    })
    .filter(i => i.cProd || i.xProd);

  return { nNF: String(nNF), emitente: String(emitente), itens };
}

// Só lê e devolve uma prévia — não grava nada no banco ainda. O frontend
// mostra os itens (já casados por código, ou pra vincular na mão) e só
// depois de confirmado é que chama /nfe/confirmar.
router.post('/nfe/parse', requireAuth, requireEdit(TAB), async (req, res) => {
  const { xml } = req.body || {};
  if (!xml) return res.status(400).json({ error: 'Envie o conteúdo do arquivo XML.' });

  let parsed;
  try { parsed = extractNFe(xml); } catch (e) { return res.status(400).json({ error: e.message }); }
  if (!parsed.itens.length) return res.status(400).json({ error: 'Não encontrei itens de produto nessa nota.' });

  const { rows: materials } = await db.query('SELECT code FROM raw_materials');
  const byCode = Object.fromEntries(materials.map(m => [m.code.toLowerCase(), m.code]));

  const itens = parsed.itens.map(i => ({ ...i, rawMaterialCode: byCode[i.cProd.toLowerCase()] || null }));
  res.json({ nNF: parsed.nNF, emitente: parsed.emitente, itens });
});

router.post('/nfe/confirmar', requireAuth, requireEdit(TAB), async (req, res) => {
  const { referencia, itens } = req.body || {};
  const list = Array.isArray(itens) ? itens : [];
  const valid = list.filter(i => i && i.rawMaterialCode && Number(i.quantidade) > 0);
  if (!valid.length) {
    return res.status(400).json({ error: 'Nenhum item válido pra lançar — vincule uma matéria-prima e uma quantidade maior que zero em cada linha.' });
  }

  const { rows: materials } = await db.query('SELECT code FROM raw_materials');
  const known = new Set(materials.map(m => m.code));
  for (const i of valid) {
    if (!known.has(i.rawMaterialCode)) return res.status(400).json({ error: `Matéria-prima "${i.rawMaterialCode}" não encontrada.` });
  }

  await db.withTransaction(async (client) => {
    for (const i of valid) {
      const qtd = Number(i.quantidade);
      await client.query('UPDATE raw_materials SET estoque = estoque + $1 WHERE code = $2', [qtd, i.rawMaterialCode]);
      await client.query(
        `INSERT INTO stock_movements (id, tipo, raw_material_code, quantidade, referencia, obs, usuario)
         VALUES ($1, 'entrada_mp', $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), i.rawMaterialCode, qtd, referencia || '', i.xProd || '', req.user.username]
      );
    }
  });
  res.status(201).json({ ok: true, itens: valid.length });
});

module.exports = router;
