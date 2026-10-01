// Dynamic routing engine for notes — the user-driven counterpart to Module A's fixed
// payment state machine. The actor is always the real signed-in member (never a role),
// and the recipient is chosen at runtime. Each hand-off appends a routing_steps row.
//
// Shape of a case (client, 13/09/2026): a proposal (`files`, one MPR/CAR thread) is a chain of
// separate stage files (`notes`, ref <File ID>/S<seq>) — Provisioning, EMD, TEC, PBO, …,
// Retender, PO Amendment — each generated from the result of the one before. Every stage file
// runs its own N1..Nx noting sheet and, once decided, closes and rests in the cabinet.
//
// Three things are enforced here rather than merely displayed:
//   • custody — the custodian routes, or a member holding an active delegation from them
//     (delegation.js), in which case the hop is stamped on_behalf_of_id;
//   • the planned routing — Initiate's chain is followed unless the sender records a
//     deviation with a reason;
//   • authority — the planned approving authority (or their delegate) decides a stage;
//     without a plan, anyone but the initiator.
import { verify as verifyOtp } from '../auth/otp.js';
import { actsFor } from './delegation.js';
import { ensureChain, releaseBlock } from './approvalLink.js';
import { all, get, nowISO, run } from './db.js';
import { nextTxnId, noteRefNo } from './refs.js';
import {
  followUps, NEEDBASED, nextStage, STAGE_ORDER, stageTitle, startsTendering, VALID_STAGES
} from './stages.js';

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

const active = new Set(['draft', 'in_check', 'routed']);

// Side effects other modules register (routes/noting/notes.js hooks the AI case rollback
// here), so this file never imports the AI store.
export const hooks = { onReject: null };

// Email rule: an empty comment — or one that is just symbols ("." "," "*" …) — becomes
// the auto comment at send time. Anything with at least one letter/digit stands as written.
export const normComment = (comment, fallback) => {
  const c = (comment || '').trim();
  return c.replace(/[^\p{L}\p{N}]/gu, '') === '' ? fallback : c;
};

export function noteByTxn(txnId) {
  return get('SELECT * FROM notes WHERE txn_id = ?', txnId);
}

const memberName = (id) => get('SELECT name FROM members WHERE id = ?', id)?.name ?? `member #${id}`;

// planned_routing is a JSON array of member ids (Initiate sends ids; older rows may hold
// objects). The last planned member is the approving authority unless approver_id says so.
export const parsePlan = (json) => {
  try {
    return (JSON.parse(json || '[]') || [])
      .map((x) => Number(x && typeof x === 'object' ? x.id : x))
      .filter(Boolean);
  } catch {
    return [];
  }
};

export const plannedApprover = (note) => note.approver_id ?? (parsePlan(note.planned_routing).at(-1) ?? null);

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

// The proposal's owners: the member who initiated it (the indentor) and the tender initiator
// they handed the approved provisioning to. Both follow every stage file of the proposal.
export const isProposalOwner = (file, me) =>
  Boolean(me && file && (file.initiator_id === me.id || file.tender_initiator_id === me.id));

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

// Need-to-know restriction. Normal = any signed-in member. Any restricted class
// (Restricted / Confidential / Secret / Top Secret) is visible only to routed members and
// the proposal's owners here; explicit share grants are resolved in routes/noting/access.js.
// A bare link or transaction id grants nothing.
export function canView(note, me) {
  const cls = note.classification || 'normal';
  if (cls === 'normal') return true;
  if (!me) return false;
  if (participants(note.id).has(me.id)) return true;
  return isProposalOwner(get('SELECT initiator_id, tender_initiator_id FROM files WHERE id = ?', note.file_pk), me);
}

// Does a supervising head's bypass pass this classification grade? (Same ladder as
// canView, minus the participant branch — used to grade heads per NOTE, not per file,
// so a single restricted note never hides or exposes the rest of the case.)
export function headGradePasses(me, file, cls) {
  if (cls !== 'normal') return false;                                            // no head bypass for restricted notes
  return canSupervise(me, file);
}

// May this member see this NOTE inside the management reports? Participant of the note,
// an owner of its proposal, or a head passing the note's own grade. (Reports are an
// oversight tool — "normal" here does NOT mean visible to everyone, unlike the Files browser.)
export function mayViewInReports(note, file, me) {
  if (!me) return false;
  if (participants(note.id).has(me.id) || isProposalOwner(file, me)) return true;
  return headGradePasses(me, file, note.classification || 'normal');
}

