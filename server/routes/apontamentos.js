const express = require('express');
const db = require('../db');
const { requireAuth, requireView, requireEdit, blockPending } = require('../auth');

const router = express.Router();
const TAB = 'apontamento';

// Any authenticated (and approved) user can read this list: other tabs (Apontamento,
// Dashboard, Consolidado MP, Comparativos) need to join against it even if their
// profile can't see/edit this tab directly. Edit/delete below stays gated by requireEdit(TAB).
router.get('/', requireAuth, blockPending, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM apontamentos ORDER BY created_at');
  res.json(rows);
});

function isBlank(v) { return v === undefined || v === null || v === ''; }

router.post('/', requireAuth, requireEdit(TAB), async (req, res) => {
  const a = req.body || {};
  if (!a.opMaquinaId) return res.status(400).json({ error: 'Selecione a OP de máquina.' });
  if (isBlank(a.qtdProduzida)) return res.status(400).json({ error: 'Quantidade produzida é obrigatória.' });
  if (isBlank(a.refugo)) return res.status(400).json({ error: 'Refugo é obrigatório.' });
  if (isBlank(a.horaInicio)) return res.status(400).json({ error: 'Hora início é obrigatória.' });
  if (isBlank(a.horaFim)) return res.status(400).json({ error: 'Hora fim é obrigatória.' });

  const { rows: [{ nextval }] } = await db.query("SELECT nextval('apontamentos_seq')");
  const id = 'AP-' + String(nextval).padStart(5, '0');
  const operador = a.operador || '';

  await db.query(
    `INSERT INTO apontamentos (id, op_maquina_id, date, turno, qtd_produzida, refugo, hora_inicio, hora_fim, parada, motivo, obs, operador)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id, a.opMaquinaId, a.date || '', a.turno,
      Number(a.qtdProduzida) || 0, Number(a.refugo) || 0,
      a.horaInicio || '', a.horaFim || '', Number(a.parada) || 0,
      a.motivo || '', a.obs || '', operador,
    ]
  );
  res.status(201).json({ id, ...a, operador });
});

router.delete('/:id', requireAuth, requireEdit(TAB), async (req, res) => {
  await db.query('DELETE FROM apontamentos WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
