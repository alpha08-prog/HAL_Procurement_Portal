// Dynamic routing engine for notes — the user-driven counterpart to Module A's fixed
// payment state machine. The actor is always the real signed-in member (never a role),
// and the recipient is chosen at runtime. Each hand-off appends a routing_steps row.
import { all, get, nowISO, run } from './db.js';

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

const active = new Set(['draft', 'in_check', 'routed']);

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

// Does `me` head a unit that is an ancestor-or-equal of `unitId`? (Phase 7) — a section
// head / HOD / GM supervises everyone initiating within their org subtree, so they retain
// access to subordinates' (and a predecessor's) files even after transfer.
export function supervises(me, unitId) {
  if (!me?.heads_unit_id || !unitId) return false;
  let u = unitId;
  while (u) {
    if (u === me.heads_unit_id) return true;
    u = get('SELECT parent_id FROM org_units WHERE id = ?', u)?.parent_id;
  }
  return false;
}

// Need-to-know: a Normal note is visible to any signed-in member; a Restricted note
// (confidential/secret/top_secret) is visible only to its routed members or a supervising
// head — a link or transaction id alone grants nothing (that is what access grants + the
// leak check are for).
export function canView(note, me) {
  if (note.classification === 'normal') return true;
  if (!me) return false;
  if (participants(note.id).has(me.id)) return true;
  const file = get('SELECT initiator_unit_id FROM files WHERE id = ?', note.file_pk);
  return supervises(me, file?.initiator_unit_id);
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
// recipient is unrestricted). Empty comment auto-fills "Concurred & Forwarded".
export function forward(note, me, toId, comment) {
  requireHolder(note, me);
  if (!toId) fail(422, 'Choose a member to forward to');
  if (!get('SELECT id FROM members WHERE id = ?', toId)) fail(422, 'Unknown member');
  closeInbound(note.id, me.id, 'forward');
  run(
    `INSERT INTO routing_steps(note_id,seq,from_member_id,to_member_id,purpose,state,action,comment,sent_at)
     VALUES(?,?,?,?, 'forward', 'sent', 'forward', ?, ?)`,
    note.id, nextSeq(note.id), me.id, toId, (comment || '').trim() || 'Concurred & Forwarded', nowISO()
  );
  run(`UPDATE notes SET custodian_id = ?, status = 'routed' WHERE id = ?`, toId, note.id);
  return get('SELECT * FROM notes WHERE id = ?', note.id);
}

// Send back to the initiator or any previous member. Returning to the initiator reopens
// the draft for editing.
export function sendBack(note, me, toId, comment) {
  requireHolder(note, me);
  if (!toId || toId === me.id) fail(422, 'Choose a different member to send back to');
  if (!get('SELECT id FROM members WHERE id = ?', toId)) fail(422, 'Unknown member');
  closeInbound(note.id, me.id, 'send_back');
  run(
    `INSERT INTO routing_steps(note_id,seq,from_member_id,to_member_id,purpose,state,action,comment,sent_at)
     VALUES(?,?,?,?, 'forward', 'sent', 'send_back', ?, ?)`,
    note.id, nextSeq(note.id), me.id, toId, (comment || '').trim() || 'Returned', nowISO()
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

// Approve / reject — closes the file and files it into the cabinets of every routed member.
export function decide(note, me, decision, comment) {
  requireHolder(note, me);
  if (!['approve', 'reject'].includes(decision)) fail(422, 'decision must be approve or reject');
  const today = nowISO();
  closeInbound(note.id, me.id, decision);
  run(
    `INSERT INTO routing_steps(note_id,seq,from_member_id,to_member_id,purpose,state,action,comment,sent_at,actioned_at)
     VALUES(?,?,?,?, 'approve', 'actioned', ?, ?, ?, ?)`,
    note.id, nextSeq(note.id), me.id, me.id, decision, (comment || '').trim() || null, today, today
  );
  const status = decision === 'approve' ? 'approved' : 'rejected';
  run(`UPDATE notes SET status = ?, decision = ?, decided_by = ?, closed_at = ? WHERE id = ?`, status, status, me.id, today, note.id);
  run(`UPDATE files SET status = 'closed', closed_at = ? WHERE id = ?`, today, note.file_pk);

  for (const pid of participants(note.id)) {
    const reason = pid === note.initiator_id ? 'initiator' : pid === me.id ? 'approver' : 'router';
    run(`INSERT INTO cabinet(member_id,file_pk,reason,placed_at) VALUES(?,?,?,?)`, pid, note.file_pk, reason, today);
  }
  return get('SELECT * FROM notes WHERE id = ?', note.id);
}

// The deciding authority can pull a closed file back out of the cabinet into their inbox.
export function retrieve(note, me) {
  if (!me) fail(403, 'No noting member mapped to this account');
  if (!['approved', 'rejected'].includes(note.status)) fail(409, 'Only a closed note can be retrieved');
  if (note.decided_by !== me.id) fail(403, 'Only the deciding authority can retrieve it');
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