// Files a member is entitled to see in the management reports, as a set of file ids:
// a routed member of ANY note retains access (email 18), and a head sees the file if ANY
// of its notes passes his grade — graded note-by-note, so an early normal note keeps the
// case listed while a later top_secret note stays out of the per-note reports (email 24–27).
export function visibleFileIds(me) {
  if (!me) return new Set();
  const ids = new Set();
  for (const file of all('SELECT id, initiator_id, tender_initiator_id, initiator_unit_id, created_at, closed_at FROM files')) {
    const notes = all('SELECT id, classification FROM notes WHERE file_pk = ?', file.id);
    if (notes.some((n) => mayViewInReports(n, file, me))) ids.add(file.id);
  }
  return ids;
}

const latestStep = (noteId) =>
  get('SELECT * FROM routing_steps WHERE note_id = ? ORDER BY seq DESC LIMIT 1', noteId);

const nextSeq = (noteId) =>
  (get('SELECT MAX(seq) AS m FROM routing_steps WHERE note_id = ?', noteId).m || 0) + 1;

export const nextEntrySeq = (noteId) =>
  (get('SELECT MAX(seq) AS m FROM noting_entries WHERE note_id = ?', noteId)?.m || 0) + 1;

export function notingEntries(noteId) {
  return all(
    `SELECT ne.*, m.name AS author_name, m.pb AS author_pb, m.designation AS author_designation
     FROM noting_entries ne
     LEFT JOIN members m ON m.id = ne.author_id
     WHERE ne.note_id = ?
     ORDER BY ne.seq ASC`,
    noteId
  );
}

// Mark the inbound step that brought the note to `holderId` as acted-upon.
function closeInbound(noteId, holderId, action) {
  const s = get(
    `SELECT id FROM routing_steps WHERE note_id = ? AND to_member_id = ? AND state IN ('sent','opened')
     ORDER BY seq DESC LIMIT 1`,
    noteId, holderId
  );
  if (s) run(`UPDATE routing_steps SET state = 'actioned', action = ?, actioned_at = ? WHERE id = ?`, action, nowISO(), s.id);
}

