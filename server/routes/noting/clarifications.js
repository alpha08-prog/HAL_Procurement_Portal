// Phase 4 — clarifications: a threaded side-window attached to a note but NOT part of
// its body. Visible only to the member who sought it, the member asked, and the note
// initiator. Comments proper are captured per routing step (the auto "Concurred &
// Forwarded" on forward) and shown in the routing trail.
import { Router } from 'express';
import { all, get, nowISO, run } from '../../noting/db.js';
import { currentMember } from '../../noting/identity.js';
import { noteByTxn, participants } from '../../noting/workflow.js';

const router = Router();

// Raise a clarification to another routed member.
router.post('/notes/:txnId/clarifications', (req, res) => {
  const me = currentMember(req);
  const note = noteByTxn(req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  const parts = participants(note.id);
  if (!me || !parts.has(me.id)) return res.status(403).json({ error: 'Only a routed member can raise a clarification' });
  const toId = Number(req.body?.toMemberId);
  const body = (req.body?.body || '').trim();
  if (!toId || toId === me.id) return res.status(422).json({ error: 'Choose another member to clarify with' });
  if (!parts.has(toId)) return res.status(422).json({ error: 'Clarification can only be sought from a routed member' });
  if (!body) return res.status(422).json({ error: 'A clarification message is required' });

  const c = run(
    `INSERT INTO clarifications(note_id,asked_by_id,asked_to_id,status,created_at) VALUES(?,?,?, 'open', ?)`,
    note.id, me.id, toId, nowISO()
  );
  run(`INSERT INTO clarification_messages(clarification_id,author_id,body,created_at) VALUES(?,?,?,?)`, c.lastInsertRowid, me.id, body, nowISO());
  res.status(201).json({ id: c.lastInsertRowid });
});

// Clarifications on a note that I'm party to (asker / asked / initiator).
router.get('/notes/:txnId/clarifications', (req, res) => {
  const me = currentMember(req);
  const note = noteByTxn(req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });

  const rows = all(
    `SELECT c.id, c.status, c.created_at, c.asked_by_id, c.asked_to_id,
            ab.name AS asked_by, at.name AS asked_to
     FROM clarifications c
     LEFT JOIN members ab ON ab.id = c.asked_by_id
     LEFT JOIN members at ON at.id = c.asked_to_id
     WHERE c.note_id = ? AND (c.asked_by_id = ? OR c.asked_to_id = ? OR ? = ?)
     ORDER BY c.id DESC`,
    note.id, me.id, me.id, me.id, note.initiator_id
  ).map((c) => ({
    ...c,
    messages: all(
      `SELECT m.body, m.created_at, mm.name AS author, m.author_id
       FROM clarification_messages m LEFT JOIN members mm ON mm.id = m.author_id
       WHERE m.clarification_id = ? ORDER BY m.id ASC`,
      c.id
    )
  }));
  res.json({ clarifications: rows });
});

// Reply within a clarification thread — only the two parties may post.
router.post('/clarifications/:id/messages', (req, res) => {
  const me = currentMember(req);
  const c = get('SELECT * FROM clarifications WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Clarification not found' });
  if (!me || (me.id !== c.asked_by_id && me.id !== c.asked_to_id)) {
    return res.status(403).json({ error: 'Only the two parties can reply' });
  }
  const body = (req.body?.body || '').trim();
  if (!body) return res.status(422).json({ error: 'A message is required' });
  run(`INSERT INTO clarification_messages(clarification_id,author_id,body,created_at) VALUES(?,?,?,?)`, c.id, me.id, body, nowISO());
  run(`UPDATE clarifications SET status = ? WHERE id = ?`, me.id === c.asked_to_id ? 'answered' : 'open', c.id);
  res.json({ ok: true });
});

export default router;
