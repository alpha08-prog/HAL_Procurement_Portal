// Dynamic routing engine for notes — the user-driven counterpart to Module A's fixed
// payment state machine. The actor is always the real signed-in member (never a role),
// and the recipient is chosen at runtime. Each hand-off appends a routing_steps row.
import { all, get, nowISO, run } from './db.js';
import { nextTxnId, noteRefNo } from './refs.js';
import { nextStage, stageTitle, TENDERING_START_STAGE, VALID_STAGES } from './stages.js';

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

const active = new Set(['draft', 'in_check', 'routed']);

// Email rule: an empty comment — or one that is just symbols ("." "," "*" …) — becomes
// the auto comment at send time. Anything with at least one letter/digit stands as written.
export const normComment = (comment, fallback) => {
  const c = (comment || '').trim();
  return c.replace(/[^\p{L}\p{N}]/gu, '') === '' ? fallback : c;
};

export function noteByTxn(txnId) {
  return get('SELECT * FROM notes WHERE txn_id = ?', txnId);
}

// Everyone who has ever held or received the note (+ its initiator) — the "routed members".
export function participants(noteId) {
  const note = get('SELECT initiator_id FROM notes WHERE id = ?', noteId);
  const ids = new Set([note?.initiator_id].filter(Boolean));
  for (const s of all('SELECT from_member_id, to_member_id FROM routing_steps WHERE note_id = ?', noteId)) {
    if (s.from_member_id) ids.add(s.from_member_id);
    ids.add(s.to_member_id);
  }
  return ids;
}

export const isParticipant = (noteId, memberId) => participants(noteId).has(memberId);

// Members the note has already passed through — the initiator plus everyone who has sent it
// onward. Send-back is only allowed to one of these (email: "to user or previous member").
export function priorHolders(noteId) {
  const note = get('SELECT initiator_id FROM notes WHERE id = ?', noteId);
  const ids = new Set([note?.initiator_id].filter(Boolean));
  for (const s of all('SELECT from_member_id FROM routing_steps WHERE note_id = ?', noteId)) {
    if (s.from_member_id) ids.add(s.from_member_id);
  }
  return ids;
}

// Is `ancestorId` an ancestor-or-equal of `unitId` in the org tree?
export function isAncestorOrSelf(ancestorId, unitId) {
  if (!ancestorId || !unitId) return false;
  let u = unitId;
  while (u) {
    if (u === ancestorId) return true;
    u = get('SELECT parent_id FROM org_units WHERE id = ?', u)?.parent_id;
  }
  return false;
}

// Tenure-aware supervision (email points 19 & 20). `me` may view `file` if `me` held a HEAD
// posting over an ancestor-or-equal of the file's FROZEN initiator unit:
//   • a CURRENT head (to_date NULL) sees every file in his subtree regardless of date —
//     so a sitting HOD sees a predecessor's older files ("pb mapped to dept"), and still
//     sees a subordinate's file after the subordinate transfers (unit id is frozen);
//   • a FORMER head sees only files whose active window overlaps his tenure — he keeps
//     access to what he dealt with, even after transfer/superannuation.
export function canSupervise(me, file) {
  if (!me || !file?.initiator_unit_id) return false;
  const start = file.created_at;
  const end = file.closed_at || nowISO();
  const heads = all(
    `SELECT org_unit_id, from_date, to_date FROM postings WHERE member_id = ? AND role_in_unit = 'head'`,
    me.id
  );
  for (const p of heads) {
    if (!isAncestorOrSelf(p.org_unit_id, file.initiator_unit_id)) continue;
    if (!p.to_date) return true;                                  // current head — all subtree files
    if (p.from_date <= end && p.to_date >= start) return true;    // former head — tenure overlap
  }
  return false;
}

