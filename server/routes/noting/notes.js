// Files & notes: initiate a file with its N1 (AI-drafted or standalone/manual),
// list files, view a note, edit the draft, and send it for a pre-routing check.
// Integrated with the Module F cascade: a file may link one AI case, whose notes are raised
// through this router so the stage-file guards run BEFORE the case advances.
import { Router } from 'express';
import { all, get, nowISO, run } from '../../noting/db.js';
import { currentMember } from '../../noting/identity.js';
import { deptCodeFor, nextFileId, nextTxnId, noteRefNo } from '../../noting/refs.js';
import {
  addNote, addNotingEntry, assertCanAddNote, canView, hooks, isCaseMember, notingEntries,
  openIfRecipient, proposalStatus
} from '../../noting/workflow.js';
import { STAGE_ORDER, stageTitle, startsTendering, VALID_STAGES } from '../../noting/stages.js';
import { get as reqGet } from '../../requisitions/db.js';
import { link as linkRequisition } from '../../requisitions/links.js';
import { summarize } from '../../noting/summarize.js';
import { proseToHtml } from '../../noting/html.js';
import { attachAnnexures } from '../../noting/annexures.js';
import { chainSummary, ensureChain } from '../../noting/approvalLink.js';
import { verify as verifyOtp } from '../../auth/otp.js';
import { requireNoteAccess } from './access.js';
import * as aiStore from '../../ai/caseStore.js';
import * as aiGraph from '../../ai/cascadeGraph.js';
import * as aiLoadInputs from '../../ai/loadInputs.js';

const router = Router();
const KINDS = ['MPR', 'CAR', 'SPR', 'CPR', 'standalone'];
const CLASSES = ['normal', 'restricted', 'confidential', 'secret', 'top_secret'];

// Rejecting an AI-drafted stage file withdraws the note from the AI case too, so the
// cascade returns to where it stood before that note was raised.
hooks.onReject = ({ note, file, me }) => {
  if (note?.source !== 'ai' || !file?.ai_case_id || !note.stage_id) return;
  aiStore.rollbackNote(file.ai_case_id, note.stage_id, { id: me?.pb, name: me?.name, role: me?.app_role });
};

const validSource = (id) => aiLoadInputs.availableCases().some((c) => c.id === id);

