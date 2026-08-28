const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireView, requireEdit } = require('../auth');

const router = express.Router();
const TAB = 'requisicoes';

function validItens(itens) {
  return (Array.isArray(itens) ? itens : []).filter(i => i && i.rawMaterialCode && Number(i.quantidade) > 0);
}

// Itens vêm embutidos em cada requisição (não só o total agregado) pra dar
// pro frontend montar o relatório compilado por insumo num período, sem
// precisar buscar o detalhe de cada requisição uma a uma.
router.get('/', requireAuth, requireView(TAB), async (req, res) => {
  const { rows: heads } = await db.query(`
    SELECT r.*, p.name AS product_name
    FROM requisicoes_material r
    LEFT JOIN products p ON p.code = r.product_code
    ORDER BY r.created_at DESC
  `);
  const { rows: itensRows } = await db.query(`
    SELECT ri.requisicao_id, ri.raw_material_code, ri.quantidade,
           rm.descricao AS raw_material_descricao, rm.unidade AS raw_material_unidade
    FROM requisicao_itens ri
    LEFT JOIN raw_materials rm ON rm.code = ri.raw_material_code
  `);
  const itensByReq = {};
  for (const it of itensRows) (itensByReq[it.requisicao_id] = itensByReq[it.requisicao_id] || []).push(it);

  const rows = heads.map(h => {
    const itens = itensByReq[h.id] || [];
    return {
      ...h,
      itens,
      total_itens: itens.length,
      total_quantidade: itens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0),
    };
  });
  res.json(rows);
});

router.get('/:id', requireAuth, requireView(TAB), async (req, res) => {
  const { rows: head } = await db.query(
    'SELECT r.*, p.name AS product_name FROM requisicoes_material r LEFT JOIN products p ON p.code = r.product_code WHERE r.id = $1',
    [req.params.id]
  );
  if (!head[0]) return res.status(404).json({ error: 'Requisição não encontrada.' });

  const { rows: itens } = await db.query(
    'SELECT ri.*, rm.descricao AS raw_material_descricao FROM requisicao_itens ri LEFT JOIN raw_materials rm ON rm.code = ri.raw_material_code WHERE ri.requisicao_id = $1 ORDER BY ri.created_at',
    [req.params.id]
  );
  res.json({ ...head[0], itens });
});

router.post('/', requireAuth, requireEdit(TAB), async (req, res) => {
  const r = req.body || {};
  if (!r.solicitante || !r.solicitante.trim()) return res.status(400).json({ error: 'Informe o nome de quem está solicitando.' });
  const itens = validItens(r.itens);
  if (!itens.length) return res.status(400).json({ error: 'Adicione ao menos um insumo com quantidade maior que zero.' });

  const { rows: [{ nextval }] } = await db.query("SELECT nextval('requisicoes_material_seq')");
  const id = 'RQ-' + String(nextval).padStart(5, '0');

  await db.withTransaction(async (client) => {
    await client.query(
      `INSERT INTO requisicoes_material (id, solicitante, setor, product_code, date, assinatura, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'aberto', $7)`,
      [id, r.solicitante.trim(), r.setor || '', r.productCode || null, r.date || '', r.assinatura || '', req.user.username]
    );
    for (const it of itens) {
      await client.query(
        'INSERT INTO requisicao_itens (id, requisicao_id, raw_material_code, quantidade) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), id, it.rawMaterialCode, Number(it.quantidade)]
      );
    }
  });
  res.status(201).json({ id });
});