// The custodian routes, or a member holding an active delegation from the custodian. Returns
// the custodian's id when `me` is acting as a delegate (stamped on the hop), else null.
function requireHolder(note, me) {
  if (!me) fail(403, 'No noting member mapped to this account');
  if (!active.has(note.status)) fail(409, `Note is ${note.status} — no routing actions available`);
  if (note.custodian_id === me.id) return null;
  if (actsFor(me, note.custodian_id)) return note.custodian_id;
  fail(403, 'Only the current holder (or their active delegate) can route this note');
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

// Who the plan expects next. The holder's own position in the plan decides; a holder who is
// not in the plan (the target of an earlier deviation) resumes it after the last planned
// member who has already held the note.
function expectedNext(note, holderId) {
  const plan = parsePlan(note.planned_routing);
  if (!plan.length) return null;
  let at = plan.indexOf(holderId);
  if (at < 0) {
    const prior = priorHolders(note.id);
    plan.forEach((id, i) => { if (prior.has(id)) at = Math.max(at, i); });
  }
  return plan[at + 1] ?? null;
}

// Forward to the next member. The planned routing is enforced: the recipient must be the
// next planned member unless the sender records a deviation with a reason. Empty or
// symbols-only comment auto-fills "Concurred & Forwarded". Appends N{entrySeq}.
export function forward(note, me, toId, comment, { deviate = false, reason = '' } = {}) {
  const onBehalfOf = requireHolder(note, me);
  if (!toId) fail(422, 'Choose a member to forward to');
  if (!get('SELECT id FROM members WHERE id = ?', toId)) fail(422, 'Unknown member');
  const holder = onBehalfOf ?? me.id;
  const expected = expectedNext(note, holder);
  let deviation = null;
  if (expected && expected !== toId) {
    if (!deviate) fail(409, `Planned routing expects ${memberName(expected)} next — forward there, or record a deviation with a reason`);
    if (!String(reason || '').trim()) fail(422, 'A deviation from the planned routing needs a reason');
    deviation = String(reason).trim();
  }
  closeInbound(note.id, holder, 'forward');
  const normCom = normComment(comment, 'Concurred & Forwarded');
  run(
    `INSERT INTO routing_steps(note_id,seq,from_member_id,to_member_id,purpose,state,action,comment,sent_at,on_behalf_of_id)
     VALUES(?,?,?,?, 'forward', 'sent', 'forward', ?, ?, ?)`,
    note.id, nextSeq(note.id), me.id, toId, normCom, nowISO(), onBehalfOf
  );
  const entrySeq = nextEntrySeq(note.id);
  const toMember = get('SELECT name, designation FROM members WHERE id = ?', toId);
  const isQuery = normCom.includes('?') || /clarif|query|please provide|confirm|check/i.test(normCom);
  const entryType = isQuery ? 'query' : 'remark';
  const entryTitle = `N${entrySeq}: ${isQuery ? 'Clarification Query / Remark' : 'Observation / Concurrence'} by ${me.name || 'Officer'}`;
  const remark = `Forwarded to ${toMember?.name || 'Officer'}`
    + (onBehalfOf ? ` (on behalf of ${memberName(onBehalfOf)})` : '')
    + (deviation ? ` — deviation from planned routing: ${deviation}` : '');
  run(
    `INSERT INTO noting_entries(note_id, seq, author_id, title, body, entry_type, remark, created_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    note.id, entrySeq, me.id, entryTitle, normCom, entryType, remark, nowISO()
  );
  run(`UPDATE notes SET custodian_id = ?, status = 'routed' WHERE id = ?`, toId, note.id);
  return get('SELECT * FROM notes WHERE id = ?', note.id);
}

// Send back to the initiator or any previous member. Returning to the initiator reopens
// the draft for editing. Appends N{entrySeq} query/clarification note to noting_entries.
export function sendBack(note, me, toId, comment) {
  const onBehalfOf = requireHolder(note, me);
  if (!toId || toId === me.id) fail(422, 'Choose a different member to send back to');
  if (!priorHolders(note.id).has(toId)) fail(422, 'Send back only to the initiator or a previous member');
  closeInbound(note.id, onBehalfOf ?? me.id, 'send_back');
  const normCom = normComment(comment, 'Returned for clarification');
  run(
    `INSERT INTO routing_steps(note_id,seq,from_member_id,to_member_id,purpose,state,action,comment,sent_at,on_behalf_of_id)
     VALUES(?,?,?,?, 'forward', 'sent', 'send_back', ?, ?, ?)`,
    note.id, nextSeq(note.id), me.id, toId, normCom, nowISO(), onBehalfOf
  );
  const entrySeq = nextEntrySeq(note.id);
  const toMember = get('SELECT name, designation FROM members WHERE id = ?', toId);
  const entryTitle = `N${entrySeq}: Clarification Requested by ${me.name || 'Officer'}`;
  run(
    `INSERT INTO noting_entries(note_id, seq, author_id, title, body, entry_type, remark, created_at)
     VALUES(?, ?, ?, ?, ?, 'query', ?, ?)`,
    note.id, entrySeq, me.id, entryTitle, normCom, `Returned to ${toMember?.name || 'Previous Holder'}`, nowISO()
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

// Owners, or anyone routed on any stage file of the proposal.
export function isCaseMember(file, me) {
  return isProposalOwner(file, me) ||
    all('SELECT id FROM notes WHERE file_pk = ?', file.id).some((n) => participants(n.id).has(me.id));
}

// Guards for generating the next stage file, shared by addNote and the AI routes (which must
// check BEFORE advancing the AI case). A stage is generated from the result of the one
// before, so the latest stage file must be decided first; only a PO amendment may reopen a
// closed proposal. Returns the normalised stage id.
export function assertCanAddNote(file, me, stageId) {
  if (!me) fail(403, 'No noting member mapped to this account');
  stageId = (stageId || '').trim() || null;
  if (stageId && !VALID_STAGES.has(stageId)) fail(422, `Unknown stage "${stageId}"`);
  const last = get('SELECT seq, stage_id, status FROM notes WHERE file_pk = ? ORDER BY seq DESC LIMIT 1', file.id);
  if (file.status !== 'open') {
    // PO amendment (email: "PO placement, PO amendments"): the one stage that may be added
    // to a CLOSED proposal — only after the PO (or a previous amendment) was approved.
    const amendable = stageId === 'po_amendment' && last?.status === 'approved' && ['po', 'po_amendment'].includes(last.stage_id);
    if (!amendable) fail(409, 'File is closed — retrieve it before adding a note');
  }
  if (!isCaseMember(file, me)) fail(403, 'Only a member of this case can add the next note');
  if (last && active.has(last.status)) {
    const t = last.stage_id ? ` ${stageTitle(last.stage_id)}` : '';
    fail(409, `S${last.seq}${t} is still ${last.status} — it must be decided before the next stage is generated`);
  }
  // Tender stages follow the hand-over: the approved provisioning first goes to a tender initiator.
  if (last?.stage_id === 'provisioning' && last.status === 'approved' && !file.tender_initiator_id && startsTendering(stageId)) {
    fail(409, 'Send the approved provisioning to a tender initiator before generating tender stages');
  }
  return stageId;
}

// Add the next stage file to a proposal — the multi-stage lifecycle (email 13, 21, 23). The
// connected Reference/Transaction ids continue the same File ID; the stage opens as a draft
// held by its author with its own N1, and saves planned_routing plus the approving
// authority (explicit, else the last planned member). A PO amendment reopens a closed
// proposal (its own approval closes it again). Reaching tendering stamps
// files.tendering_start. Earlier closed stage files stay in their cabinets.
export function addNote(file, me, {
  stageId = null, title, body = '', bodyText = null, classification = 'normal', routingList = null,
  priority = 'Medium', approverId = null, source = 'manual'
} = {}) {
  stageId = assertCanAddNote(file, me, stageId);
  if (file.status !== 'open') run(`UPDATE files SET status = 'open', closed_at = NULL WHERE id = ?`, file.id);

  const today = nowISO();
  const seq = (get('SELECT MAX(seq) AS m FROM notes WHERE file_pk = ?', file.id).m || 0) + 1;
  const stageNo = seq;
  const plan = Array.isArray(routingList) ? routingList.map((x) => Number(x && typeof x === 'object' ? x.id : x)).filter(Boolean) : [];
  const plannedRoutingJson = plan.length ? JSON.stringify(plan) : null;
  const approver = approverId ? Number(approverId) : (plan.at(-1) ?? null);
  const finalTitle = (title || '').trim() || stageTitle(stageId);
  const finalBody = (body || '').trim() || stageSkeleton(stageId);
  const prio = ['High', 'Medium', 'Low'].includes(priority) ? priority : 'Medium';

  run(
    `INSERT INTO notes(file_pk,seq,ref_no,txn_id,title,stage_id,source,body,body_text,classification,status,initiator_id,custodian_id,stage_no,planned_routing,priority,approver_id,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
    file.id, seq, noteRefNo(file.file_id, seq), nextTxnId(), finalTitle,
    stageId, source === 'ai' ? 'ai' : 'manual', finalBody, bodyText, classification, me.id, me.id, stageNo,
    plannedRoutingJson, prio, approver, today
  );
  const note = get('SELECT * FROM notes WHERE file_pk = ? AND seq = ?', file.id, seq);

  // Initialize N1 noting entry for this stage
  run(
    `INSERT INTO noting_entries(note_id,seq,author_id,title,body,entry_type,remark,created_at)
     VALUES(?, 1, ?, ?, ?, 'initial', 'Initial stage note / proposal', ?)`,
    note.id, me.id, `N1: ${finalTitle}`, finalBody, today
  );
  // Stages the DOP requires an internal approval chain for get it planned now (Module E).
  ensureChain(note, file, me);

  run(`INSERT INTO attachments(note_id,kind,name,ref,uploaded_by_id,created_at) VALUES(?, 'pm', ?, ?, NULL, ?)`, note.id, 'Purchase Manual Issue-4', 'PM/Issue-4', today);
  if (startsTendering(stageId) && !file.tendering_start) run(`UPDATE files SET tendering_start = ? WHERE id = ?`, today, file.id);
  return note;
}

// Approve / reject a stage file. Either way the stage closes and rests in the cabinet of its
// initiator, routing members, deciding authority and the proposal's owners (client: "once a
// note is approved it becomes a closed file and sits in cabinet"). Approving an INTERMEDIATE
// stage leaves the proposal OPEN for the next one; approving the FINAL stage (no next stage)
// or any rejection CLOSES the proposal. Only the approving authority (or their delegate)
// decides; with no plan on file, anyone but the initiator. An optional one-time password is
// verified server-side and stamped on the note.
export function decide(note, me, decision, comment, { otp = null } = {}) {
  let onBehalfOf = requireHolder(note, me);
  // An unrouted draft cannot be decided — the initiator would be approving his own note
  // with zero hand-offs on record. At least one routing step must have happened first.
  if (note.status === 'draft') fail(409, 'Route the note before a decision — a draft cannot be approved/rejected');
  if (!['approve', 'reject'].includes(decision)) fail(422, 'decision must be approve or reject');
  const approver = plannedApprover(note);
  if (approver) {
    if (!actsFor(me, approver)) fail(403, `Only ${memberName(approver)}, the approving authority for this stage, or their active delegate may decide it`);
    // Deciding under the approver's delegation is stamped on behalf of the approver.
    if (approver !== me.id && onBehalfOf == null) onBehalfOf = approver;
  } else if (me.id === note.initiator_id) {
    fail(403, 'The initiator cannot decide their own note — route it to the approving authority');
  }
  const today = nowISO();
  let otpAt = null;
  if (otp != null && String(otp).trim() !== '') {
    if (!verifyOtp(me.pb, otp)) fail(422, 'Invalid one-time password');
    otpAt = today;
  }
  const approved = decision === 'approve';
  // A stage with an internal approval chain (Module E) is approved on the noting side only
  // once that chain is released; a rejection is never blocked.
  if (approved) {
    const block = releaseBlock(note);
    if (block) {
      const e = new Error(`Approval chain #${block.chainId} for ${note.ref_no} is not released — ${block.why.join('; ') || 'awaiting the CFA'}`);
      e.status = 409;
      e.details = { chainId: block.chainId, releaseBlockedBy: block.why };
      throw e;
    }
  }
  const isFinal = nextStage(note.stage_id) == null;
  closeInbound(note.id, onBehalfOf ?? me.id, decision);
  run(
    `INSERT INTO routing_steps(note_id,seq,from_member_id,to_member_id,purpose,state,action,comment,sent_at,actioned_at,on_behalf_of_id)
     VALUES(?,?,?,?, 'approve', 'actioned', ?, ?, ?, ?, ?)`,
    note.id, nextSeq(note.id), me.id, me.id, decision, (comment || '').trim() || null, today, today, onBehalfOf
  );

  // Append N{entrySeq} to noting_entries
  const entrySeq = nextEntrySeq(note.id);
  const decisionLabel = approved ? 'Approved' : 'Rejected';
  const decComment = normComment(comment, approved ? 'Concurred and Approved as proposed.' : 'Rejected.');
  run(
    `INSERT INTO noting_entries(note_id, seq, author_id, title, body, entry_type, remark, created_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    note.id, entrySeq, me.id, `N${entrySeq}: Final Decision (${decisionLabel}) by ${me.name || 'Approver'}`,
    decComment, approved ? 'approval' : 'rejection',
    `${decisionLabel} by deciding authority${onBehalfOf ? ` (on behalf of ${memberName(onBehalfOf)})` : ''}`, today
  );

  const status = approved ? 'approved' : 'rejected';
  run(
    `UPDATE notes SET status = ?, decision = ?, decided_by = ?, closed_at = ?, otp_verified_at = COALESCE(?, otp_verified_at) WHERE id = ?`,
    status, status, me.id, today, otpAt, note.id
  );
  if (!approved || isFinal) run(`UPDATE files SET status = 'closed', closed_at = ? WHERE id = ?`, today, note.file_pk);

  const file = get('SELECT initiator_id, tender_initiator_id FROM files WHERE id = ?', note.file_pk);
  const recipients = participants(note.id);
  for (const id of [file.initiator_id, file.tender_initiator_id]) if (id) recipients.add(id);
  run(`DELETE FROM cabinet WHERE note_id = ?`, note.id);
  for (const pid of recipients) {
    const reason = pid === file.initiator_id ? 'initiator'
      : pid === me.id ? 'approver'
      : pid === file.tender_initiator_id ? 'tender_initiator'
      : pid === note.initiator_id ? 'initiator' : 'router';
    run(`INSERT INTO cabinet(member_id,file_pk,note_id,reason,placed_at) VALUES(?,?,?,?,?)`, pid, note.file_pk, note.id, reason, today);
  }
  const decided = get('SELECT * FROM notes WHERE id = ?', note.id);
  if (!approved && hooks.onReject) {
    hooks.onReject({ note: decided, file: get('SELECT * FROM files WHERE id = ?', note.file_pk), me });
  }
  return decided;
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
  run(`DELETE FROM cabinet WHERE note_id = ?`, note.id);
  run(
    `INSERT INTO routing_steps(note_id,seq,from_member_id,to_member_id,purpose,state,action,comment,sent_at,actioned_at)
     VALUES(?,?,?,?, 'forward', 'opened', 'retrieve', 'Retrieved from cabinet', ?, ?)`,
    note.id, nextSeq(note.id), me.id, me.id, nowISO(), nowISO()
  );
  return get('SELECT * FROM notes WHERE id = ?', note.id);
}

// Provisioning → tendering hand-over (client, 13/09/2026): once provisioning is approved the
// proposal rests in the initiator's cabinet, and the initiator sends the file link to the
// member who will run the tender. That member becomes the proposal's tender initiator: the
// file lands in their cabinet, they may read every stage, and they generate EMD / TEC next.
export function handOverToTender(file, me, toId) {
  if (!me) fail(403, 'No noting member mapped to this account');
  if (file.initiator_id !== me.id) fail(403, 'Only the proposal initiator can send it to a tender initiator');
  if (!toId || toId === me.id) fail(422, 'Choose the member who will initiate the tender');
  if (!get('SELECT id FROM members WHERE id = ?', toId)) fail(422, 'Unknown member');
  if (file.status !== 'open') fail(409, 'Proposal is closed');
  const prov = get(
    `SELECT id FROM notes WHERE file_pk = ? AND stage_id = 'provisioning' AND status = 'approved' ORDER BY seq DESC LIMIT 1`,
    file.id
  );
  if (!prov) fail(409, 'The provisioning stage must be approved before the file goes to tendering');
  const today = nowISO();
  run(`UPDATE files SET tender_initiator_id = ?, tender_handover_at = ? WHERE id = ?`, toId, today, file.id);
  run(`DELETE FROM cabinet WHERE file_pk = ? AND reason = 'tender_initiator'`, file.id);
  run(`DELETE FROM cabinet WHERE member_id = ? AND note_id = ?`, toId, prov.id);
  run(`INSERT INTO cabinet(member_id,file_pk,note_id,reason,placed_at) VALUES(?,?,?, 'tender_initiator', ?)`, toId, file.id, prov.id, today);
  return get('SELECT * FROM files WHERE id = ?', file.id);
}

// The proposal at a glance (client: indentor / admin / tender initiator "should know what is
// the current status/stage of the proposal"): every stage file in order with its outcome and
// holder, the current stage, and — once it is approved — what the cascade sheet offers next
// (`next`) plus the stages one may skip ahead to (`other`). A stage the caller may not read
// shows only its stage title, with no subject and no link.
export function proposalStatus(file, me) {
  const person = (id) => (id ? get('SELECT id, name, designation, pb FROM members WHERE id = ?', id) : null);
  const stages = all(
    `SELECT n.id, n.file_pk, n.seq, n.ref_no, n.txn_id, n.stage_id, n.title, n.classification, n.status,
            n.created_at, n.closed_at, cm.name AS holder_name,
            (SELECT COUNT(*) FROM noting_entries ne WHERE ne.note_id = n.id) AS entry_count
     FROM notes n LEFT JOIN members cm ON cm.id = n.custodian_id
     WHERE n.file_pk = ? ORDER BY n.seq`,
    file.id
  ).map((n) => {
    const viewable = canView(n, me);
    return {
      seq: n.seq,
      ref_no: n.ref_no,
      stage_id: n.stage_id,
      stage_title: n.stage_id ? stageTitle(n.stage_id) : 'Note',
      title: viewable ? n.title : stageTitle(n.stage_id),
      txn_id: viewable ? n.txn_id : null,
      status: n.status,
      holder_name: active.has(n.status) ? n.holder_name : null,
      entry_count: n.entry_count,
      created_at: n.created_at,
      closed_at: n.closed_at,
      viewable
    };
  });
  const current = stages.at(-1) ?? null;
  const approved = current?.status === 'approved';
  const open = file.status === 'open';
  const awaitingHandOver = open && approved && current.stage_id === 'provisioning' && !file.tender_initiator_id;

  let next = approved ? followUps(current.stage_id) : [];
  if (!open) next = next.filter((o) => o.stageId === 'po_amendment');
  const offered = new Set(next.map((o) => o.stageId));
  const at = STAGE_ORDER.indexOf(current?.stage_id);
  const other = open && approved
    ? [...STAGE_ORDER.slice(at + 1), ...Object.keys(NEEDBASED)]
      .filter((id) => id !== 'provisioning' && id !== 'po_amendment' && !offered.has(id))
      .map((id) => ({ stageId: id, title: stageTitle(id), needBased: Object.hasOwn(NEEDBASED, id) }))
    : [];

  return {
    file: {
      id: file.id,
      file_id: file.file_id,
      title: file.title,
      car_no: file.car_no,
      status: file.status,
      initiator: person(file.initiator_id),
      tender_initiator: person(file.tender_initiator_id),
      tender_handover_at: file.tender_handover_at ?? null
    },
    stages,
    current,
    next,
    other,
    awaitingHandOver,
    canGenerate: Boolean(me) && !awaitingHandOver && isCaseMember(file, me) && next.length + other.length > 0,
    canHandOver: Boolean(me) && file.initiator_id === me.id && open &&
      stages.some((s) => s.stage_id === 'provisioning' && s.status === 'approved')
  };
}

// Routing history for the timeline (member names resolved, delegate hops labelled).
export function history(noteId) {
  return all(
    `SELECT rs.seq, rs.purpose, rs.state, rs.action, rs.comment, rs.sent_at, rs.opened_at, rs.actioned_at,
            rs.from_member_id AS from_id, rs.to_member_id AS to_id, rs.on_behalf_of_id,
            fm.name AS from_name, tm.name AS to_name, om.name AS on_behalf_of_name
     FROM routing_steps rs
     LEFT JOIN members fm ON fm.id = rs.from_member_id
     LEFT JOIN members tm ON tm.id = rs.to_member_id
     LEFT JOIN members om ON om.id = rs.on_behalf_of_id
     WHERE rs.note_id = ? ORDER BY rs.seq ASC`,
    noteId
  );
}

// Explicitly append a noting entry (N{seq}) to the active stage note sheet
export function addNotingEntry(note, me, { title, body, entryType = 'remark', remark } = {}) {
  requireHolder(note, me);
  if (!body || !body.trim()) fail(422, 'Entry body cannot be empty');
  const seq = nextEntrySeq(note.id);
  const entryTitle = (title || '').trim() || `N${seq}: Noting Entry by ${me.name || 'Officer'}`;
  run(
    `INSERT INTO noting_entries(note_id, seq, author_id, title, body, entry_type, remark, created_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    note.id, seq, me.id, entryTitle, body.trim(), entryType, remark || null, nowISO()
  );
  return get(
    `SELECT ne.*, m.name AS author_name, m.pb AS author_pb, m.designation AS author_designation
     FROM noting_entries ne
     LEFT JOIN members m ON m.id = ne.author_id
     WHERE ne.note_id = ? AND ne.seq = ?`,
    note.id, seq
  );
}

// Complete multi-stage history of a proposal for the cabinet — only the stage files the
// member may read (entries and routing trails carry the same content as the note itself).
export function fileStageHistory(filePk, me) {
  const notes = all(
    `SELECT n.*, im.name AS initiator_name, cm.name AS custodian_name, dm.name AS decider_name
     FROM notes n
     LEFT JOIN members im ON im.id = n.initiator_id
     LEFT JOIN members cm ON cm.id = n.custodian_id
     LEFT JOIN members dm ON dm.id = n.decided_by
     WHERE n.file_pk = ?
     ORDER BY n.seq ASC`,
    filePk
  );
  return notes.filter((nt) => canView(nt, me)).map((nt) => ({
    ...nt,
    stageTitle: stageTitle(nt.stage_id),
    entries: notingEntries(nt.id),
    history: history(nt.id)
  }));
}