// The "direct" head of a unit (for the stricter Secret level): a current head of the unit
// itself or its immediate parent — deliberately excludes distant heads (division GM, complex).
export function isDirectHead(me, unitId) {
  if (!me || !unitId) return false;
  const parent = get('SELECT parent_id FROM org_units WHERE id = ?', unitId)?.parent_id;
  const targets = new Set([unitId, parent].filter(Boolean));
  const heads = all(`SELECT org_unit_id FROM postings WHERE member_id = ? AND role_in_unit = 'head' AND to_date IS NULL`, me.id);
  return heads.some((p) => targets.has(p.org_unit_id));
}

// Need-to-know with graded restriction (email point 3). Normal = any signed-in member.
// Routed members always pass. Otherwise the supervisory bypass narrows as the level rises:
//   confidential → any supervising head (tenure-aware);
//   secret       → only the direct unit/dept head;
//   top_secret   → routed members (+ an explicit share grant) only — no head bypass at all.
// A bare link or transaction id grants nothing (see the grant + leak check in notes.js).
export function canView(note, me) {
  const cls = note.classification || 'normal';
  if (cls === 'normal') return true;
  if (!me) return false;
  if (participants(note.id).has(me.id)) return true;
  if (cls === 'top_secret') return false;
  const file = get('SELECT initiator_unit_id, created_at, closed_at FROM files WHERE id = ?', note.file_pk);
  if (cls === 'secret') return isDirectHead(me, file?.initiator_unit_id);
  return canSupervise(me, file); // confidential
}

// Files a member is entitled to see in the management reports, as a set of file ids. Unlike
// the Files browser (normal = visible to all), reports are an oversight tool scoped to the
// member's own cases + supervised subtree: a routed member of ANY note retains access
// (email 18), otherwise a head may see it subject to the latest note's classification grade
// (same grading as canView, so restricted metadata never leaks — email 24–27).
// Does a supervising head's bypass pass this classification grade? (Same ladder as
// canView, minus the participant branch — used to grade heads per NOTE, not per file,
// so a single restricted note never hides or exposes the rest of the case.)
export function headGradePasses(me, file, cls) {
  if (cls === 'top_secret') return false;                                        // no head bypass
  if (cls === 'secret') return isDirectHead(me, file?.initiator_unit_id);
  return canSupervise(me, file);                                                 // normal / confidential
}

// May this member see this NOTE inside the management reports? Participant of the note,
// or a head passing the note's own grade. (Reports are an oversight tool — "normal" here
// does NOT mean visible to everyone, unlike the Files browser.)
export function mayViewInReports(note, file, me) {
  if (!me) return false;
  if (participants(note.id).has(me.id)) return true;
  return headGradePasses(me, file, note.classification || 'normal');
}

// Files a member is entitled to see in the management reports, as a set of file ids:
// a routed member of ANY note retains access (email 18), and a head sees the file if ANY
// of its notes passes his grade — graded note-by-note, so an early normal note keeps the
// case listed while a later top_secret note stays out of the per-note reports (email 24–27).
export function visibleFileIds(me) {
  if (!me) return new Set();
  const ids = new Set();
  for (const file of all('SELECT id, initiator_unit_id, created_at, closed_at FROM files')) {
    const notes = all('SELECT id, classification FROM notes WHERE file_pk = ?', file.id);
    if (notes.some((n) => mayViewInReports(n, file, me))) ids.add(file.id);
  }
  return ids;
}

const latestStep = (noteId) =>
  get('SELECT * FROM routing_steps WHERE note_id = ? ORDER BY seq DESC LIMIT 1', noteId);

const nextSeq = (noteId) =>
  (get('SELECT MAX(seq) AS m FROM routing_steps WHERE note_id = ?', noteId).m || 0) + 1;

// Mark the inbound step that brought the note to `me` as acted-upon.
function closeInbound(noteId, meId, action) {
  const s = get(
    `SELECT id FROM routing_steps WHERE note_id = ? AND to_member_id = ? AND state IN ('sent','opened')
     ORDER BY seq DESC LIMIT 1`,
    noteId, meId
  );
  if (s) run(`UPDATE routing_steps SET state = 'actioned', action = ?, actioned_at = ? WHERE id = ?`, action, nowISO(), s.id);
}