// Initiate a new file + its first note (N1). Any HAL member can do this.
router.post('/files', async (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });

  const {
    title,
    kind: kindBody = 'CAR',
    carNo: carNoBody,
    source = 'manual',
    sourceCase = 'nvb',
    body = '',
    classification = 'normal',
    priority = 'Medium',
    parentFileId = null,
    lineNo = null,
    fields = {},
    override = false,
    routingList = [],
    approverId = null,
    otp = null
  } = req.body || {};

  const stageId = (req.body?.stageId || '').trim() || (source === 'ai' ? 'provisioning' : null);
  const noteTitle = (req.body?.noteTitle || '').trim() || (source === 'ai' ? 'Provisioning Note (N1)' : stageId ? `${stageTitle(stageId)} (N1)` : 'Note Sheet (N1)');
  // A requisition from the register anchors the proposal: its kind and number become the file's.
  const requisitionId = req.body?.requisitionId != null && req.body.requisitionId !== '' ? Number(req.body.requisitionId) : null;
  let requisition = null;
  if (requisitionId != null) {
    requisition = Number.isInteger(requisitionId) ? reqGet('SELECT * FROM requisitions WHERE id = ?', requisitionId) : null;
    if (!requisition) return res.status(422).json({ error: 'Unknown requisition' });
    if (requisition.noting_file_pk) {
      return res.status(409).json({ error: `${requisition.req_no} already has a proposal file — add the next stage from its cabinet`, notingFilePk: requisition.noting_file_pk });
    }
  }
  const kind = requisition ? requisition.kind : kindBody;
  const carNo = requisition ? requisition.req_no : carNoBody;
  // Cascade stages after provisioning are generated from the approved previous stage in the
  // proposal's cabinet (assertCanAddNote), never as a fresh file.
  if (stageId && STAGE_ORDER.includes(stageId) && stageId !== 'provisioning') {
    return res.status(422).json({ error: `${stageTitle(stageId)} is generated from the approved previous stage in the proposal's cabinet, not as a new file` });
  }
  if (!title || !String(title).trim()) return res.status(422).json({ error: 'title is required' });
  if (!KINDS.includes(kind)) return res.status(422).json({ error: `kind must be one of ${KINDS.join(', ')}` });
  if (!CLASSES.includes(classification)) return res.status(422).json({ error: 'invalid classification' });
  if (stageId && !VALID_STAGES.has(stageId)) return res.status(422).json({ error: `Unknown stage "${stageId}"` });
  if (source === 'ai' && !validSource(sourceCase)) {
    return res.status(422).json({ error: `Unknown AI source case "${sourceCase}"`, sources: aiLoadInputs.availableCases() });
  }
  if (parentFileId != null) {
    const parent = get('SELECT id FROM files WHERE id = ?', Number(parentFileId));
    const parentVisible = parent &&
      all('SELECT * FROM notes WHERE file_pk = ? ORDER BY seq DESC', parent.id).some((n) => canView(n, me));
    if (!parentVisible) return res.status(422).json({ error: 'Unknown parent file' });
  }
  let otpAt = null;
  if (otp != null && String(otp).trim() !== '') {
    if (!verifyOtp(me.pb, otp)) return res.status(422).json({ error: 'Invalid one-time password' });
    otpAt = nowISO();
  }

  const today = nowISO();
  const standalone = kind === 'standalone' ? 1 : 0;
  const fileId = nextFileId(deptCodeFor(me.section_id));
  const provStart = today;
  const tendStart = startsTendering(stageId) ? today : null;
  const plan = Array.isArray(routingList) ? routingList.map((x) => Number(x && typeof x === 'object' ? x.id : x)).filter(Boolean) : [];
  const prio = ['High', 'Medium', 'Low'].includes(priority) ? priority : 'Medium';

  let aiCaseId = null;
  let noteBody = body;
  let bodyText = null;
  let formatsBuilt = [];

  // AI source: open the case and raise its provisioning note first. A refusal creates
  // nothing — the case is removed again and the caller is told to draft manually.
  if (source === 'ai') {
    const opened = aiStore.createCase({
      caseRef: standalone ? fileId : (carNo || fileId),
      title: String(title).trim(),
      sourceCase,
      user: req.user,
      requisitionId: requisition?.id ?? null
    });
    let raiseRes;
    try {
      raiseRes = await aiStore.raiseNote(opened.id, 'provisioning', {
        fields: fields || {}, override: Boolean(override), user: req.user
      });
    } catch (err) {
      raiseRes = { ok: false, code: 502, error: String(err?.message ?? err) };
    }
    if (!raiseRes.ok || raiseRes.skipped) {
      aiStore.deleteCase(opened.id);
      return res.status(raiseRes.code === 428 ? 428 : (raiseRes.code || 502)).json({
        error: raiseRes.error || 'The AI pipeline could not draft the provisioning note',
        needsOverride: raiseRes.needsOverride,
        advised: raiseRes.advised,
        hint: 'Nothing was created. Switch the note source to manual, or resolve the refusal and retry.'
      });
    }
    aiCaseId = opened.id;
    bodyText = raiseRes.result.fullOutput || raiseRes.result.newSection || '';
    noteBody = proseToHtml(bodyText);
    formatsBuilt = raiseRes.result.formatsBuilt || [];
  }

  const f = run(
    `INSERT INTO files(file_id,title,kind,car_no,standalone,initiator_id,initiator_unit_id,parent_file_id,line_no,ai_case_id,requisition_id,status,provisioning_start,tendering_start,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?, 'open', ?,?, ?)`,
    fileId, String(title).trim(), kind, standalone ? null : carNo || null, standalone,
    me.id, me.section_id, parentFileId != null ? Number(parentFileId) : null, lineNo || null, aiCaseId, requisition?.id ?? null, provStart, tendStart, today
  );
  const filePk = f.lastInsertRowid;
  if (aiCaseId) aiStore.linkNoting(aiCaseId, Number(filePk));
  if (requisition) linkRequisition(requisition.id, { noting_file_pk: Number(filePk), ai_case_id: aiCaseId }, { actor: me.name });

  const refNo = noteRefNo(fileId, 1);
  const txnId = nextTxnId();
  run(
    `INSERT INTO notes(file_pk,seq,ref_no,txn_id,title,stage_id,source,body,body_text,classification,status,initiator_id,custodian_id,stage_no,planned_routing,priority,approver_id,otp_verified_at,created_at)
     VALUES(?,1,?,?,?,?,?,?,?,?, 'draft', ?, ?, 1, ?, ?, ?, ?, ?)`,
    filePk, refNo, txnId, noteTitle, stageId || 'provisioning', source === 'ai' ? 'ai' : 'manual',
    String(noteBody || ''), bodyText, classification, me.id, me.id,
    plan.length ? JSON.stringify(plan) : null, prio,
    approverId ? Number(approverId) : (plan.at(-1) ?? null), otpAt, today
  );

  const noteRow = get('SELECT * FROM notes WHERE txn_id = ?', txnId);

  // Initialize N1 noting entry for this stage
  run(
    `INSERT INTO noting_entries(note_id,seq,author_id,title,body,entry_type,remark,created_at)
     VALUES(?, 1, ?, ?, ?, 'initial', 'Initial stage proposal', ?)`,
    noteRow.id, me.id, `N1: ${noteTitle}`, String(noteBody || ''), today
  );

  // PM (Purchase Manual) reference is attached automatically.
  run(
    `INSERT INTO attachments(note_id,kind,name,ref,uploaded_by_id,created_at) VALUES(?, 'pm', ?, ?, NULL, ?)`,
    noteRow.id, 'Purchase Manual Issue-4', 'PM/Issue-4', today
  );
  attachAnnexures(noteRow.id, formatsBuilt, me.id);
  // Stages the DOP requires an internal approval chain for get it planned now (Module E).
  ensureChain(noteRow, get('SELECT * FROM files WHERE id = ?', filePk), me, req.user);

  res.status(201).json({ fileId, filePk, note: noteRow, aiCaseId, requisitionId: requisition?.id ?? null, approvalChainId: noteRow.approval_chain_id ?? null });
});