// Só permite editar cabeçalho/itens enquanto a requisição está aberta — se já
// foi finalizada (e já debitou estoque), precisa reabrir primeiro.
router.put('/:id', requireAuth, requireEdit(TAB), async (req, res) => {
  const { rows } = await db.query('SELECT status FROM requisicoes_material WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Requisição não encontrada.' });
  if (rows[0].status !== 'aberto') return res.status(409).json({ error: 'Reabra a requisição antes de alterar.' });

  const r = req.body || {};
  if (!r.solicitante || !r.solicitante.trim()) return res.status(400).json({ error: 'Informe o nome de quem está solicitando.' });
  const itens = validItens(r.itens);
  if (!itens.length) return res.status(400).json({ error: 'Adicione ao menos um insumo com quantidade maior que zero.' });

  await db.withTransaction(async (client) => {
    await client.query(
      'UPDATE requisicoes_material SET solicitante=$1, setor=$2, product_code=$3, date=$4, assinatura=$5 WHERE id=$6',
      [r.solicitante.trim(), r.setor || '', r.productCode || null, r.date || '', r.assinatura || '', req.params.id]
    );
    await client.query('DELETE FROM requisicao_itens WHERE requisicao_id = $1', [req.params.id]);
    for (const it of itens) {
      await client.query(
        'INSERT INTO requisicao_itens (id, requisicao_id, raw_material_code, quantidade) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), req.params.id, it.rawMaterialCode, Number(it.quantidade)]
      );
    }
  });
  res.json({ ok: true });
});

// Finalizar debita o estoque de matéria-prima item a item — aceita mesmo se
// faltar saldo (fica negativo), porque o material pode ter saído do
// almoxarifado físico independente do que o sistema mostra; não escondemos
// esse descompasso arredondando pra zero (mesma regra já usada em Expedição).
router.patch('/:id/finalizar', requireAuth, requireEdit(TAB), async (req, res) => {
  const { rows } = await db.query('SELECT * FROM requisicoes_material WHERE id = $1', [req.params.id]);
  const rq = rows[0];
  if (!rq) return res.status(404).json({ error: 'Requisição não encontrada.' });
  if (rq.status === 'finalizado') return res.status(409).json({ error: 'Essa requisição já está finalizada.' });

  const { rows: itens } = await db.query('SELECT * FROM requisicao_itens WHERE requisicao_id = $1', [req.params.id]);
  if (!itens.length) return res.status(400).json({ error: 'Requisição sem itens não pode ser finalizada.' });

  await db.withTransaction(async (client) => {
    for (const it of itens) {
      await client.query('UPDATE raw_materials SET estoque = estoque - $1 WHERE code = $2', [it.quantidade, it.raw_material_code]);
      await client.query(
        `INSERT INTO stock_movements (id, tipo, raw_material_code, quantidade, referencia, usuario)
         VALUES ($1, 'saida_requisicao', $2, $3, $4, $5)`,
        [crypto.randomUUID(), it.raw_material_code, it.quantidade, req.params.id, req.user.username]
      );
    }
    await client.query(`UPDATE requisicoes_material SET status = 'finalizado', finalizado_em = now(), finalizado_por = $1 WHERE id = $2`, [req.user.username, req.params.id]);
  });
  res.json({ ok: true });
});

// Reabre uma requisição finalizada: devolve pro estoque de matéria-prima
// tudo que tinha sido debitado.
router.patch('/:id/reabrir', requireAuth, requireEdit(TAB), async (req, res) => {
  const { rows } = await db.query('SELECT * FROM requisicoes_material WHERE id = $1', [req.params.id]);
  const rq = rows[0];
  if (!rq) return res.status(404).json({ error: 'Requisição não encontrada.' });
  if (rq.status !== 'finalizado') return res.status(409).json({ error: 'Essa requisição ainda não foi finalizada.' });

  await db.withTransaction(async (client) => {
    const { rows: movs } = await client.query(`SELECT * FROM stock_movements WHERE referencia = $1 AND tipo = 'saida_requisicao'`, [req.params.id]);
    for (const m of movs) {
      await client.query('UPDATE raw_materials SET estoque = estoque + $1 WHERE code = $2', [m.quantidade, m.raw_material_code]);
    }
    await client.query(`DELETE FROM stock_movements WHERE referencia = $1 AND tipo = 'saida_requisicao'`, [req.params.id]);
    await client.query(`UPDATE requisicoes_material SET status = 'aberto', finalizado_em = NULL, finalizado_por = NULL WHERE id = $1`, [req.params.id]);
  });
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, requireEdit(TAB), async (req, res) => {
  const { rows } = await db.query('SELECT status FROM requisicoes_material WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Requisição não encontrada.' });
  if (rows[0].status === 'finalizado') return res.status(409).json({ error: 'Reabra a requisição antes de excluir.' });
  await db.query('DELETE FROM requisicoes_material WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