function requireHolder(note, me) {
  if (!me) fail(403, 'No noting member mapped to this account');
  if (!active.has(note.status)) fail(409, `Note is ${note.status} — no routing actions available`);
  if (note.custodian_id !== me.id) fail(403, 'Only the current holder can route this note');
}

// Auto-open on view: when the recipient opens the note, its inbound step is no longer
// retractable by the sender (retraction is only allowed "before the receiver has opened it").
export function openIfRecipient(note, me) {
  if (!me || note.custodian_id !== me.id) return;
  const s = get(
    `SELECT id FROM routing_steps WHERE note_id = ? AND to_member_id = ? AND state = 'sent'
     ORDER BY seq DESC LIMIT 1`,
    note.id, me.id
  );
  if (s) run(`UPDATE routing_steps SET state = 'opened', opened_at = ? WHERE id = ?`, nowISO(), s.id);
}

// Forward to the next member (also covers "add self" and "add a member twice" — the
// recipient is unrestricted). Empty or symbols-only comment auto-fills "Concurred & Forwarded".
export function forward(note, me, toId, comment) {
  requireHolder(note, me);
  if (!toId) fail(422, 'Choose a member to forward to');
  if (!get('SELECT id FROM members WHERE id = ?', toId)) fail(422, 'Unknown member');
  closeInbound(note.id, me.id, 'forward');
  run(
    `INSERT INTO routing_steps(note_id,seq,from_member_id,to_member_id,purpose,state,action,comment,sent_at)
     VALUES(?,?,?,?, 'forward', 'sent', 'forward', ?, ?)`,
    note.id, nextSeq(note.id), me.id, toId, normComment(comment, 'Concurred & Forwarded'), nowISO()
  );
  run(`UPDATE notes SET custodian_id = ?, status = 'routed' WHERE id = ?`, toId, note.id);
  return get('SELECT * FROM notes WHERE id = ?', note.id);
}

// Send back to the initiator or any previous member. Returning to the initiator reopens
// the draft for editing.
export function sendBack(note, me, toId, comment) {
  requireHolder(note, me);
  if (!toId || toId === me.id) fail(422, 'Choose a different member to send back to');
  if (!priorHolders(note.id).has(toId)) fail(422, 'Send back only to the initiator or a previous member');
  closeInbound(note.id, me.id, 'send_back');
  run(
    `INSERT INTO routing_steps(note_id,seq,from_member_id,to_member_id,purpose,state,action,comment,sent_at)
     VALUES(?,?,?,?, 'forward', 'sent', 'send_back', ?, ?)`,
    note.id, nextSeq(note.id), me.id, toId, normComment(comment, 'Returned'), nowISO()
  );
  const status = toId === note.initiator_id ? 'draft' : 'routed';
  run(`UPDATE notes SET custodian_id = ?, status = ? WHERE id = ?`, toId, status, note.id);
  return get('SELECT * FROM notes WHERE id = ?', note.id);
}

// Recall a just-sent note — only the sender, only before the receiver opened it.
export function retract(note, me) {
  if (!me) fail(403, 'No noting member mapped to this account');
  const s = latestStep(note.id);
  if (!s || s.from_member_id !== me.id) fail(403, 'Only the member who sent it can retract');
  if (s.state !== 'sent') fail(409, 'Too late — the receiver has already opened it');
  run(`UPDATE routing_steps SET state = 'retracted', actioned_at = ? WHERE id = ?`, nowISO(), s.id);
  const remaining = get(`SELECT COUNT(*) AS c FROM routing_steps WHERE note_id = ? AND state != 'retracted'`, note.id).c;
  const status = remaining === 0 ? 'draft' : 'routed';
  run(`UPDATE notes SET custodian_id = ?, status = ? WHERE id = ?`, me.id, status, note.id);
  return get('SELECT * FROM notes WHERE id = ?', note.id);
}

