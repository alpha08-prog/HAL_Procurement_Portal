// Phase 5 — typed attachments with per-type permissions (from the email):
//   doc      reference/supporting files  — user + all routing members
//   stamping stamping documents          — initiator only
//   dop      Delegation of Power ref      — initiator (or automatic)
//   pm       Purchase Manual ref          — automatic only (auto-added at initiation)
import { Router } from 'express';
import { all, get, nowISO, run } from '../../noting/db.js';
import { currentMember } from '../../noting/identity.js';
import { noteByTxn, participants } from '../../noting/workflow.js';
import { requireNoteAccess } from './access.js';

const router = Router();
const KINDS = ['doc', 'stamping', 'dop', 'pm'];

router.get('/notes/:txnId/attachments', (req, res) => {
  const note = noteByTxn(req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!requireNoteAccess(req, res, note)) return;
  const attachments = all(
    `SELECT a.id, a.kind, a.name, a.ref, a.created_at, m.name AS uploaded_by
     FROM attachments a LEFT JOIN members m ON m.id = a.uploaded_by_id
     WHERE a.note_id = ? ORDER BY a.id ASC`,
    note.id
  );
  res.json({ attachments });
});

router.post('/notes/:txnId/attachments', (req, res) => {
  const me = currentMember(req);
  const note = noteByTxn(req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!me || !participants(note.id).has(me.id)) return res.status(403).json({ error: 'Only a routed member can attach files' });

  const { kind, name, ref } = req.body || {};
  if (!KINDS.includes(kind)) return res.status(422).json({ error: `kind must be one of ${KINDS.join(', ')}` });
  if (kind === 'pm') return res.status(403).json({ error: 'PM reference is added automatically' });
  if ((kind === 'stamping' || kind === 'dop') && me.id !== note.initiator_id) {
    return res.status(403).json({ error: `Only the initiator can add ${kind === 'dop' ? 'a DoP reference' : 'stamping documents'}` });
  }
  if (!name || !String(name).trim()) return res.status(422).json({ error: 'A name is required' });

  run(
    `INSERT INTO attachments(note_id,kind,name,ref,uploaded_by_id,created_at) VALUES(?,?,?,?,?,?)`,
    note.id, kind, String(name).trim(), (ref || '').trim() || null, me.id, nowISO()
  );
  res.status(201).json({ ok: true });
});

export default router;
