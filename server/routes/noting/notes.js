// Files & notes: initiate a file with its N1 (AI-drafted or standalone/manual),
// list files, view a note, edit the draft, and send it for a pre-routing check.
// Full member-to-member routing/inbox is Phase 2; this sets up the note + IDs.
import { Router } from 'express';
import { all, get, nowISO, run } from '../../noting/db.js';
import { currentMember } from '../../noting/identity.js';
import { deptCodeFor, nextFileId, nextTxnId, noteRefNo } from '../../noting/refs.js';
import { addNote, canView, openIfRecipient } from '../../noting/workflow.js';
import { TENDERING_START_STAGE, VALID_STAGES } from '../../noting/stages.js';
import { summarize } from '../../noting/summarize.js';
import { requireNoteAccess } from './access.js';

const router = Router();
const KINDS = ['MPR', 'CAR', 'SPR', 'CPR', 'standalone'];
const CLASSES = ['normal', 'confidential', 'secret', 'top_secret'];

// Initiate a new file + its first note (N1). Any HAL member can do this.
router.post('/files', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });

  const { title, kind = 'CAR', carNo, source = 'manual', body = '', classification = 'normal', parentFileId = null, lineNo = null } = req.body || {};
  const stageId = (req.body?.stageId || '').trim() || null;
  const noteTitle = (req.body?.noteTitle || '').trim() || 'Note Sheet (N1)';
  if (!title || !String(title).trim()) return res.status(422).json({ error: 'title is required' });
  if (!KINDS.includes(kind)) return res.status(422).json({ error: `kind must be one of ${KINDS.join(', ')}` });
  if (!CLASSES.includes(classification)) return res.status(422).json({ error: 'invalid classification' });
  if (stageId && !VALID_STAGES.has(stageId)) return res.status(422).json({ error: `Unknown stage "${stageId}"` });
  if (parentFileId != null) {
    // The parent must exist AND be visible to the initiator — same message either way, so
    // a restricted file's numeric id cannot be probed via 404-vs-422.
    const parent = get('SELECT id FROM files WHERE id = ?', Number(parentFileId));
    const parentVisible = parent &&
      all('SELECT * FROM notes WHERE file_pk = ? ORDER BY seq DESC', parent.id).some((n) => canView(n, me));
    if (!parentVisible) return res.status(422).json({ error: 'Unknown parent file' });
  }

  const today = nowISO();
  const standalone = kind === 'standalone' ? 1 : 0;
  const fileId = nextFileId(deptCodeFor(me.section_id));
  const provStart = today; // every case's clock starts at initiation (live-status report)
  const tendStart = stageId === TENDERING_START_STAGE ? today : null;

  const f = run(
    `INSERT INTO files(file_id,title,kind,car_no,standalone,initiator_id,initiator_unit_id,parent_file_id,line_no,status,provisioning_start,tendering_start,created_at)
     VALUES(?,?,?,?,?,?,?,?,?, 'open', ?,?, ?)`,
    fileId, String(title).trim(), kind, standalone ? null : carNo || null, standalone,
    me.id, me.section_id, parentFileId != null ? Number(parentFileId) : null, lineNo || null, provStart, tendStart, today
  );
  const filePk = f.lastInsertRowid;

  const refNo = noteRefNo(fileId, 1);
  const txnId = nextTxnId();
  run(
    `INSERT INTO notes(file_pk,seq,ref_no,txn_id,title,stage_id,source,body,classification,status,initiator_id,custodian_id,created_at)
     VALUES(?,1,?,?,?,?,?,?,?, 'draft', ?, ?, ?)`,
    filePk, refNo, txnId, noteTitle, stageId || null, source === 'ai' ? 'ai' : 'manual',
    String(body || ''), classification, me.id, me.id, today
  );

  // PM (Purchase Manual) reference is attached automatically.
  const noteRow = get('SELECT * FROM notes WHERE txn_id = ?', txnId);
  run(
    `INSERT INTO attachments(note_id,kind,name,ref,uploaded_by_id,created_at) VALUES(?, 'pm', ?, ?, NULL, ?)`,
    noteRow.id, 'Purchase Manual Issue-4', 'PM/Issue-4', today
  );

  res.status(201).json({ fileId, filePk, note: noteRow });
});

// Add the next note (N2..final) to an existing open file — the multi-note lifecycle. Called
// from the Cabinet next-action prompt or the file view. Connected ref/txn continue the File ID.
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

// List files with initiator, note count and latest note status. Restricted files are
// hidden from members outside their routing (need-to-know). Visibility is graded per
// NOTE: the file is listed if ANY of its notes is viewable, and the status/classification
// shown come from the latest VIEWABLE note — so a later restricted note neither hides the
// case from an earlier note's routed members nor leaks its own metadata to outsiders.
router.get('/files', (req, res) => {
  const me = currentMember(req);
  const files = all(
    `SELECT f.id, f.file_id, f.title, f.kind, f.car_no, f.standalone, f.status, f.created_at, f.initiator_unit_id,
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

// One note in full context (file + initiator + custodian), gated by classification.
// Access (incl. the ?grant= link + anti-leak revocation) is resolved in ./access.js —
// the same rule guards the summary, attachments and history reads.
router.get('/notes/:txnId', (req, res) => {
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  const a = requireNoteAccess(req, res, note);
  if (!a) return;
  const me = a.me;

  // Viewing as the recipient locks the sender out of retracting it.
  openIfRecipient(note, me);
  const file = get('SELECT * FROM files WHERE id = ?', note.file_pk);
  const initiator = get('SELECT id, name, pb, designation FROM members WHERE id = ?', note.initiator_id);
  const custodian = get('SELECT id, name, pb, designation FROM members WHERE id = ?', note.custodian_id);
  res.json({ note, file, initiator, custodian });
});

// Auto proposal-summary — skim a note instead of reading it in full (Phase 7).
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

// Send the draft for a pre-routing check to a chosen member (not an approval).
// Draft-only: a routed/decided note can never be pulled back through the check channel.
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