// A minimal input-seeking skeleton for a freshly generated stage note (email point 23:
// "auto-generate next note and seek inputs/documents for next stage").
function stageSkeleton(stageId) {
  const t = stageTitle(stageId);
  return `${t}\n\n(Draft auto-created for the next stage. Provide the inputs and documents required for "${t}", then route for approval.)`;
}

// Add the next note (N2..final) to an OPEN file — the multi-note lifecycle (email 13, 21, 23).
// The connected Reference/Transaction ids continue the same File ID; the note opens as a
// draft held by its author. Only a member of the case may add it. Reaching the tendering
// stage stamps files.tendering_start. Creating the next note clears the cabinet prompt.
export function addNote(file, me, { stageId = null, title, body = '', classification = 'normal' } = {}) {
  if (!me) fail(403, 'No noting member mapped to this account');
  stageId = (stageId || '').trim() || null;
  if (stageId && !VALID_STAGES.has(stageId)) fail(422, `Unknown stage "${stageId}"`);
  if (file.status !== 'open') {
    // PO amendment (email: "PO placement, PO amendments"): the one note that may be added
    // to a CLOSED file — only after the PO (or a previous amendment) was approved. It
    // reopens the case; its own approval closes it again (no next stage).
    const last = get('SELECT stage_id, status FROM notes WHERE file_pk = ? ORDER BY seq DESC LIMIT 1', file.id);
    const amendable = stageId === 'po_amendment' && last?.status === 'approved' && ['po', 'po_amendment'].includes(last.stage_id);
    if (!amendable) fail(409, 'File is closed — retrieve it before adding a note');
    run(`UPDATE files SET status = 'open', closed_at = NULL WHERE id = ?`, file.id);
  }
  const isCaseMember =
    file.initiator_id === me.id ||
    all('SELECT id FROM notes WHERE file_pk = ?', file.id).some((n) => participants(n.id).has(me.id));
  if (!isCaseMember) fail(403, 'Only a member of this case can add the next note');

  const today = nowISO();
  const seq = (get('SELECT MAX(seq) AS m FROM notes WHERE file_pk = ?', file.id).m || 0) + 1;
  run(
    `INSERT INTO notes(file_pk,seq,ref_no,txn_id,title,stage_id,source,body,classification,status,initiator_id,custodian_id,created_at)
     VALUES(?,?,?,?,?,?, 'manual', ?,?, 'draft', ?, ?, ?)`,
    file.id, seq, noteRefNo(file.file_id, seq), nextTxnId(), (title || '').trim() || stageTitle(stageId),
    stageId, (body || '').trim() || stageSkeleton(stageId), classification, me.id, me.id, today
  );
  const note = get('SELECT * FROM notes WHERE file_pk = ? AND seq = ?', file.id, seq);
  run(`INSERT INTO attachments(note_id,kind,name,ref,uploaded_by_id,created_at) VALUES(?, 'pm', ?, ?, NULL, ?)`, note.id, 'Purchase Manual Issue-4', 'PM/Issue-4', today);
  if (stageId === TENDERING_START_STAGE && !file.tendering_start) run(`UPDATE files SET tendering_start = ? WHERE id = ?`, today, file.id);
  run(`DELETE FROM cabinet WHERE file_pk = ?`, file.id); // next action taken — leaves the cabinet
  return note;
}

