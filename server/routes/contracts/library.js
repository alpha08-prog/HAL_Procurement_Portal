// The STC clause library: readable by any signed-in user, amendable ONLY by an admin
// account (requireAdmin — the server checks the real account role, not the RoleSwitcher
// preview). Every amendment files the superseded text + who/when/why + the legal-vetting
// reference doc into clause_versions. Amendments never touch already-generated contracts
// (their clause bodies are snapshots).
import { Router } from 'express';
import { all, get, run, nowISO } from '../../contracts/db.js';
import { contractActor } from '../../contracts/identity.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

const router = Router();

// One payload drives the library list AND the matrix grid.
router.get('/library', (_req, res) => {
  res.json({
    contractTypes: all('SELECT * FROM contract_types ORDER BY sort'),
    clauses: all('SELECT * FROM clauses ORDER BY matrix_no IS NULL, matrix_no'),
    cells: all('SELECT clause_id, contract_type_id, value FROM clause_matrix')
  });
});

router.get('/library/clauses/:id/history', (req, res) => {
  if (!get('SELECT id FROM clauses WHERE id = ?', Number(req.params.id))) return res.status(404).json({ error: 'Clause not found' });
  res.json({
    versions: all('SELECT * FROM clause_versions WHERE clause_id = ? ORDER BY version DESC', Number(req.params.id))
  });
});

router.put('/library/clauses/:id', requireAdmin, (req, res) => {
  const clause = get('SELECT * FROM clauses WHERE id = ?', Number(req.params.id));
  if (!clause) return res.status(404).json({ error: 'Clause not found' });
  const body = String(req.body?.body || '').trim();
  const changeNote = String(req.body?.changeNote || '').trim();
  const referenceDoc = String(req.body?.referenceDoc || '').trim();
  if (!body || !changeNote || !referenceDoc)
    return res.status(422).json({ error: 'Amended text, a change note and the reference doc for the change are all required' });

  const actor = contractActor(req);
  const stamp = `${actor?.name || 'Admin'} (${actor?.pb || '—'})`;
  run(
    `INSERT INTO clause_versions(clause_id,version,prior_body,changed_by_name,changed_by_pb,changed_at,change_note,reference_doc)
     VALUES(?,?,?,?,?,?,?,?)`,
    clause.id, clause.version, clause.body, actor?.name || null, actor?.pb || null, nowISO(), changeNote, referenceDoc
  );
  run('UPDATE clauses SET body = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?', body, stamp, nowISO(), clause.id);
  res.json({ clause: get('SELECT * FROM clauses WHERE id = ?', clause.id) });
});

export default router;
