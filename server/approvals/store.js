// Persistence for approval chains, committees and filled checklists.
//
// The plan is snapshotted into the row at creation, the same discipline the contracts
// module uses for clause text: a later change in the personnel sheet must not silently
// rewrite who was required on a chain already in flight.
//
// Hops are append-only. Every mutation re-derives the release gate from the stored plan
// plus the stored hops, so the gate can never drift from what actually happened.
//
// Identity: a hop is recorded against the planned position holder, and ALSO against the
// signed-in user who pressed the button (acted_by, acted_by_pb). A user whose PB is in the
// personnel directory may only act as themselves; the demo accounts are not in that
// directory, so their hops are marked on_behalf — visible on the trail, never hidden.

import { findById } from '../auth/users.js';
import { verify as verifyOtp } from '../auth/otp.js';
import { all, get, nowStamp, run } from './db.js';
import * as chain from './chain.js';
import * as checklist from './checklist.js';
import * as org from './org.js';

const J = (v) => JSON.stringify(v ?? null);
const P = (v, fallback = null) => {
  if (v == null) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

// -- checklist submissions ---------------------------------------------------
export function saveSubmission({ caseRef, title, division, dept, answers, requisitionId = null, user }) {
  const dop = checklist.dopLevel(answers);
  const r = run(
    `INSERT INTO checklist_submissions
       (case_ref, title, division, dept, answers, dop_level, requisition_id, created_by, created_by_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    caseRef ?? null, title ?? null, division, dept ?? null, J(answers), dop, requisitionId ?? null,
    user?.id ?? null, user?.name ?? null, nowStamp()
  );
  return getSubmission(Number(r.lastInsertRowid));
}

export function getSubmission(id) {
  const row = get('SELECT * FROM checklist_submissions WHERE id = ?', id);
  if (!row) return null;
  return { ...row, answers: P(row.answers, {}) };
}

export function listSubmissions() {
  return all('SELECT id, case_ref, title, division, dept, dop_level, requisition_id, created_by_name, created_at '
    + 'FROM checklist_submissions ORDER BY id DESC');
}

// -- chains ------------------------------------------------------------------
export function createChain({
  noteId, division, dept, caseRef, answers, originatorPb, submissionId, fileId,
  notingNoteId = null, requisitionId = null, user
}) {
  const plan = chain.buildPlan({ noteId, division, answers, originatorPb, originatorDept: dept });
  const stamp = nowStamp();
  const fid = fileId || `AOD/${String(noteId).toUpperCase().slice(0, 4)}/${Date.now().toString().slice(-8)}`;
  const r = run(
    `INSERT INTO approval_chains
       (file_id, note_id, label, mode, agency, division, dept, case_ref, submission_id,
        plan, answers, dop_level, decision, closed, released, noting_note_id, requisition_id,
        created_by, created_by_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, ?, ?, ?, ?, ?)`,
    fid, noteId, plan.label, plan.mode, plan.agency, division, dept ?? null,
    caseRef ?? null, submissionId ?? null, J(plan), J(answers ?? null), plan.dopLevel,
    notingNoteId ?? null, requisitionId ?? null,
    user?.id ?? null, user?.name ?? null, stamp
  );
  return loadChain(Number(r.lastInsertRowid));
}

// Rehydrate a chain and replay its hops through the model, so the plan's `actioned`
// flags, the riders and the gate are derived rather than stored twice.
export function loadChain(id) {
  const row = get('SELECT * FROM approval_chains WHERE id = ?', id);
  if (!row) return null;
  const plan = P(row.plan, null);
  if (!plan) return null;
  for (const s of plan.slots) {
    s.actioned = false;
    s.action = null;
  }
  const live = chain.newChain(plan, row.file_id);
  const hops = all('SELECT * FROM approval_hops WHERE chain_id = ? ORDER BY seq', id);
  const riders = [];
  for (const h of hops) {
    live.hops.push({
      seq: h.seq, note: h.note, pb: h.pb, name: h.name, designation: h.designation,
      dept: h.dept, division: h.division, gradeLevel: h.grade_level,
      slotIndex: h.slot_index, action: h.action, comment: h.comment, date: h.hop_date,
      txnId: h.txn_id, twoFactor: Boolean(h.two_factor), rider: h.rider || '',
      riderRef: h.rider_ref ?? null,
      actedBy: h.acted_by, actedByPb: h.acted_by_pb ?? null, onBehalf: Boolean(h.on_behalf)
    });
    if (h.rider) riders.push({ hop: h.note, seq: h.seq, by: h.name, condition: h.rider, recorded: false });
    if (h.action === 'discharge_rider' && h.rider_ref != null) {
      const r = riders.find((x) => x.seq === h.rider_ref);
      if (r) r.recorded = true;
    }
    // Only a hop that advances fills its planned position (chain.HOPS[].advances).
    if (chain.HOPS[h.action]?.advances && h.slot_index != null && plan.slots[h.slot_index]) {
      plan.slots[h.slot_index].actioned = true;
      plan.slots[h.slot_index].action = h.action;
    }
    if (h.action === 'approve' || h.action === 'reject') {
      live.decision = h.action;
      live.closed = true;
    }
  }
  live.riders = riders;
  return {
    id: row.id,
    caseRef: row.case_ref,
    dept: row.dept,
    submissionId: row.submission_id,
    notingNoteId: row.noting_note_id ?? null,
    requisitionId: row.requisition_id ?? null,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    answers: P(row.answers, null),
    ...chain.serialize(live)
  };
}

export function listChains() {
  const rows = all('SELECT id, file_id, note_id, label, mode, agency, division, dept, '
    + 'case_ref, decision, closed, released, noting_note_id, requisition_id, created_by_name, created_at '
    + 'FROM approval_chains ORDER BY id DESC');
  for (const r of rows) {
    const c = get('SELECT COUNT(*) AS c, MAX(seq) AS last FROM approval_hops WHERE chain_id = ?', r.id);
    r.hops = c?.c ?? 0;
    r.lastNote = c?.last ? `N${c.last}` : null;
    r.status = r.decision ? (r.decision === 'approve' ? 'Approved' : 'Rejected')
      : (r.hops ? 'In progress' : 'Not started');
  }
  return rows;
}

// Who may act as whom. A signed-in user whose PB is in the personnel directory may only
// act as themselves; admin may act as any position; a PB outside the directory (the demo
// accounts) is not bound, and the hop is marked on_behalf instead.
export function bindingError(actorPb, person, isAdmin) {
  if (isAdmin || !actorPb || !person) return null;
  if (!org.byPb(actorPb)) return null;
  if (String(person.pb) === String(actorPb)) return null;
  return `You are signed in as PB ${actorPb}; this position belongs to ${person.name} (PB ${person.pb})`;
}

// An external authority (e.g. the Ministry) has no directory entry; its clearance is
// recorded as a hop against a synthetic person so the gate can see it was obtained.
const externalPerson = (slot) => ({
  pb: 'EXTERNAL', name: slot.title, grade: 'outside HAL', designation: slot.title,
  deptRaw: '', dept: '', division: '', gradeLevel: null
});

// Record one hop. Returns { ok, error } on a refusal so routes can answer 422 rather
// than throwing. `when` is never taken from the client; `otp`, if given, must verify.
export function act(id, { action, slotIndex = null, pb = null, comment = '',
  rider = '', riderRef = null, otp = null, user = null }) {
  const stored = loadChain(id);
  if (!stored) return { ok: false, error: 'No such chain' };
  if (stored.closed) return { ok: false, error: 'This note is already decided — reopen is not modelled' };
  if (!chain.HOPS[action]) return { ok: false, error: `Unknown action "${action}"` };
  if (action === 'assign') return { ok: false, error: 'Name a position through POST /chains/:id/slots/:index/assign' };

  const actorUser = user?.id ? findById(user.id) : null;
  const actorPb = actorUser?.pb ?? null;
  const isAdmin = user?.role === 'admin';

  const plan = stored.plan;
  let idx = slotIndex;
  let person = null;

  if (idx != null && plan.slots[idx]) {
    const s = plan.slots[idx];
    person = s.person ?? (s.external ? externalPerson(s) : null);
    if (!person) return { ok: false, error: `${s.title} has nobody named — assign a person to the position first` };
  } else if (pb) {
    // A hop by somebody not in the plan — a junior asked to examine, or the originator
    // answering a query. Legitimate: F1's N11 is the originator, mid-chain.
    const inPlan = plan.slots.find((s) => s.person?.pb === String(pb));
    person = inPlan?.person ?? org.byPb(pb);
    idx = null;
  } else {
    const nxt = chain.nextActor({ plan, hops: stored.hops, riders: [], decision: null, closed: false });
    person = nxt.next?.person ?? null;
    idx = nxt.next?.index ?? null;
  }
  if (!person) return { ok: false, error: 'Could not work out who is acting' };

  const bind = bindingError(actorPb, person, isAdmin);
  if (bind) return { ok: false, error: bind };

  if (action === 'approve' || action === 'reject') {
    const cfa = plan.slots.find((s) => s.kind === 'cfa');
    if (cfa && cfa.person && person.pb !== cfa.person.pb) {
      return {
        ok: false,
        error: `Only the CFA (${cfa.person.name}, ${cfa.person.grade}) may ${action} this note`
      };
    }
  }

  if (action === 'discharge_rider') {
    const target = stored.riders.find((r) => r.seq === Number(riderRef));
    if (!target) return { ok: false, error: 'riderRef must name the hop that carried the rider' };
    if (target.recorded) return { ok: false, error: 'That rider is already recorded as discharged' };
  }

  let twoFactor = false;
  if (otp != null && String(otp).trim() !== '') {
    if (!verifyOtp(actorPb, otp)) return { ok: false, error: 'Invalid one-time password' };
    twoFactor = true;
  }

  const seq = stored.hops.length + 1;
  const fallback = action.startsWith('concur') ? chain.CONCUR_DEFAULT : '';
  const text = fallback ? chain.cleanComment(comment, fallback) : String(comment ?? '').trim();
  const stamp = nowStamp();
  const onBehalf = String(person.pb) !== String(actorPb ?? '');

  run(
    `INSERT INTO approval_hops
       (chain_id, seq, note, pb, name, designation, dept, division, grade_level,
        slot_index, action, comment, hop_date, txn_id, two_factor, rider, rider_ref,
        acted_by, acted_by_pb, on_behalf, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, seq, `N${seq}`, person.pb, person.name, person.grade ?? person.designation,
    person.deptRaw ?? person.dept, person.division, person.gradeLevel ?? null,
    idx, action, text, chain.todayDMY(),
    chain.txnId(stored.fileId, seq, person.pb), twoFactor ? 1 : 0, rider || null,
    riderRef != null ? Number(riderRef) : null,
    user?.id ?? null, actorPb, onBehalf ? 1 : 0, stamp
  );

  const after = loadChain(id);
  const decided = action === 'approve' || action === 'reject';
  run('UPDATE approval_chains SET decision = ?, closed = ?, released = ?, closed_at = ? WHERE id = ?',
    after.decision ?? null, after.closed ? 1 : 0, after.released ? 1 : 0,
    decided ? stamp : null, id);

  return { ok: true, chain: loadChain(id) };
}

// Name the holder of a position the directory could not fill. The plan snapshot is
// updated and an `assign` hop records who named whom; nothing is marked as acted.
export function assignSlot(id, { slotIndex, pb, user = null }) {
  const row = get('SELECT * FROM approval_chains WHERE id = ?', id);
  if (!row) return { ok: false, error: 'No such chain' };
  if (row.closed) return { ok: false, error: 'This note is already decided' };
  const plan = P(row.plan, null);
  const s = plan?.slots?.[slotIndex];
  if (!s) return { ok: false, error: 'No such position' };
  if (s.external) return { ok: false, error: `${s.title} is outside HAL — record its clearance as a concurrence instead` };
  if (s.person) return { ok: false, error: `${s.title} is already named (${s.person.name})` };
  const person = org.byPb(pb);
  if (!person) return { ok: false, error: `PB ${pb} is not in the personnel directory` };

  s.person = { ...person };
  s.chose = true;
  s.caveats = [...(s.caveats ?? []), `named by ${user?.name ?? user?.id ?? 'the desk'} — the directory could not fill this position`];
  plan.unresolved = plan.slots.filter((x) => !x.person && !x.external && x.required).length;
  run('UPDATE approval_chains SET plan = ? WHERE id = ?', J(plan), id);

  const seq = (get('SELECT COUNT(*) AS c FROM approval_hops WHERE chain_id = ?', id)?.c ?? 0) + 1;
  const actorUser = user?.id ? findById(user.id) : null;
  run(
    `INSERT INTO approval_hops
       (chain_id, seq, note, pb, name, designation, dept, division, grade_level,
        slot_index, action, comment, hop_date, txn_id, two_factor, rider, rider_ref,
        acted_by, acted_by_pb, on_behalf, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'assign', ?, ?, ?, 0, NULL, NULL, ?, ?, 1, ?)`,
    id, seq, `N${seq}`, person.pb, person.name, person.grade, person.deptRaw, person.division,
    person.gradeLevel ?? null, slotIndex,
    `Position "${s.title}" named by ${user?.name ?? 'the desk'}`, chain.todayDMY(),
    chain.txnId(row.file_id, seq, person.pb), user?.id ?? null, actorUser?.pb ?? null, nowStamp()
  );
  return { ok: true, chain: loadChain(id) };
}

// -- committees --------------------------------------------------------------
export function createCommittee({ noteId, division, caseRef, specs, user }) {
  const shape = chain.chainShape(noteId);
  const list = (specs?.length ? specs : shape.committeeSpecs) ?? [];
  const built = chain.buildCommittee(noteId, list, division);
  const r = run(
    `INSERT INTO approval_committees (note_id, division, case_ref, source, sourced, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    noteId, division, caseRef ?? null, built.source,
    (shape.committeeSpecs ?? []).length ? 1 : 0, user?.id ?? null, nowStamp()
  );
  const cid = Number(r.lastInsertRowid);
  for (const m of built.members) {
    run(
      `INSERT INTO approval_committee_members
         (committee_id, spec, role, pb, name, designation, caveats, signed, coi_declared)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      cid, m.spec, m.role, m.person?.pb ?? null, m.person?.name ?? null,
      m.person?.grade ?? null, J(m.caveats)
    );
  }
  return loadCommittee(cid);
}

export function loadCommittee(id) {
  const row = get('SELECT * FROM approval_committees WHERE id = ?', id);
  if (!row) return null;
  const members = all('SELECT * FROM approval_committee_members WHERE committee_id = ? ORDER BY id', id)
    .map((m) => ({
      id: m.id, spec: m.spec, role: m.role,
      person: m.pb ? { pb: m.pb, name: m.name, grade: m.designation } : null,
      caveats: P(m.caveats, []),
      signed: Boolean(m.signed), coiDeclared: Boolean(m.coi_declared),
      date: m.member_date, remark: m.remark
    }));
  const state = chain.committeeComplete({ members });
  return {
    id: row.id, noteId: row.note_id, division: row.division, caseRef: row.case_ref,
    source: row.source, sourced: Boolean(row.sourced),
    declaration: chain.COI_DECLARATION,
    createdAt: row.created_at,
    members, complete: state.ok, blockedBy: state.why
  };
}

export function listCommittees() {
  return all('SELECT c.id, c.note_id, c.division, c.case_ref, c.sourced, c.created_at, '
    + 'COUNT(m.id) AS members, SUM(m.signed) AS signed '
    + 'FROM approval_committees c LEFT JOIN approval_committee_members m '
    + 'ON m.committee_id = c.id GROUP BY c.id ORDER BY c.id DESC');
}

export function signMember(committeeId, memberId, { coiDeclared, remark }) {
  const m = get('SELECT * FROM approval_committee_members WHERE id = ? AND committee_id = ?',
    memberId, committeeId);
  if (!m) return { ok: false, error: 'No such committee member' };
  run('UPDATE approval_committee_members SET signed = 1, coi_declared = ?, member_date = ?, remark = ? WHERE id = ?',
    coiDeclared ? 1 : 0, chain.todayDMY(), remark ?? '', memberId);
  return { ok: true, committee: loadCommittee(committeeId) };
}

export default {
  saveSubmission, getSubmission, listSubmissions,
  createChain, loadChain, listChains, act, assignSlot, bindingError,
  createCommittee, loadCommittee, listCommittees, signMember
};
