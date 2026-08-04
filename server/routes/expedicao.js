const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireView, requireEdit } = require('../auth');

const router = express.Router();
const TAB = 'expedicao';

function validItens(itens) {
  return (Array.isArray(itens) ? itens : []).filter(i => i && i.productCode && Number(i.quantidade) > 0);
}

router.get('/', requireAuth, requireView(TAB), async (req, res) => {
  const { rows } = await db.query(`
    SELECT r.*, f.nome AS fornecedor_nome,
           COALESCE(SUM(i.quantidade), 0) AS total_quantidade,
           COUNT(i.id) AS total_itens
    FROM romaneios r
    LEFT JOIN fornecedores f ON f.id = r.supplier_id
    LEFT JOIN romaneio_itens i ON i.romaneio_id = r.id
    GROUP BY r.id, f.nome
    ORDER BY r.created_at DESC
  `);
  res.json(rows);
});

router.get('/:id', requireAuth, requireView(TAB), async (req, res) => {
  const { rows: head } = await db.query(
    'SELECT r.*, f.nome AS fornecedor_nome FROM romaneios r LEFT JOIN fornecedores f ON f.id = r.supplier_id WHERE r.id = $1',
    [req.params.id]
  );
  if (!head[0]) return res.status(404).json({ error: 'Romaneio não encontrado.' });

  const { rows: itens } = await db.query(
    'SELECT ri.*, p.name AS product_name FROM romaneio_itens ri LEFT JOIN products p ON p.code = ri.product_code WHERE ri.romaneio_id = $1 ORDER BY ri.created_at',
    [req.params.id]
  );
  res.json({ ...head[0], itens });
});

router.post('/', requireAuth, requireEdit(TAB), async (req, res) => {
  const r = req.body || {};
  const itens = validItens(r.itens);
  if (!itens.length) return res.status(400).json({ error: 'Adicione ao menos um produto com quantidade maior que zero.' });

  const { rows: [{ nextval }] } = await db.query("SELECT nextval('romaneios_seq')");
  const id = 'RM-' + String(nextval).padStart(5, '0');

  await db.withTransaction(async (client) => {
    await client.query(
      `INSERT INTO romaneios (id, supplier_id, date, caminhao, motorista, assinatura, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'aberto', $7)`,
      [id, r.supplierId || null, r.date || '', r.caminhao || '', r.motorista || '', r.assinatura || '', req.user.username]
    );
    for (const it of itens) {
      await client.query(
        'INSERT INTO romaneio_itens (id, romaneio_id, product_code, quantidade) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), id, it.productCode, Number(it.quantidade)]
      );
    }
  });
  res.status(201).json({ id });
});

// Só permite editar cabeçalho/itens enquanto o romaneio está aberto — se já
// foi finalizado (e por tanto já debitou estoque), precisa reabrir primeiro
// pra não desalinhar o que já foi lançado.
router.put('/:id', requireAuth, requireEdit(TAB), async (req, res) => {
  const { rows } = await db.query('SELECT status FROM romaneios WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Romaneio não encontrado.' });
  if (rows[0].status !== 'aberto') return res.status(409).json({ error: 'Reabra o romaneio antes de alterar.' });

  const r = req.body || {};
  const itens = validItens(r.itens);
  if (!itens.length) return res.status(400).json({ error: 'Adicione ao menos um produto com quantidade maior que zero.' });

  await db.withTransaction(async (client) => {
    await client.query(
      'UPDATE romaneios SET supplier_id=$1, date=$2, caminhao=$3, motorista=$4, assinatura=$5 WHERE id=$6',
      [r.supplierId || null, r.date || '', r.caminhao || '', r.motorista || '', r.assinatura || '', req.params.id]
    );
    await client.query('DELETE FROM romaneio_itens WHERE romaneio_id = $1', [req.params.id]);
    for (const it of itens) {
      await client.query(
        'INSERT INTO romaneio_itens (id, romaneio_id, product_code, quantidade) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), req.params.id, it.productCode, Number(it.quantidade)]
      );
    }
  });
  res.json({ ok: true });
});

// Finalizar debita o estoque de produto acabado item a item — aceita mesmo se
// o produto estiver zerado (ou pouco) no estoque, ficando negativo, porque a
// carga pode ter saído do galpão físico independente do que o sistema mostra;
// esconder isso arredondando pra zero só mascararia o descompasso real.
router.patch('/:id/finalizar', requireAuth, requireEdit(TAB), async (req, res) => {
  const { rows } = await db.query('SELECT * FROM romaneios WHERE id = $1', [req.params.id]);
  const rm = rows[0];
  if (!rm) return res.status(404).json({ error: 'Romaneio não encontrado.' });
  if (rm.status === 'finalizado') return res.status(409).json({ error: 'Esse romaneio já está finalizado.' });

  const { rows: itens } = await db.query('SELECT * FROM romaneio_itens WHERE romaneio_id = $1', [req.params.id]);
  if (!itens.length) return res.status(400).json({ error: 'Romaneio sem itens não pode ser finalizado.' });

  await db.withTransaction(async (client) => {
    for (const it of itens) {
      await client.query('UPDATE products SET estoque_pa = estoque_pa - $1 WHERE code = $2', [it.quantidade, it.product_code]);
      await client.query(
        `INSERT INTO stock_movements (id, tipo, product_code, quantidade, referencia, usuario)
         VALUES ($1, 'saida_pa', $2, $3, $4, $5)`,
        [crypto.randomUUID(), it.product_code, it.quantidade, req.params.id, req.user.username]
      );
    }
    await client.query(`UPDATE romaneios SET status = 'finalizado', finalizado_em = now(), finalizado_por = $1 WHERE id = $2`, [req.user.username, req.params.id]);
  });
  res.json({ ok: true });
});

// Reabre um romaneio finalizado (ex.: precisa alterar a carga): devolve pro
// estoque de produto acabado tudo que tinha sido debitado na finalização.
router.patch('/:id/reabrir', requireAuth, requireEdit(TAB), async (req, res) => {
  const { rows } = await db.query('SELECT * FROM romaneios WHERE id = $1', [req.params.id]);
  const rm = rows[0];
  if (!rm) return res.status(404).json({ error: 'Romaneio não encontrado.' });
  if (rm.status !== 'finalizado') return res.status(409).json({ error: 'Esse romaneio ainda não foi finalizado.' });

  await db.withTransaction(async (client) => {
    const { rows: movs } = await client.query(`SELECT * FROM stock_movements WHERE referencia = $1 AND tipo = 'saida_pa'`, [req.params.id]);
    for (const m of movs) {
      await client.query('UPDATE products SET estoque_pa = estoque_pa + $1 WHERE code = $2', [m.quantidade, m.product_code]);
    }
    await client.query(`DELETE FROM stock_movements WHERE referencia = $1 AND tipo = 'saida_pa'`, [req.params.id]);
    await client.query(`UPDATE romaneios SET status = 'aberto', finalizado_em = NULL, finalizado_por = NULL WHERE id = $1`, [req.params.id]);
  });
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, requireEdit(TAB), async (req, res) => {
  const { rows } = await db.query('SELECT status FROM romaneios WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Romaneio não encontrado.' });
  if (rows[0].status === 'finalizado') return res.status(409).json({ error: 'Reabra o romaneio antes de excluir.' });
  await db.query('DELETE FROM romaneios WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
