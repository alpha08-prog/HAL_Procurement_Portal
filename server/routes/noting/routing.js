// Phase 2 — routing spine: per-member inbox & cabinet, and the hand-off actions
// (forward / send back / retract / approve-reject / retrieve) + routing history.
import { Router } from 'express';
import { all } from '../../noting/db.js';
import { currentMember } from '../../noting/identity.js';
import { nextStage, stageTitle } from '../../noting/stages.js';
import {
  decide, forward, history, noteByTxn, retract, retrieve, sendBack
} from '../../noting/workflow.js';

const router = Router();

// Wrap a workflow action: resolve member + note, run it, map thrown {status,message}.
function action(fn) {
  return (req, res) => {
    const me = currentMember(req);
    const note = noteByTxn(req.params.txnId);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    try {
      res.json({ note: fn(note, me, req.body || {}) });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  };
}

// Everything currently sitting with me and awaiting action.
router.get('/inbox', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });
  const rows = all(
    `SELECT n.txn_id, n.ref_no, n.title, n.status, n.classification, n.created_at,
            f.file_id, f.title AS file_title, f.kind, f.standalone, im.name AS initiator,
            (SELECT rs.purpose FROM routing_steps rs WHERE rs.note_id = n.id AND rs.to_member_id = ? ORDER BY rs.seq DESC LIMIT 1) AS incoming_purpose,
            (SELECT rs.state   FROM routing_steps rs WHERE rs.note_id = n.id AND rs.to_member_id = ? ORDER BY rs.seq DESC LIMIT 1) AS incoming_state
     FROM notes n JOIN files f ON f.id = n.file_pk LEFT JOIN members im ON im.id = n.initiator_id
     WHERE n.custodian_id = ? AND n.status IN ('draft','in_check','routed')
     ORDER BY n.id DESC`,
    me.id, me.id, me.id
  );
  res.json({ inbox: rows });
});

// Closed files filed into my cabinet (as initiator, router or approver).
router.get('/cabinet', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });
  const rows = all(
    `SELECT c.reason, c.placed_at, f.id AS file_pk, f.file_id, f.title, f.kind, f.standalone, f.status,
            (SELECT n.txn_id  FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS last_txn,
            (SELECT n.status  FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS last_status,
            (SELECT n.stage_id FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS last_stage,
            (SELECT n.decided_by FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS decided_by
     FROM cabinet c JOIN files f ON f.id = c.file_pk
     WHERE c.member_id = ? ORDER BY c.placed_at DESC, f.id DESC`,
    me.id
  );
  // Next-action prompt: only when the latest note is approved and the case is still open
  // (a rejected or fully-closed case offers no next stage). The client turns this into a
  // one-click "create the next note" action.
  const cabinet = rows.map((r) => {
    const advance = r.last_status === 'approved' && r.status === 'open';
    const next = advance ? nextStage(r.last_stage) : null;
    return { ...r, next_stage: next, next_stage_title: next ? stageTitle(next) : null };
  });
  res.json({ cabinet, meId: me.id });
});

router.post('/notes/:txnId/forward', action((note, me, b) => forward(note, me, Number(b.toMemberId), b.comment)));
router.post('/notes/:txnId/send-back', action((note, me, b) => sendBack(note, me, Number(b.toMemberId), b.comment)));
router.post('/notes/:txnId/retract', action((note, me) => retract(note, me)));
router.post('/notes/:txnId/decision', action((note, me, b) => decide(note, me, b.decision, b.comment)));
router.post('/notes/:txnId/retrieve', action((note, me) => retrieve(note, me)));

router.get('/notes/:txnId/history', (req, res) => {
  const note = noteByTxn(req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json({ history: history(note.id) });
});

export default router;
