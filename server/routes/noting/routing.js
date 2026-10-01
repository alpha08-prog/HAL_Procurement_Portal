// Routing spine: per-member inbox & cabinet, the hand-off actions (forward / send back /
// retract / approve-reject / retrieve) + routing history, and the proposal flow around them:
// provisioning → tender-initiator hand-over and next stage files. The inbox also lists what
// the member holds as a delegate.
import { Router } from 'express';
import { all, get } from '../../noting/db.js';
import { currentMember } from '../../noting/identity.js';
import { stageTitle } from '../../noting/stages.js';
import { activeDelegatorsOf } from '../../noting/delegation.js';
import { proseToHtml } from '../../noting/html.js';
import { attachAnnexures } from '../../noting/annexures.js';
import {
  addNote, assertCanAddNote, decide, fileStageHistory, forward, handOverToTender, history, noteByTxn,
  proposalStatus, retract, retrieve, sendBack
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
      res.status(e.status || 500).json({ error: e.message, ...(e.details || {}) });
    }
  };
}

const fileByPk = (req) => get('SELECT * FROM files WHERE id = ?', Number(req.params.filePk));

// Notes sitting with `holderId` and awaiting action.
function heldBy(holderId) {
  return all(
    `SELECT n.txn_id, n.ref_no, n.title, n.body, n.status, n.classification, n.created_at,
            COALESCE(n.priority, 'Medium') AS priority, n.stage_id, n.custodian_id,
            f.file_id, f.title AS file_title, f.kind, f.standalone, im.name AS initiator_name,
            u.name AS department,
            (SELECT COUNT(*) FROM clarifications c WHERE c.note_id = n.id AND c.status = 'open') AS open_clarifications,
            (SELECT COUNT(*) FROM clarifications c WHERE c.note_id = n.id) AS total_clarifications,
            (SELECT rs.purpose FROM routing_steps rs WHERE rs.note_id = n.id AND rs.to_member_id = ? ORDER BY rs.seq DESC LIMIT 1) AS incoming_purpose,
            (SELECT rs.state   FROM routing_steps rs WHERE rs.note_id = n.id AND rs.to_member_id = ? ORDER BY rs.seq DESC LIMIT 1) AS incoming_state
     FROM notes n
     JOIN files f ON f.id = n.file_pk
     LEFT JOIN members im ON im.id = n.initiator_id
     LEFT JOIN org_units u ON u.id = im.section_id
     WHERE n.custodian_id = ? AND n.status IN ('draft','in_check','routed')
     ORDER BY n.created_at DESC`,
    holderId, holderId, holderId
  );
}

// Everything currently sitting with me — plus what I hold as somebody's active delegate.
router.get('/inbox', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });
  const mine = heldBy(me.id).map((r) => ({ ...r, delegated: false }));
  const delegated = [];
  for (const fromId of activeDelegatorsOf(me.id)) {
    const from = get('SELECT name FROM members WHERE id = ?', fromId);
    for (const r of heldBy(fromId)) delegated.push({ ...r, delegated: true, on_behalf_of_id: fromId, on_behalf_of_name: from?.name ?? null });
  }
  res.json({ inbox: [...mine, ...delegated], meId: me.id });
});

// Closed stage files resting in my cabinet — one row per stage file I initiated, routed,
// decided or received as tender initiator. Each row carries its proposal's live status; the
// next-stage prompt belongs to the row whose stage is the proposal's latest (`is_latest`).
router.get('/cabinet', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });
  const rows = all(
    `SELECT c.reason, c.placed_at, f.id AS file_pk, f.file_id, f.title, f.kind, f.car_no, f.standalone,
            f.status AS file_status, im.name AS initiator_name,
            n.seq, n.ref_no, n.txn_id, n.stage_id, n.title AS note_title, n.status, n.classification,
            (SELECT COUNT(*) FROM noting_entries ne WHERE ne.note_id = n.id) AS entry_count
     FROM cabinet c
     JOIN files f ON f.id = c.file_pk
     JOIN notes n ON n.id = COALESCE(c.note_id, (SELECT id FROM notes WHERE file_pk = f.id ORDER BY seq DESC LIMIT 1))
     LEFT JOIN members im ON im.id = f.initiator_id
     WHERE c.member_id = ?
     ORDER BY c.placed_at DESC, n.id DESC`,
    me.id
  );
  const proposals = new Map();
  const cabinet = rows.map((r) => {
    if (!proposals.has(r.file_pk)) proposals.set(r.file_pk, proposalStatus(get('SELECT * FROM files WHERE id = ?', r.file_pk), me));
    const proposal = proposals.get(r.file_pk);
    return { ...r, stage_title: stageTitle(r.stage_id), is_latest: proposal.current?.seq === r.seq, proposal };
  });
  res.json({ cabinet, meId: me.id });
});

