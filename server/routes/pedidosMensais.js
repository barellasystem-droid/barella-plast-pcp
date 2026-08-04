const express = require('express');
const crypto = require('crypto');
const XLSX = require('xlsx');
const db = require('../db');
const { requireAuth, requireView, requireEdit } = require('../auth');

const router = express.Router();
const TAB = 'pedidoMensal';

// Lista o mês/ano pedido, de todos os fornecedores de uma vez — o frontend
// agrupa por fornecedor (seção "Mondial", "Colormarq" etc.) e também usa a
// mesma lista pro comparativo de produtos.
router.get('/', requireAuth, requireView(TAB), async (req, res) => {
  const ano = Number(req.query.ano) || new Date().getFullYear();
  const mes = Number(req.query.mes) || (new Date().getMonth() + 1);
  const { rows } = await db.query(
    `SELECT pm.*, p.name AS product_name, f.nome AS fornecedor_nome
     FROM pedidos_mensais pm
     LEFT JOIN products p ON p.code = pm.product_code
     LEFT JOIN fornecedores f ON f.id = pm.supplier_id
     WHERE pm.ano = $1 AND pm.mes = $2
     ORDER BY f.nome, p.name`,
    [ano, mes]
  );
  res.json(rows);
});

function normalizeHeader(v) {
  return String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .toLowerCase();
}

function colLetter(c) { return XLSX.utils.encode_col(c); }

// Lê o arquivo (todas as abas, até 300 linhas cada) e tenta achar sozinho a
// linha de cabeçalho e as 3 colunas que interessam (código / pedido mensal /
// entregue) — procurando por essas palavras no texto de cada célula. Só um
// "melhor palpite": o frontend sempre mostra o mapeamento pra conferir/trocar
// antes de confirmar, porque cada fornecedor pode variar o layout.
router.post('/parse', requireAuth, requireEdit(TAB), async (req, res) => {
  const { xlsxBase64 } = req.body || {};
  if (!xlsxBase64) return res.status(400).json({ error: 'Envie o arquivo da planilha.' });

  let wb;
  try {
    wb = XLSX.read(Buffer.from(xlsxBase64, 'base64'), { type: 'buffer' });
  } catch (e) {
    return res.status(400).json({ error: 'Não foi possível ler esse arquivo como planilha (.xlsx).' });
  }
  if (!wb.SheetNames.length) return res.status(400).json({ error: 'Planilha sem nenhuma aba.' });

  const MAX_ROWS = 300;
  const sheets = {};
  let detected = null;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws['!ref']) { sheets[sheetName] = { columns: [], rows: [] }; continue; }
    const range = XLSX.utils.decode_range(ws['!ref']);
    const lastCol = Math.min(range.e.c, 40);
    const lastRow = Math.min(range.e.r, MAX_ROWS - 1);
    const columns = [];
    for (let c = range.s.c; c <= lastCol; c++) columns.push(colLetter(c));

    const rows = [];
    for (let r = range.s.r; r <= lastRow; r++) {
      const rowObj = {};
      let hasValue = false;
      for (let c = range.s.c; c <= lastCol; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v !== undefined && cell.v !== '') { rowObj[colLetter(c)] = cell.v; hasValue = true; }
      }
      rows.push(rowObj);
      if (!hasValue) continue;

      // Só tenta detectar cabeçalho nas primeiras 15 linhas de cada aba.
      if (!detected && r - range.s.r < 15) {
        let codigoCol = null, pedidoCol = null, entregueCol = null;
        for (const col of columns) {
          const norm = normalizeHeader(rowObj[col]);
          if (!norm) continue;
          if (!codigoCol && norm.includes('codigo')) codigoCol = col;
          else if (!pedidoCol && norm.includes('pedido') && !norm.includes('saldo')) pedidoCol = col;
          else if (!entregueCol && norm.includes('entregue')) entregueCol = col;
        }
        if (codigoCol && pedidoCol) {
          detected = { sheetName, headerRowIndex: r - range.s.r, columnMap: { codigo: codigoCol, pedidoMensal: pedidoCol, entregue: entregueCol } };
        }
      }
    }
    sheets[sheetName] = { columns, rows };
  }

  if (!detected) {
    const firstSheet = wb.SheetNames[0];
    detected = { sheetName: firstSheet, headerRowIndex: 0, columnMap: { codigo: null, pedidoMensal: null, entregue: null } };
  }

  res.json({ sheetNames: wb.SheetNames, sheets, detected });
});

// Recebe a lista já resolvida pelo frontend (depois do mapeamento de colunas
// conferido pelo usuário) e substitui pedido/entregue desse fornecedor+mês —
// reenviar a planilha atualizada no meio do mês é o fluxo normal, não soma.
router.post('/confirmar', requireAuth, requireEdit(TAB), async (req, res) => {
  const { supplierId, ano, mes, referencia, itens } = req.body || {};
  if (!supplierId) return res.status(400).json({ error: 'Selecione o fornecedor.' });
  const anoNum = Number(ano), mesNum = Number(mes);
  if (!anoNum || !mesNum || mesNum < 1 || mesNum > 12) return res.status(400).json({ error: 'Informe mês e ano válidos.' });

  const list = (Array.isArray(itens) ? itens : []).filter(i => i && i.productCode);
  if (!list.length) return res.status(400).json({ error: 'Nenhuma linha válida pra importar — confira o mapeamento de colunas.' });

  // A planilha de origem às vezes repete o mesmo código em linhas diferentes
  // (variantes lançadas separadamente) — soma em vez de deixar uma linha
  // sobrescrever silenciosamente a outra no upsert (chave é só o código).
  const merged = new Map();
  for (const it of list) {
    const code = String(it.productCode).trim();
    if (!code) continue;
    const cur = merged.get(code) || { productCode: code, pedidoMensal: 0, entregue: 0 };
    cur.pedidoMensal += Number(it.pedidoMensal) || 0;
    cur.entregue += Number(it.entregue) || 0;
    merged.set(code, cur);
  }
  const finalItens = [...merged.values()];

  await db.withTransaction(async (client) => {
    for (const it of finalItens) {
      await client.query(
        `INSERT INTO pedidos_mensais (id, supplier_id, ano, mes, product_code, pedido_mensal, entregue, referencia, usuario, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT (supplier_id, ano, mes, product_code)
         DO UPDATE SET pedido_mensal = excluded.pedido_mensal, entregue = excluded.entregue, referencia = excluded.referencia, usuario = excluded.usuario, updated_at = now()`,
        [crypto.randomUUID(), supplierId, anoNum, mesNum, it.productCode, Number(it.pedidoMensal) || 0, Number(it.entregue) || 0, referencia || '', req.user.username]
      );
    }
  });
  res.status(201).json({ ok: true, itens: finalItens.length });
});

module.exports = router;
