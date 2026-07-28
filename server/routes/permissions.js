const express = require('express');
const db = require('../db');
const { requireAuth, requireView, requireEdit } = require('../auth');
const { TABS, ROLES } = require('../constants');

const router = express.Router();

router.get('/', requireAuth, requireView('permissoes'), async (req, res) => {
  const { rows } = await db.query('SELECT tab_id, role, can_view, can_edit FROM permissions');
  const matrix = {};
  for (const tabId of TABS) matrix[tabId] = { view: [], edit: [] };
  for (const r of rows) {
    if (r.can_view) matrix[r.tab_id].view.push(r.role);
    if (r.can_edit) matrix[r.tab_id].edit.push(r.role);
  }
  res.json(matrix);
});

// body: { tabId, role, canView, canEdit }
router.put('/', requireAuth, requireEdit('permissoes'), async (req, res) => {
  const { tabId, role, canView, canEdit } = req.body || {};
  if (!TABS.includes(tabId) || !ROLES.includes(role)) return res.status(400).json({ error: 'Aba ou perfil inválido.' });

  // Editing implies viewing: never allow edit=true with view=false.
  const view = canEdit ? true : !!canView;

  await db.query(
    `INSERT INTO permissions (tab_id, role, can_view, can_edit) VALUES ($1, $2, $3, $4)
     ON CONFLICT (tab_id, role) DO UPDATE SET can_view = excluded.can_view, can_edit = excluded.can_edit`,
    [tabId, role, view ? 1 : 0, canEdit ? 1 : 0]
  );

  res.json({ ok: true });
});

module.exports = router;
