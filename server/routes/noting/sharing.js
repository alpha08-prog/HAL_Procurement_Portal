// Phase 3 — need-to-know sharing for restricted notes. A routed (custodian/participant)
// member issues a share link to a specific person; re-sharing that link is caught in the
// note-detail route (routes/noting/notes.js), which revokes it for both and alerts the
// custodian with the offending PB. Here: issue links, list them, and read leak alerts.
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { all, get, nowISO, run } from '../../noting/db.js';
import { currentMember } from '../../noting/identity.js';
import { noteByTxn, participants } from '../../noting/workflow.js';

const router = Router();

// Issue a need-to-know share link to one member.
router.post('/notes/:txnId/grant', (req, res) => {
  const me = currentMember(req);
  const note = noteByTxn(req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!me || !participants(note.id).has(me.id)) {
    return res.status(403).json({ error: 'Only a routed member can share this note' });
  }
  const toId = Number(req.body?.toMemberId);
  if (!toId) return res.status(422).json({ error: 'Choose a member to share with' });
  if (!get('SELECT id FROM members WHERE id = ?', toId)) return res.status(422).json({ error: 'Unknown member' });

  const token = randomUUID();
  run(
    `INSERT INTO access_grants(note_id,token,granted_by_id,granted_to_id,state,created_at)
     VALUES(?,?,?,?, 'active', ?)`,
    note.id, token, me.id, toId, nowISO()
  );
  res.status(201).json({ token, link: `/noting/note/${note.txn_id}?grant=${token}` });
});

// Active grants on a note (visible to routed members).
router.get('/notes/:txnId/grants', (req, res) => {
  const me = currentMember(req);
  const note = noteByTxn(req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!me || !participants(note.id).has(me.id)) return res.status(403).json({ error: 'Not a routed member' });
  const grants = all(
    `SELECT g.token, g.state, g.created_at, g.revoked_at, g.revoke_reason,
            gt.name AS granted_to, gb.name AS granted_by
     FROM access_grants g
     LEFT JOIN members gt ON gt.id = g.granted_to_id
     LEFT JOIN members gb ON gb.id = g.granted_by_id
     WHERE g.note_id = ? ORDER BY g.id DESC`,
    note.id
  );
  res.json({ grants });
});

// Leak alerts addressed to me (as custodian): a restricted note's link was re-shared.
router.get('/alerts', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });
  const alerts = all(
    `SELECT a.offender_pb, a.message, a.created_at, n.txn_id, n.ref_no, n.title
     FROM access_alerts a JOIN notes n ON n.id = a.note_id
     WHERE a.custodian_id = ? ORDER BY a.id DESC`,
    me.id
  );
  res.json({ alerts });
});

export default router;
