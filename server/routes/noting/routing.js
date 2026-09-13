// Phase 2 — routing spine: per-member inbox & cabinet, and the hand-off actions
// (forward / send back / retract / approve-reject / retrieve) + routing history.
import { Router } from 'express';
import { all, get, nowISO, run } from '../../noting/db.js';
import { currentMember } from '../../noting/identity.js';
import { nextStage, stageTitle } from '../../noting/stages.js';
import {
  addNote, decide, fileStageHistory, forward, history, noteByTxn, retract, retrieve, sendBack
} from '../../noting/workflow.js';
import { requireNoteAccess } from './access.js';
import * as aiStore from '../../ai/caseStore.js';

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
    `SELECT n.txn_id, n.ref_no, n.title, n.body, n.status, n.classification, n.created_at,
            f.file_id, f.title AS file_title, f.kind, f.standalone, im.name AS initiator_name,
            u.name AS department,
            (SELECT rs.purpose FROM routing_steps rs WHERE rs.note_id = n.id AND rs.to_member_id = ? ORDER BY rs.seq DESC LIMIT 1) AS incoming_purpose,
            (SELECT rs.state   FROM routing_steps rs WHERE rs.note_id = n.id AND rs.to_member_id = ? ORDER BY rs.seq DESC LIMIT 1) AS incoming_state
     FROM notes n
     JOIN files f ON f.id = n.file_pk
     LEFT JOIN members im ON im.id = n.initiator_id
     LEFT JOIN org_units u ON u.id = im.section_id
     WHERE n.custodian_id = ? AND n.status IN ('draft','in_check','routed')
     ORDER BY n.created_at DESC`,
    me.id, me.id, me.id
  );
  for (const r of rows) {
    r.priority = 'Medium';
  }
  res.json({ inbox: rows, meId: me.id });
});

// Closed files filed into my cabinet (as initiator, router, approver, or purchase manager).
router.get('/cabinet', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });
  const rows = all(
    `SELECT c.reason, c.placed_at, f.id AS file_pk, f.file_id, f.title, f.kind, f.standalone, f.status AS file_status, f.ai_case_id,
            im.name AS initiator_name,
            (SELECT n.txn_id   FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS last_txn,
            (SELECT n.txn_id   FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS txn_id,
            (SELECT n.status   FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS last_status,
            (SELECT n.stage_id FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS last_stage,
            (SELECT n.decided_by FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS decided_by
     FROM cabinet c 
     JOIN files f ON f.id = c.file_pk
     LEFT JOIN members im ON im.id = f.initiator_id
     WHERE c.member_id = ? 
     ORDER BY c.placed_at DESC, f.id DESC`,
    me.id
  );
  // Next-action prompt: when the latest note is approved and the case is still open, offer
  // the next linear stage; when the case CLOSED at an approved PO (or amendment), offer a
  // need-based PO Amendment (which reopens it). A rejection offers nothing. The client
  // turns this into a one-click "create the next note" action.
  const cabinet = rows.map((r) => {
    let next = null;
    if (r.last_status === 'approved') {
      if (r.file_status === 'open') next = nextStage(r.last_stage);
      else if (['po', 'po_amendment'].includes(r.last_stage)) next = 'po_amendment';
    }

    // Get stage summary
    const stages = all(
      `SELECT n.id, n.seq, n.txn_id, n.title, n.stage_id, n.status, n.stage_no,
              (SELECT COUNT(*) FROM noting_entries ne WHERE ne.note_id = n.id) AS notes_count
       FROM notes n WHERE n.file_pk = ? ORDER BY n.seq ASC`,
      r.file_pk
    );

    // Get allowed next stage options from AI cascade
    let allowedOptions = [];
    if (r.ai_case_id) {
      try {
        const kase = aiStore.loadCase(r.ai_case_id, req.user);
        allowedOptions = kase?.options || [];
      } catch {}
    }
    if (allowedOptions.length === 0 && next) {
      allowedOptions = [{ noteId: next, label: stageTitle(next), needBased: false }];
    }

    return {
      ...r,
      status: r.last_status || 'approved',
      priority: 'Medium',
      next_stage: next,
      next_stage_title: next ? stageTitle(next) : null,
      stages,
      allowed_options: allowedOptions
    };
  });
  res.json({ cabinet, meId: me.id });
});

// Full stage history for a file in Cabinet
router.get('/cabinet/:filePk/stage-history', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });
  const file = get('SELECT * FROM files WHERE id = ?', Number(req.params.filePk));
  if (!file) return res.status(404).json({ error: 'File not found' });
  res.json({ file, stages: fileStageHistory(file.id) });
});

// Generate next stage note from Cabinet with configured routing trail
router.post('/cabinet/:filePk/generate-next-stage', async (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });
  const file = get('SELECT * FROM files WHERE id = ?', Number(req.params.filePk));
  if (!file) return res.status(404).json({ error: 'File not found' });

  const { stageId, title, body = '', classification = 'normal', routingList = [], fields = {}, useAi = false } = req.body || {};
  if (!stageId) return res.status(422).json({ error: 'stageId is required' });

  let noteBody = body;
  let formatsBuilt = [];

  if (useAi && file.ai_case_id) {
    try {
      const out = await aiStore.raiseNote(file.ai_case_id, stageId, {
        fields: fields || {},
        override: true,
        user: req.user
      });
      if (out.ok && out.result) {
        noteBody = out.result.fullOutput || out.result.newSection || noteBody;
        formatsBuilt = out.result.formatsBuilt || [];
      }
    } catch (err) {
      console.warn('AI raise error in cabinet generate-next-stage:', err);
    }
  }

  try {
    const note = addNote(file, me, {
      stageId,
      title: title || stageTitle(stageId),
      body: noteBody,
      classification,
      routingList
    });

    const today = nowISO();
    for (const fmt of formatsBuilt) {
      run(
        `INSERT INTO attachments(note_id, kind, name, ref, uploaded_by_id, created_at) VALUES(?, 'doc', ?, ?, ?, ?)`,
        note.id, `Annexure: ${fmt.format || fmt.id || 'Format'}`, JSON.stringify(fmt), me.id, today
      );
    }

    res.status(201).json({ note, txnId: note.txn_id });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/notes/:txnId/forward', action((note, me, b) => forward(note, me, Number(b.toMemberId), b.comment)));
router.post('/notes/:txnId/send-back', action((note, me, b) => sendBack(note, me, Number(b.toMemberId), b.comment)));
router.post('/notes/:txnId/retract', action((note, me) => retract(note, me)));
router.post('/notes/:txnId/decision', action((note, me, b) => decide(note, me, b.decision, b.comment)));
router.post('/notes/:txnId/retrieve', action((note, me) => retrieve(note, me)));

// The routing trail carries member names + comments — gated exactly like the note body
// (a bare link/txn id must reveal nothing about a restricted note).
router.get('/notes/:txnId/history', (req, res) => {
  const note = noteByTxn(req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!requireNoteAccess(req, res, note)) return;
  res.json({ history: history(note.id) });
});

export default router;