// Approve / reject a note. Approving an INTERMEDIATE stage advances the case and leaves the
// file OPEN; approving the FINAL stage (no next stage) or any rejection CLOSES the file. The
// closed note is filed into the cabinet of every routed member and the file initiator, tagged
// by role (email points 16, 17, 23). Cabinet rows are refreshed per decision.
export function decide(note, me, decision, comment) {
  requireHolder(note, me);
  // An unrouted draft cannot be decided — the initiator would be approving his own note
  // with zero hand-offs on record. At least one routing step must have happened first.
  if (note.status === 'draft') fail(409, 'Route the note before a decision — a draft cannot be approved/rejected');
  if (!['approve', 'reject'].includes(decision)) fail(422, 'decision must be approve or reject');
  const today = nowISO();
  const approved = decision === 'approve';
  const isFinal = nextStage(note.stage_id) == null;
  closeInbound(note.id, me.id, decision);
  run(
    `INSERT INTO routing_steps(note_id,seq,from_member_id,to_member_id,purpose,state,action,comment,sent_at,actioned_at)
     VALUES(?,?,?,?, 'approve', 'actioned', ?, ?, ?, ?)`,
    note.id, nextSeq(note.id), me.id, me.id, decision, (comment || '').trim() || null, today, today
  );
  const status = approved ? 'approved' : 'rejected';
  run(`UPDATE notes SET status = ?, decision = ?, decided_by = ?, closed_at = ? WHERE id = ?`, status, status, me.id, today, note.id);
  if (!approved || isFinal) run(`UPDATE files SET status = 'closed', closed_at = ? WHERE id = ?`, today, note.file_pk);

  // Cabinet recipients = the union of EVERY note's participants (a member who routed only
  // an earlier note keeps his cabinet copy at a later decision) + the file initiator.
  const fileInit = get('SELECT initiator_id FROM files WHERE id = ?', note.file_pk)?.initiator_id;
  const recipients = new Set();
  for (const n of all('SELECT id FROM notes WHERE file_pk = ?', note.file_pk)) {
    for (const pid of participants(n.id)) recipients.add(pid);
  }
  if (fileInit) recipients.add(fileInit);
  run(`DELETE FROM cabinet WHERE file_pk = ?`, note.file_pk);
  for (const pid of recipients) {
    const reason = pid === fileInit ? 'initiator' : pid === me.id ? 'approver' : 'router';
    run(`INSERT INTO cabinet(member_id,file_pk,reason,placed_at) VALUES(?,?,?,?)`, pid, note.file_pk, reason, today);
  }
  return get('SELECT * FROM notes WHERE id = ?', note.id);
}

// The deciding authority can pull a closed file back out of the cabinet into their inbox.
export function retrieve(note, me) {
  if (!me) fail(403, 'No noting member mapped to this account');
  if (!['approved', 'rejected'].includes(note.status)) fail(409, 'Only a closed note can be retrieved');
  if (note.decided_by !== me.id) fail(403, 'Only the deciding authority can retrieve it');
  const latest = get('SELECT id FROM notes WHERE file_pk = ? ORDER BY seq DESC LIMIT 1', note.file_pk);
  if (latest?.id !== note.id) fail(409, 'A later note exists on this file — only the latest note can be retrieved');
  run(`UPDATE notes SET status = 'routed', custodian_id = ?, decision = NULL, decided_by = NULL, closed_at = NULL WHERE id = ?`, me.id, note.id);
  run(`UPDATE files SET status = 'open', closed_at = NULL WHERE id = ?`, note.file_pk);
  run(`DELETE FROM cabinet WHERE file_pk = ?`, note.file_pk);
  run(
    `INSERT INTO routing_steps(note_id,seq,from_member_id,to_member_id,purpose,state,action,comment,sent_at,actioned_at)
     VALUES(?,?,?,?, 'forward', 'opened', 'retrieve', 'Retrieved from cabinet', ?, ?)`,
    note.id, nextSeq(note.id), me.id, me.id, nowISO(), nowISO()
  );
  return get('SELECT * FROM notes WHERE id = ?', note.id);
}

// Routing history for the timeline (member names resolved).
export function history(noteId) {
  return all(
    `SELECT rs.seq, rs.purpose, rs.state, rs.action, rs.comment, rs.sent_at, rs.opened_at, rs.actioned_at,
            rs.from_member_id AS from_id, rs.to_member_id AS to_id,
            fm.name AS from_name, tm.name AS to_name
     FROM routing_steps rs
     LEFT JOIN members fm ON fm.id = rs.from_member_id
     LEFT JOIN members tm ON tm.id = rs.to_member_id
     WHERE rs.note_id = ? ORDER BY rs.seq ASC`,
    noteId
  );
}