// Full stage history for a proposal in the cabinet (stage files the caller may read).
router.get('/cabinet/:filePk/stage-history', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });
  const file = fileByPk(req);
  if (!file) return res.status(404).json({ error: 'File not found' });
  res.json({ file, stages: fileStageHistory(file.id, me) });
});

// Send the approved provisioning to the member who will initiate the tender.
router.post('/files/:filePk/tender-initiator', (req, res) => {
  const me = currentMember(req);
  const file = fileByPk(req);
  if (!file) return res.status(404).json({ error: 'File not found' });
  try {
    const updated = handOverToTender(file, me, Number(req.body?.memberId));
    res.json({ file: updated, proposal: proposalStatus(updated, me) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Generate the next stage file from the cabinet with its configured routing trail. With
// useAi the linked AI case drafts it; a refusal there creates nothing.
router.post('/cabinet/:filePk/generate-next-stage', async (req, res) => {
  const me = currentMember(req);
  const file = fileByPk(req);
  if (!file) return res.status(404).json({ error: 'File not found' });

  const {
    stageId, title, body = '', classification = 'normal', routingList = [], fields = {},
    useAi = false, override = false, priority = 'Medium', approverId = null
  } = req.body || {};
  if (!stageId) return res.status(422).json({ error: 'stageId is required' });
  try {
    assertCanAddNote(file, me, stageId);
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }

  let noteBody = body;
  let bodyText = null;
  let formatsBuilt = [];
  let source = 'manual';

  if (useAi) {
    if (!file.ai_case_id) {
      return res.status(409).json({ error: 'No AI case is linked to this file — link one from the note before drafting with AI', linked: false });
    }
    let out;
    try {
      out = await aiStore.raiseNote(file.ai_case_id, stageId, { fields: fields || {}, override: Boolean(override), user: req.user });
    } catch (err) {
      out = { ok: false, code: 502, error: String(err?.message ?? err) };
    }
    if (!out.ok) {
      return res.status(out.code === 428 ? 428 : (out.code || 502)).json({
        error: out.error, needsOverride: out.needsOverride, advised: out.advised,
        hint: 'Nothing was created. Draft the stage manually, or resolve the refusal and retry.'
      });
    }
    if (out.skipped) {
      return res.status(409).json({ error: `${stageTitle(stageId)} was skipped — rule ${out.branch?.rule}() came out false for this case`, skipped: true });
    }
    bodyText = out.result?.fullOutput || out.result?.newSection || '';
    noteBody = proseToHtml(bodyText);
    formatsBuilt = out.result?.formatsBuilt || [];
    source = 'ai';
  }

  try {
    const note = addNote(file, me, {
      stageId,
      title: title || stageTitle(stageId),
      body: noteBody,
      bodyText,
      classification,
      routingList,
      priority,
      approverId,
      source
    });
    attachAnnexures(note.id, formatsBuilt, me.id);
    res.status(201).json({ note, txnId: note.txn_id });
  } catch (err) {
    if (source === 'ai') aiStore.rollbackNote(file.ai_case_id, stageId, req.user);
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/notes/:txnId/forward', action((note, me, b) =>
  forward(note, me, Number(b.toMemberId), b.comment, { deviate: Boolean(b.deviate), reason: b.reason || '' })));
router.post('/notes/:txnId/send-back', action((note, me, b) => sendBack(note, me, Number(b.toMemberId), b.comment)));
router.post('/notes/:txnId/retract', action((note, me) => retract(note, me)));
router.post('/notes/:txnId/decision', action((note, me, b) => decide(note, me, b.decision, b.comment, { otp: b.otp ?? null })));
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
