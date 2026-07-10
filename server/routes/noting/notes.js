// Files & notes: initiate a file with its N1 (AI-drafted or standalone/manual),
// list files, view a note, edit the draft, and send it for a pre-routing check.
// Full member-to-member routing/inbox is Phase 2; this sets up the note + IDs.
import { Router } from 'express';
import { all, get, nowISO, run } from '../../noting/db.js';
import { currentMember } from '../../noting/identity.js';
import { deptCodeFor, nextFileId, nextTxnId, noteRefNo } from '../../noting/refs.js';
import { canView, openIfRecipient, participants, supervises } from '../../noting/workflow.js';
import { summarize } from '../../noting/summarize.js';

const router = Router();
const KINDS = ['MPR', 'CAR', 'SPR', 'CPR', 'standalone'];
const CLASSES = ['normal', 'confidential', 'secret', 'top_secret'];

// Initiate a new file + its first note (N1). Any HAL member can do this.
router.post('/files', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No noting member mapped to this account' });

  const { title, kind = 'CAR', carNo, source = 'manual', stageId, body = '', classification = 'normal' } = req.body || {};
  const noteTitle = (req.body?.noteTitle || '').trim() || 'Note Sheet (N1)';
  if (!title || !String(title).trim()) return res.status(422).json({ error: 'title is required' });
  if (!KINDS.includes(kind)) return res.status(422).json({ error: `kind must be one of ${KINDS.join(', ')}` });
  if (!CLASSES.includes(classification)) return res.status(422).json({ error: 'invalid classification' });

  const today = nowISO();
  const standalone = kind === 'standalone' ? 1 : 0;
  const fileId = nextFileId(deptCodeFor(me.section_id));
  const provStart = stageId === 'provisioning' ? today : null;

  const f = run(
    `INSERT INTO files(file_id,title,kind,car_no,standalone,initiator_id,initiator_unit_id,status,provisioning_start,created_at)
     VALUES(?,?,?,?,?,?,?, 'open', ?, ?)`,
    fileId, String(title).trim(), kind, standalone ? null : carNo || null, standalone,
    me.id, me.section_id, provStart, today
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

// List files with initiator, note count and latest note status. Restricted files are
// hidden from members outside their routing (need-to-know).
router.get('/files', (req, res) => {
  const me = currentMember(req);
  const files = all(
    `SELECT f.id, f.file_id, f.title, f.kind, f.car_no, f.standalone, f.status, f.created_at, f.initiator_unit_id,
            im.name AS initiator,
            (SELECT COUNT(*) FROM notes n WHERE n.file_pk = f.id) AS note_count,
            (SELECT n.classification FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS classification,
            (SELECT n.status FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS latest_status,
            (SELECT n.txn_id FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq ASC LIMIT 1) AS first_txn
     FROM files f LEFT JOIN members im ON im.id = f.initiator_id
     ORDER BY f.id DESC`
  );
  const visible = files.filter((f) => {
    if (f.classification === 'normal') return true;
    if (!me) return false;
    if (supervises(me, f.initiator_unit_id)) return true; // head sees subordinates' restricted files
    const noteId = get('SELECT id FROM notes WHERE file_pk = ? ORDER BY seq DESC LIMIT 1', f.id)?.id;
    return noteId ? participants(noteId).has(me.id) : false;
  });
  res.json({ files: visible });
});

// One note in full context (file + initiator + custodian), gated by classification.
router.get('/notes/:txnId', (req, res) => {
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  const me = currentMember(req);

  // Restricted access: routed members pass; others need a valid share link addressed to
  // them. A link presented by anyone else is a re-share leak — revoke it for both and
  // alert the custodian with the offending PB (email's anti-leak rule).
  if (!canView(note, me)) {
    const token = req.query.grant;
    const grant = token && get(`SELECT * FROM access_grants WHERE token = ? AND note_id = ? AND state = 'active'`, token, note.id);
    if (grant && me && grant.granted_to_id === me.id) {
      // authorised via a valid grant — fall through
    } else if (grant) {
      run(`UPDATE access_grants SET state = 'revoked', revoked_at = ?, revoke_reason = 'reshared' WHERE id = ?`, nowISO(), grant.id);
      run(
        `INSERT INTO access_alerts(note_id,grant_id,custodian_id,offender_pb,message,created_at) VALUES(?,?,?,?,?,?)`,
        note.id, grant.id, note.custodian_id, me?.pb || 'unknown',
        `Restricted note ${note.ref_no} link re-shared — access attempted by PB ${me?.pb || 'unknown'}. Grant revoked.`,
        nowISO()
      );
      return res.status(403).json({ error: 'Restricted note — this link was re-shared and has been revoked.' });
    } else {
      return res.status(403).json({ error: 'Restricted note — you are not a routed member.' });
    }
  }

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
  if (!canView(note, currentMember(req))) return res.status(403).json({ error: 'Not authorised for this note' });
  res.json({ summary: summarize(note.body) });
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
router.post('/notes/:txnId/send-check', (req, res) => {
  const me = currentMember(req);
  const note = get('SELECT * FROM notes WHERE txn_id = ?', req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
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