// Add the next note (stage) to an existing open file.
router.post('/files/:filePk/notes', (req, res) => {
  const me = currentMember(req);
  const file = get('SELECT * FROM files WHERE id = ?', Number(req.params.filePk));
  if (!file) return res.status(404).json({ error: 'File not found' });
  const {
    stageId = null, title, body = '', classification = 'normal', routingList = null,
    priority = 'Medium', approverId = null
  } = req.body || {};
  if (!CLASSES.includes(classification)) return res.status(422).json({ error: 'invalid classification' });
  try {
    res.status(201).json({ note: addNote(file, me, { stageId, title, body, classification, routingList, priority, approverId }) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// List proposals with initiator, tender initiator, stage count and the current (latest
// visible) stage — its status and who holds it.
router.get('/files', (req, res) => {
  const me = currentMember(req);
  const files = all(
    `SELECT f.id, f.file_id, f.title, f.kind, f.car_no, f.standalone, f.ai_case_id, f.requisition_id, f.status, f.created_at, f.initiator_unit_id,
            im.name AS initiator, tim.name AS tender_initiator,
            (SELECT COUNT(*) FROM notes n WHERE n.file_pk = f.id) AS note_count,
            (SELECT n.txn_id FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq ASC LIMIT 1) AS first_txn
     FROM files f LEFT JOIN members im ON im.id = f.initiator_id
     LEFT JOIN members tim ON tim.id = f.tender_initiator_id
     ORDER BY f.id DESC`
  );
  const visible = [];
  for (const f of files) {
    const shown = all('SELECT * FROM notes WHERE file_pk = ? ORDER BY seq DESC', f.id).find((n) => canView(n, me));
    if (!shown) continue;
    const holding = ['draft', 'in_check', 'routed'].includes(shown.status);
    visible.push({
      ...f,
      classification: shown.classification,
      latest_status: shown.status,
      current_stage: `S${shown.seq} · ${shown.stage_id ? stageTitle(shown.stage_id) : shown.title}`,
      pending_with: holding ? get('SELECT name FROM members WHERE id = ?', shown.custodian_id)?.name ?? null : null
    });
  }
  res.json({ files: visible });
});

// One note in full context, including all stage notes and sequential entries N1..Nx
router.get('/notes/:txnId', (req, res) => {
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  const a = requireNoteAccess(req, res, note);
  if (!a) return;
  const me = a.me;

  openIfRecipient(note, me);
  const file = get('SELECT * FROM files WHERE id = ?', note.file_pk);
  const initiator = get('SELECT id, name, pb, designation FROM members WHERE id = ?', note.initiator_id);
  const custodian = get('SELECT id, name, pb, designation FROM members WHERE id = ?', note.custodian_id);
  const approver = note.approver_id ? get('SELECT id, name, pb, designation FROM members WHERE id = ?', note.approver_id) : null;

  // Ensure noting_entries has at least N1
  let entries = notingEntries(note.id);
  if (entries.length === 0 && note.body) {
    run(
      `INSERT INTO noting_entries(note_id,seq,author_id,title,body,entry_type,remark,created_at)
       VALUES(?, 1, ?, ?, ?, 'initial', 'Initial stage note', ?)`,
      note.id, note.initiator_id || me.id, `N1: ${note.title}`, note.body, note.created_at || nowISO()
    );
    entries = notingEntries(note.id);
  }

  // All stage notes on this file visible to this user
  const allNotes = all(
    `SELECT n.id, n.seq, n.ref_no, n.txn_id, n.title, n.stage_id, n.source, n.classification, n.status, n.created_at, n.stage_no,
            (SELECT COUNT(*) FROM noting_entries ne WHERE ne.note_id = n.id) AS entry_count
     FROM notes n WHERE file_pk = ? ORDER BY n.seq ASC`,
    file.id
  ).filter((n) => canView(n, me));

  let plannedRouting = [];
  try {
    if (note.planned_routing) plannedRouting = JSON.parse(note.planned_routing);
  } catch {}

  res.json({
    note,
    file,
    initiator,
    custodian,
    approver,
    approvalChain: chainSummary(note),
    allNotes,
    entries,
    plannedRouting,
    proposal: proposalStatus(file, me),
    aiCaseId: file.ai_case_id
  });
});

// Explicitly append an N-note minute/entry (N2, N3... Nx) to this stage
router.post('/notes/:txnId/entries', (req, res) => {
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  const a = requireNoteAccess(req, res, note);
  if (!a) return;
  const me = a.me;
  const { title, body, entryType = 'remark', remark } = req.body || {};
  try {
    const entry = addNotingEntry(note, me, { title, body, entryType, remark });
    res.status(201).json({ entry });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

const cascadeMeta = () => ({
  start: aiGraph.START,
  stages: aiGraph.STAGE_META,
  nodes: aiGraph.CASCADE_NODES,
  postTenderFormats: aiGraph.POST_TENDER_FORMATS,
  checklist: aiGraph.CHECKLIST
});

// AI Cascade status for this note & file. Read-only: an unlinked file says so and lists
// the source cases it could be linked to (POST /notes/:txnId/ai-link).
router.get('/notes/:txnId/ai-cascade', (req, res) => {
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  const a = requireNoteAccess(req, res, note);
  if (!a) return;

  const file = get('SELECT * FROM files WHERE id = ?', note.file_pk);
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (!file.ai_case_id) {
    return res.json({
      ok: true, linked: false, case: null, cascadeMeta: cascadeMeta(),
      sources: aiLoadInputs.availableCases(),
      canLink: isCaseMember(file, a.me)
    });
  }
  res.json({ ok: true, linked: true, case: aiStore.loadCase(file.ai_case_id, req.user), cascadeMeta: cascadeMeta() });
});

// Link an AI case to this file (creates it from a named source case). Owners and routed
// members only; a file links exactly one case.
router.post('/notes/:txnId/ai-link', (req, res) => {
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  const a = requireNoteAccess(req, res, note);
  if (!a) return;
  const file = get('SELECT * FROM files WHERE id = ?', note.file_pk);
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (file.ai_case_id) return res.status(409).json({ error: 'This file already has an AI case linked', aiCaseId: file.ai_case_id });
  if (!isCaseMember(file, a.me)) return res.status(403).json({ error: 'Only a member of this case can link an AI case' });
  const sourceCase = String(req.body?.sourceCase || 'nvb');
  if (!validSource(sourceCase)) return res.status(422).json({ error: `Unknown AI source case "${sourceCase}"`, sources: aiLoadInputs.availableCases() });
  const created = aiStore.createCase({ caseRef: file.car_no || file.file_id, title: file.title, sourceCase, user: req.user });
  run('UPDATE files SET ai_case_id = ? WHERE id = ?', created.id, file.id);
  aiStore.linkNoting(created.id, file.id);
  res.status(201).json({ ok: true, linked: true, case: aiStore.loadCase(created.id, req.user), cascadeMeta: cascadeMeta() });
});

// AI form pre-fill for a specific note in the cascade
router.get('/notes/:txnId/ai-form/:noteId', (req, res) => {
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!requireNoteAccess(req, res, note)) return;

  const file = get('SELECT * FROM files WHERE id = ?', note.file_pk);
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (!file.ai_case_id) return res.status(409).json({ error: 'No AI case is linked to this file — link one first', linked: false });

  const form = aiStore.noteForm(file.ai_case_id, req.params.noteId);
  return form.ok ? res.json(form) : res.status(422).json({ error: form.error });
});

// Raise a new AI note in the cascade and append it to this E-File
router.post('/notes/:txnId/ai-raise', async (req, res) => {
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  const a = requireNoteAccess(req, res, note);
  if (!a) return;
  const me = a.me;

  const file = get('SELECT * FROM files WHERE id = ?', note.file_pk);
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (!file.ai_case_id) return res.status(409).json({ error: 'No AI case is linked to this file — link one first', linked: false });

  const { noteId, fields = {}, override = false, routingList = null, priority = 'Medium', approverId = null } = req.body || {};
  if (!noteId) return res.status(422).json({ error: 'noteId is required' });
  // Check the stage-file guards before the AI case advances, so a refused note never moves the cascade.
  try {
    assertCanAddNote(file, me, noteId);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const out = await aiStore.raiseNote(file.ai_case_id, noteId, {
    fields: fields || {},
    override: Boolean(override),
    user: req.user
  });

  if (!out.ok) {
    return res.status(out.code || 422).json({
      error: out.error,
      needsOverride: out.needsOverride,
      advised: out.advised
    });
  }

  if (out.skipped) {
    return res.json({ ok: true, skipped: true, branch: out.branch, case: out.kase });
  }

  const stageMeta = aiGraph.STAGE_META[noteId] || {};
  const noteTitle = stageMeta.title || out.result?.title || noteId;
  const bodyText = out.result?.fullOutput || out.result?.newSection || '';

  // Add the generated note to the file
  let newNote;
  try {
    newNote = addNote(file, me, {
      stageId: noteId,
      title: noteTitle,
      body: proseToHtml(bodyText),
      bodyText,
      classification: note.classification || 'normal',
      routingList,
      priority,
      approverId,
      source: 'ai'
    });
  } catch (err) {
    // The stage file could not be created after all: withdraw the AI note so the two stores agree.
    aiStore.rollbackNote(file.ai_case_id, noteId, req.user);
    return res.status(err.status || 500).json({ error: err.message });
  }

  attachAnnexures(newNote.id, out.result?.formatsBuilt || [], me.id);

  res.json({
    ok: true,
    note: newNote,
    txnId: newNote.txn_id,
    result: out.result,
    handoverNeeded: out.handoverNeeded,
    case: out.kase
  });
});

// Hand over custody of the file between Indenting & Tendering agencies
router.post('/notes/:txnId/ai-handover', (req, res) => {
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!requireNoteAccess(req, res, note)) return;

  const file = get('SELECT * FROM files WHERE id = ?', note.file_pk);
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (!file.ai_case_id) return res.status(422).json({ error: 'No AI case linked to this file' });

  const out = aiStore.handOver(file.ai_case_id, {
    user: req.user,
    toAgency: req.body?.toAgency || null
  });

  return out.ok ? res.json({ ok: true, case: out.kase }) : res.status(out.code || 422).json({ error: out.error });
});

// Auto proposal-summary
router.get('/notes/:txnId/summary', (req, res) => {
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!requireNoteAccess(req, res, note)) return;
  const file = get('SELECT * FROM files WHERE id = ?', note.file_pk);
  const custodian = get('SELECT name FROM members WHERE id = ?', note.custodian_id);
  res.json({ summary: summarize(note, file, custodian) });
});

// Edit the draft — only the custodian, only while still a draft.
router.post('/notes/:txnId/draft', (req, res) => {
  const me = currentMember(req);
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.status !== 'draft') return res.status(409).json({ error: `Note is ${note.status}, not a draft` });
  if (!me || note.custodian_id !== me.id) return res.status(403).json({ error: 'Only the draft holder can edit' });

  const { title, body, classification } = req.body || {};
  if (classification && !CLASSES.includes(classification)) return res.status(422).json({ error: 'invalid classification' });
  run(
    `UPDATE notes SET title = COALESCE(?, title), body = COALESCE(?, body), classification = COALESCE(?, classification) WHERE id = ?`,
    title ?? null, body ?? null, classification ?? null, note.id
  );
  res.json({ note: get('SELECT * FROM notes WHERE id = ?', note.id) });
});

// Send the draft for a pre-routing check to a chosen member.
router.post('/notes/:txnId/send-check', (req, res) => {
  const me = currentMember(req);
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.status !== 'draft') return res.status(409).json({ error: `Note is ${note.status} — only a draft can be sent for check` });
  if (!me || note.custodian_id !== me.id) return res.status(403).json({ error: 'Only the current holder can send for check' });

  const toId = Number(req.body?.toMemberId);
  if (!toId || toId === me.id) return res.status(422).json({ error: 'Choose a different member to check the draft' });
  if (!get('SELECT id FROM members WHERE id = ?', toId)) return res.status(422).json({ error: 'Unknown member' });

  const seq = (get('SELECT MAX(seq) AS m FROM routing_steps WHERE note_id = ?', note.id).m || 0) + 1;
  run(
    `INSERT INTO routing_steps(note_id,seq,from_member_id,to_member_id,purpose,state,action,comment,sent_at)
     VALUES(?,?,?,?, 'check', 'sent', 'forward', ?, ?)`,
    note.id, seq, me.id, toId, (req.body?.comment || '').trim() || null, nowISO()
  );
  run(`UPDATE notes SET status = 'in_check', custodian_id = ? WHERE id = ?`, toId, note.id);
  res.json({ note: get('SELECT * FROM notes WHERE id = ?', note.id) });
});

export default router;
