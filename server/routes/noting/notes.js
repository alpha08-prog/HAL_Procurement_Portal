// Files & notes: initiate a file with its N1 (AI-drafted or standalone/manual),
// list files, view a note, edit the draft, and send it for a pre-routing check.
// Integrated with Module F AI responsibility cascade pipeline.
import { Router } from 'express';
import { all, get, nowISO, run } from '../../noting/db.js';
import { currentMember } from '../../noting/identity.js';
import { deptCodeFor, nextFileId, nextTxnId, noteRefNo } from '../../noting/refs.js';
import { addNote, canView, openIfRecipient } from '../../noting/workflow.js';
import { TENDERING_START_STAGE, VALID_STAGES } from '../../noting/stages.js';
import { summarize } from '../../noting/summarize.js';
import { requireNoteAccess } from './access.js';
import * as aiStore from '../../ai/caseStore.js';
import * as aiGraph from '../../ai/cascadeGraph.js';
import * as aiPipeline from '../../ai/pipeline.js';
import * as aiLoadInputs from '../../ai/loadInputs.js';

const router = Router();
const KINDS = ['MPR', 'CAR', 'SPR', 'CPR', 'standalone'];
const CLASSES = ['normal', 'restricted', 'confidential', 'secret', 'top_secret'];

const formatProseToHtml = (text) => {
  if (!text) return '<p></p>';
  return text
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
    .join('');
};

// Initiate a new file + its first note (N1). Any HAL member can do this.
router.post('/files', async (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });

  const {
    title,
    kind = 'CAR',
    carNo,
    source = 'manual',
    sourceCase = 'nvb',
    body = '',
    classification = 'normal',
    parentFileId = null,
    lineNo = null,
    fields = {}
  } = req.body || {};

  const stageId = (req.body?.stageId || '').trim() || (source === 'ai' ? 'provisioning' : null);
  const noteTitle = (req.body?.noteTitle || '').trim() || (source === 'ai' ? 'Provisioning Note (N1)' : 'Note Sheet (N1)');
  if (!title || !String(title).trim()) return res.status(422).json({ error: 'title is required' });
  if (!KINDS.includes(kind)) return res.status(422).json({ error: `kind must be one of ${KINDS.join(', ')}` });
  if (!CLASSES.includes(classification)) return res.status(422).json({ error: 'invalid classification' });
  if (stageId && !VALID_STAGES.has(stageId)) return res.status(422).json({ error: `Unknown stage "${stageId}"` });
  if (parentFileId != null) {
    const parent = get('SELECT id FROM files WHERE id = ?', Number(parentFileId));
    const parentVisible = parent &&
      all('SELECT * FROM notes WHERE file_pk = ? ORDER BY seq DESC', parent.id).some((n) => canView(n, me));
    if (!parentVisible) return res.status(422).json({ error: 'Unknown parent file' });
  }

  const today = nowISO();
  const standalone = kind === 'standalone' ? 1 : 0;
  const fileId = nextFileId(deptCodeFor(me.section_id));
  const provStart = today;
  const tendStart = stageId === TENDERING_START_STAGE ? today : null;

  let aiCaseId = null;
  let noteBody = body;
  let formatsBuilt = [];

  // If source is AI, open an AI case and generate N1 provisioning note via pipeline
  if (source === 'ai') {
    try {
      const opened = aiStore.createCase({
        caseRef: standalone ? fileId : carNo || 'CAR/25/229',
        title: String(title).trim(),
        sourceCase: sourceCase || 'nvb',
        user: req.user
      });
      aiCaseId = opened.id;

      // Raise the provisioning note to advance the cascade to tender_opened
      const raiseRes = await aiStore.raiseNote(aiCaseId, 'provisioning', {
        fields: fields || {},
        override: true,
        user: req.user
      });

      if (raiseRes.ok && raiseRes.result) {
        noteBody = formatProseToHtml(raiseRes.result.fullOutput || raiseRes.result.newSection);
        formatsBuilt = raiseRes.result.formatsBuilt || [];
      }
    } catch (err) {
      console.warn('AI pipeline initialization error during initiateFile:', err);
    }
  }

  const f = run(
    `INSERT INTO files(file_id,title,kind,car_no,standalone,initiator_id,initiator_unit_id,parent_file_id,line_no,ai_case_id,status,provisioning_start,tendering_start,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?, 'open', ?,?, ?)`,
    fileId, String(title).trim(), kind, standalone ? null : carNo || null, standalone,
    me.id, me.section_id, parentFileId != null ? Number(parentFileId) : null, lineNo || null, aiCaseId, provStart, tendStart, today
  );
  const filePk = f.lastInsertRowid;

  const refNo = noteRefNo(fileId, 1);
  const txnId = nextTxnId();
  run(
    `INSERT INTO notes(file_pk,seq,ref_no,txn_id,title,stage_id,source,body,classification,status,initiator_id,custodian_id,created_at)
     VALUES(?,1,?,?,?,?,?,?,?, 'draft', ?, ?, ?)`,
    filePk, refNo, txnId, noteTitle, stageId || 'provisioning', source === 'ai' ? 'ai' : 'manual',
    String(noteBody || ''), classification, me.id, me.id, today
  );

  const noteRow = get('SELECT * FROM notes WHERE txn_id = ?', txnId);

  // PM (Purchase Manual) reference is attached automatically.
  run(
    `INSERT INTO attachments(note_id,kind,name,ref,uploaded_by_id,created_at) VALUES(?, 'pm', ?, ?, NULL, ?)`,
    noteRow.id, 'Purchase Manual Issue-4', 'PM/Issue-4', today
  );

  // If deterministic formats were built by the AI pipeline (e.g. MPR/CAR format), attach them
  for (const fmt of formatsBuilt) {
    run(
      `INSERT INTO attachments(note_id,kind,name,ref,uploaded_by_id,created_at) VALUES(?, 'doc', ?, ?, ?, ?)`,
      noteRow.id, `Annexure: ${fmt.format || fmt.id || 'MPR/CAR Format'}`, JSON.stringify(fmt), me.id, today
    );
  }

  res.status(201).json({ fileId, filePk, note: noteRow, aiCaseId });
});

// Add the next note (N2..final) to an existing open file.
router.post('/files/:filePk/notes', (req, res) => {
  const me = currentMember(req);
  const file = get('SELECT * FROM files WHERE id = ?', Number(req.params.filePk));
  if (!file) return res.status(404).json({ error: 'File not found' });
  const { stageId = null, title, body = '', classification = 'normal' } = req.body || {};
  if (!CLASSES.includes(classification)) return res.status(422).json({ error: 'invalid classification' });
  try {
    res.status(201).json({ note: addNote(file, me, { stageId, title, body, classification }) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// List files with initiator, note count and latest note status.
router.get('/files', (req, res) => {
  const me = currentMember(req);
  const files = all(
    `SELECT f.id, f.file_id, f.title, f.kind, f.car_no, f.standalone, f.ai_case_id, f.status, f.created_at, f.initiator_unit_id,
            im.name AS initiator,
            (SELECT COUNT(*) FROM notes n WHERE n.file_pk = f.id) AS note_count,
            (SELECT n.txn_id FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq ASC LIMIT 1) AS first_txn
     FROM files f LEFT JOIN members im ON im.id = f.initiator_id
     ORDER BY f.id DESC`
  );
  const visible = [];
  for (const f of files) {
    const shown = all('SELECT * FROM notes WHERE file_pk = ? ORDER BY seq DESC', f.id).find((n) => canView(n, me));
    if (!shown) continue;
    visible.push({ ...f, classification: shown.classification, latest_status: shown.status });
  }
  res.json({ files: visible });
});

// One note in full context, including all notes on this file for easy tab switching.
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

  // All notes on this file visible to this user
  const allNotes = all(
    `SELECT id, seq, ref_no, txn_id, title, stage_id, source, classification, status, created_at
     FROM notes WHERE file_pk = ? ORDER BY seq ASC`,
    file.id
  ).filter((n) => canView(n, me));

  res.json({ note, file, initiator, custodian, allNotes, aiCaseId: file.ai_case_id });
});

// AI Cascade status for this note & file
router.get('/notes/:txnId/ai-cascade', (req, res) => {
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  const a = requireNoteAccess(req, res, note);
  if (!a) return;

  const file = get('SELECT * FROM files WHERE id = ?', note.file_pk);
  if (!file) return res.status(404).json({ error: 'File not found' });

  let caseId = file.ai_case_id;
  if (!caseId) {
    // Lazily create and link an AI case
    const created = aiStore.createCase({
      caseRef: file.car_no || file.file_id,
      title: file.title,
      sourceCase: 'nvb',
      user: req.user
    });
    caseId = created.id;
    run('UPDATE files SET ai_case_id = ? WHERE id = ?', caseId, file.id);
  }

  const loaded = aiStore.loadCase(caseId, req.user);
  res.json({
    ok: true,
    case: loaded,
    cascadeMeta: {
      start: aiGraph.START,
      stages: aiGraph.STAGE_META,
      nodes: aiGraph.CASCADE_NODES,
      postTenderFormats: aiGraph.POST_TENDER_FORMATS,
      checklist: aiGraph.CHECKLIST
    }
  });
});

// AI form pre-fill for a specific note in the cascade
router.get('/notes/:txnId/ai-form/:noteId', (req, res) => {
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!requireNoteAccess(req, res, note)) return;

  const file = get('SELECT * FROM files WHERE id = ?', note.file_pk);
  if (!file) return res.status(404).json({ error: 'File not found' });

  let caseId = file.ai_case_id;
  if (!caseId) {
    const created = aiStore.createCase({
      caseRef: file.car_no || file.file_id,
      title: file.title,
      sourceCase: 'nvb',
      user: req.user
    });
    caseId = created.id;
    run('UPDATE files SET ai_case_id = ? WHERE id = ?', caseId, file.id);
  }

  const form = aiStore.noteForm(caseId, req.params.noteId);
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

  let caseId = file.ai_case_id;
  if (!caseId) {
    const created = aiStore.createCase({
      caseRef: file.car_no || file.file_id,
      title: file.title,
      sourceCase: 'nvb',
      user: req.user
    });
    caseId = created.id;
    run('UPDATE files SET ai_case_id = ? WHERE id = ?', caseId, file.id);
  }

  const { noteId, fields = {}, override = false } = req.body || {};
  if (!noteId) return res.status(422).json({ error: 'noteId is required' });

  const out = await aiStore.raiseNote(caseId, noteId, {
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
    return res.json({
      ok: true,
      skipped: true,
      branch: out.branch,
      case: out.kase
    });
  }

  const stageMeta = aiGraph.STAGE_META[noteId] || {};
  const noteTitle = stageMeta.title || out.result?.title || noteId;
  const bodyHtml = formatProseToHtml(out.result?.fullOutput || out.result?.newSection);

  // Add the generated note to the file
  let newNote;
  try {
    newNote = addNote(file, me, {
      stageId: noteId,
      title: noteTitle,
      body: bodyHtml,
      classification: note.classification || 'normal'
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  // Attach all computed annexures/formats
  const today = nowISO();
  for (const fmt of out.result?.formatsBuilt || []) {
    run(
      `INSERT INTO attachments(note_id, kind, name, ref, uploaded_by_id, created_at) VALUES(?, 'doc', ?, ?, ?, ?)`,
      newNote.id,
      `Annexure: ${fmt.format || fmt.id || 'Format'}`,
      JSON.stringify(fmt),
      me.id,
      today
    );
  }

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

