// The internal approval chain — what happens INSIDE one agency.
//
// The noting module routes a note member-to-member with no plan: whoever holds it picks
// the next person. That is faithful to how an e-file behaves, but it cannot answer "who
// still has to sign before this can leave?" — so nothing can be enforced.
//
// This module adds the plan. It comes from a real document: the approved Provisioning
// Note in sampleData prints its own routing table — 14 hops, 10 people, 7 departments,
// 34 days, all before the file reaches IMM. An originator drafts; his Chief Manager
// forwards; his DGM concurs; HR, Planning, Plant Maintenance, QC and Projects concur;
// the AGM(Finance) pushes it DOWN to his own DGM to examine; that DGM objects that no
// value is stated; the originator answers; Finance concurs twice more; GM(AOD) approves.
//
// Three things that chain teaches, and this module is built around them:
//
//  1. Grade does not gate the sequence. The real order runs
//     4 -> 6 -> 7 -> 7 -> 6 -> 7 -> 8 -> 8 -> 8 -> 7 -> **4** -> 7 -> 8 -> 9.
//     It descends twice. Grade decides AUTHORITY (who heads a unit, who is the CFA),
//     never who may come next.
//  2. Five hop types that forward/send-back/approve/reject cannot express — concurring
//     with a rider that binds a later stage, delegating downward to be examined, and
//     querying the originator without rejecting anything.
//  3. Who is required is decided by the checklist, not by a ladder. The release gate
//     will not let a file leave until every authority the answers named has acted.
//
// Money and DOP levels are not computed here. Mirrors ai/approval.py.

import crypto from 'crypto';
import * as checklist from './checklist.js';
import * as org from './org.js';

// Level -> the designation that signs at it. From ai/rules.py LEVEL_DESIG; the DOP-2025
// value bands that would let a level be COMPUTED from an amount are not in sampleData.
export const LEVEL_DESIG = { 'Level I': 'GM(AOD)', 'Level II': 'AGM(IMM-OH)' };

// `advances`: does the file move to the next planned slot, or stay/return?
// `by`: who may use it — the current holder, or only the CFA.
export const HOPS = {
  forward: {
    label: 'Forward', advances: true, by: 'holder',
    help: 'Pass it along (F1 N2: "forwarded for approval pl.")'
  },
  concur: {
    label: 'Concur & forward', advances: true, by: 'holder',
    help: 'Record concurrence and move on (F1 N3, N4, N6, N7)'
  },
  concur_with_rider: {
    label: 'Concur with a rider', advances: true, by: 'holder',
    help: 'Concur, attaching a condition that binds a LATER stage '
      + '(F1 N8: strip brand names from the tech spec before the RFQ goes out)'
  },
  examine: {
    label: 'Send down to examine', advances: false, by: 'holder',
    help: 'Delegate to a junior in your own unit and expect it back '
      + '(F1 N9 -> N10: AGM(Fin) writes "Pl examine")'
  },
  query: {
    label: 'Query the originator', advances: false, by: 'holder',
    help: 'Bounce a question back — not a rejection, the chain keeps its place (F1 N10 -> N11)'
  },
  return_to: {
    label: 'Send back to an earlier hop', advances: false, by: 'holder',
    help: 'Resume the chain from whoever you name'
  },
  approve: {
    label: 'Approve', advances: true, by: 'cfa',
    help: 'The CFA’s decision (F1 N14: "Approved / मंजूर")'
  },
  reject: {
    label: 'Reject', advances: true, by: 'cfa',
    help: 'The CFA’s decision — closes the file'
  }
};

// F1's N3/N4/N6/N7 all carry this exact string, Hindi half included.
export const CONCUR_DEFAULT = 'Concurred and Forwarded / सहमत एवं भेजा गया';

// Annexure 21A Para C, added by Amendment no. 1 dt. 29-01-2024
// (sampleData/HAL PURCHASE FORMATS.../HAL Std Formats/TEC FORMAT.pdf)
export const COI_DECLARATION =
  'I/We declare that I/we have no conflict of interest with any of the bidder/s in this tender.';

const SYMBOLS = new Set([...'.,;:*-_/\\|!~`\'"()[]{} \t']);

export const SERIAL = 'serial';
export const COMMITTEE = 'committee';

// Only what sampleData evidences. `concurrences` for provisioning is read off F1's own
// routing table. Every other note gets an empty set rather than an invented one: the
// tendering-side chains have no sample note here, and guessing them would be worse than
// admitting the gap. Each concurrence lists acceptable departments in preference order,
// because F1's "INSPCTION" is QC in some divisions and QA or QE in others.
export const NOTE_CHAINS = {
  provisioning: {
    mode: SERIAL,
    agency: 'Indenting',
    label: 'Provisioning Note',
    concurrences: [
      { depts: ['HR'], minGrade: 7, from: 'F1 N4 — DGM (HR)' },
      { depts: ['PLANNING', 'PROJECT PLANNING'], minGrade: 6, from: 'F1 N5 — CM (PPO)' },
      { depts: ['PLANT MAINTENANCE'], minGrade: 7, from: 'F1 N6 — DGM (Maint.)' },
      { depts: ['QC', 'QA', 'QE'], minGrade: 8, from: 'F1 N7 — AGM (QC), Inspection' },
      { depts: ['PROJECT PLANNING', 'PLANNING'], minGrade: 8, from: 'F1 N8 — AGM (Proj & Plg)' }
    ],
    finance: true,
    source: 'F1 Approved Provisioning Note 6005612025.pdf — routing table N1-N14'
  },
  tec_report: {
    mode: COMMITTEE, agency: 'Indenting', label: 'TEC Report',
    concurrences: [], finance: false, committeeSpecs: [],
    source: 'HAL Std Formats/TEC FORMAT.pdf (Annexure 21A, Para C + members table)'
  },
  tec_query: {
    mode: SERIAL, agency: 'Indenting', label: 'TEC Query Note',
    concurrences: [], finance: false,
    source: 'cascade sheet column H (stage 3) — no sample note in sampleData'
  },
  pnc_req: {
    mode: COMMITTEE, agency: 'Tendering', label: 'PNC Request',
    concurrences: [], finance: true,
    committeeSpecs: ['AGM(Fin) - Chairman (senior-most & Finance)',
      'AGM(IMM) - Member Secretary', 'DGM(Sec & Fire) - Member (user)',
      'DGM(Purchase) - Member'],
    source: 'F5 Note for PNC req.docx — named committee'
  },
  pnc_rec: {
    mode: COMMITTEE, agency: 'Tendering', label: 'PNC Recommendation',
    concurrences: [], finance: true,
    committeeSpecs: ['AGM(Fin) - Chairman (senior-most & Finance)',
      'AGM(IMM) - Member Secretary', 'DGM(Sec & Fire) - Member (user)',
      'DGM(Purchase) - Member'],
    source: 'F6 Note for PNC Recommendation.docx — same committee'
  }
};

const DEFAULT_CHAIN = {
  mode: SERIAL, agency: 'Tendering', label: 'Note', concurrences: [], finance: true,
  source: 'no sample note in sampleData for this note'
};

export const chainShape = (noteId) => NOTE_CHAINS[noteId] ?? DEFAULT_CHAIN;
export const noteOptions = () =>
  Object.entries(NOTE_CHAINS).map(([id, s]) => ({ id, label: s.label, mode: s.mode, agency: s.agency }));

// -- slots -------------------------------------------------------------------
function slot({ kind, title, res = {}, why = '', required = true, external = false, autoPick = true }) {
  const { person, chose } = external ? { person: null, chose: false }
    : (autoPick ? org.pick(res) : { person: null, chose: false });
  return {
    kind,
    title,
    why,
    required,
    external,
    person,
    chose,
    caveats: external ? [] : org.caveatsOf(res, chose),
    ambiguous: Boolean(res?.ambiguous),
    candidates: (res?.candidates ?? []).map((p) => ({ pb: p.pb, name: p.name, grade: p.grade, dept: p.deptRaw })),
    actioned: false,
    action: null
  };
}

// Resolve every position the chain needs, BEFORE anyone is asked to act. Nothing is
// guessed silently: a slot the directory cannot fill, or fills only by breaking a tie,
// records that in `caveats`.
export function buildPlan({
  noteId = 'provisioning', division, answers = null, originatorPb = null,
  originatorDept = null, autoPick = true
}) {
  const ans = answers ?? checklist.defaultAnswers();
  const shape = chainShape(noteId);
  const slots = [];

  // 1 — originator
  let originator = originatorPb ? org.byPb(originatorPb) : null;
  if (!originator && originatorDept) {
    const pool = org.people({ division, dept: originatorDept, minGrade: 3, maxGrade: 4 });
    const res = {
      person: pool.length === 1 ? pool[0] : null,
      candidates: [...pool].sort((a, b) => (a.pb < b.pb ? -1 : 1)),
      ambiguous: pool.length > 1,
      unit: `${org.normDept(originatorDept)}/${division}`,
      poolSize: pool.length
    };
    const s = slot({
      kind: 'originator', title: 'Originator (raises the indent)', res,
      why: 'the requisitioning department', autoPick
    });
    originator = s.person;
    slots.push(s);
  } else if (originator) {
    slots.push({
      ...slot({
        kind: 'originator', title: 'Originator (raises the indent)',
        res: { person: originator, candidates: [originator] }, why: 'named'
      }),
      person: originator
    });
  }

  const dept = originator?.deptRaw ?? originatorDept;

  if (shape.mode === SERIAL) {
    // 2 — section check: the next rung up inside the same department.
    if (originator) {
      slots.push(slot({
        kind: 'section_check', title: 'Section check (next rung, same department)',
        res: org.nextUp(originator), autoPick,
        why: 'F1 N2 — the Chief Manager (Security) checked the Manager’s note'
      }));
    }
    // 3 — department head
    if (dept) {
      slots.push(slot({
        kind: 'dept_head', title: `Head of ${org.normDept(dept)}`,
        res: org.headOf(division, dept), autoPick,
        why: 'F1 N3 — the DGM (Security) cleared it for the department'
      }));
    }
    // 4 — cross-department concurrences
    for (const c of shape.concurrences) {
      const res = org.inDept(division, c.depts, { minGrade: c.minGrade });
      const label = res.unit.split('/')[0] || c.depts.join('/');
      slots.push(slot({
        kind: 'concurrence', title: `Concurrence — ${label}`, res, autoPick,
        why: `${c.from} (grade ${c.minGrade}+)`
      }));
    }
  }

  // 5 — Finance, two-tier. Bound to Finance: an AGM from another department is not this.
  if (shape.finance) {
    const fin = ['FINANCE', 'ACCOUNTS', 'BOOK KEEPING'];
    slots.push(slot({
      kind: 'finance_head', title: 'Finance concurrence — AGM (Finance)',
      res: org.inDept(division, fin, { want: 8 }), autoPick,
      why: 'F1 N9/N13 — AGM(Finance) took it and finally concurred'
    }));
    slots.push(slot({
      kind: 'finance_examine', title: 'Finance scrutiny — DGM (Finance)',
      res: org.inDept(division, fin, { want: 7 }), autoPick,
      why: 'F1 N10/N12 — "Pl examine" sent it down; the DGM raised the query'
    }));
  }

  // 6 — whatever the checklist answers made mandatory
  const injected = checklist.injected(ans);
  for (const inj of injected) {
    if (inj.kind === 'cfa') continue;                     // handled as the CFA slot below
    if (inj.external) {
      slots.push(slot({
        kind: inj.kind, title: inj.authority, external: true, why: inj.why
      }));
      continue;
    }
    let res;
    if (inj.kind === 'head_of_division') res = org.headOfDivision(division);
    else if (inj.kind === 'dop_authority') res = org.resolveAuthority('GM', division);
    else if (inj.kind === 'indigenisation_cell') {
      res = org.inDept(division, ['PROJECT PLANNING', 'PLANNING', 'MSD'], { minGrade: 7 });
    } else if (inj.kind === 'committee') res = org.headOfDivision(division);
    else res = { person: null, candidates: [], ambiguous: false };
    slots.push(slot({
      kind: inj.kind, title: inj.authority, res, autoPick,
      why: `checklist ${inj.block} sl ${inj.sl} = "${inj.answer}" — ${inj.why.slice(0, 110)}`
    }));
  }

  // 7 — the CFA. The level is taken from the checklist, never computed from the amount.
  const dopLevel = checklist.dopLevel(ans);
  const desig = LEVEL_DESIG[dopLevel] ?? 'GM(AOD)';
  const cfa = slot({
    kind: 'cfa', title: `CFA — ${desig} (${dopLevel ?? 'level not stated'})`,
    res: org.resolveAuthority(desig, division), autoPick,
    why: `DOP level from ${dopLevel ? 'checklist provisioning sl 11' : 'nothing on file'}; `
      + 'DOP-2025 value bands are absent from sampleData, so the level is human-supplied'
  });
  slots.push(cfa);

  const plan = {
    noteId,
    label: shape.label,
    mode: shape.mode,
    agency: shape.agency,
    division,
    shapeSource: shape.source,
    originator: originator ? { ...originator } : null,
    dopLevel,
    dopLevelSource: dopLevel ? 'checklist provisioning sl 11' : null,
    dopLevelComputed: false,
    committeeSpecs: shape.mode === COMMITTEE ? [...(shape.committeeSpecs ?? [])] : [],
    injected,
    slots
  };
  plan.unresolved = slots.filter((s) => !s.person && !s.external && s.required).length;
  plan.ambiguousCount = slots.filter((s) => s.ambiguous).length;
  plan.externalCount = slots.filter((s) => s.external).length;
  return plan;
}

// -- the walk ----------------------------------------------------------------
export function cleanComment(text, fallback = CONCUR_DEFAULT) {
  const t = String(text ?? '').trim();
  if (!t || [...t].every((ch) => SYMBOLS.has(ch))) return fallback;
  return t;
}

// A per-hop transaction id in HAL's own shape. The real note stamps every HOP, not every
// note: 11F6-669B568D-1DC1C-165F65DF9-0001 ... -000E. Derived from a hash rather than
// randomly so a replay is reproducible.
export function txnId(fileId, seq, pb) {
  const h = crypto.createHash('md5').update(`${fileId}:${seq}:${pb}`).digest('hex').toUpperCase();
  const f = crypto.createHash('md5').update(String(fileId)).digest('hex').toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4, 13)}-${h.slice(13, 18)}-${f.slice(0, 9)}-${String(seq).padStart(4, '0')}`;
}

export const todayDMY = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// Append a hop. Hops are append-only — a query or a send-back ADDS a hop, it never
// rewrites one, which is how the real note reads (N11 answers N10 in place).
export function addHop(chain, { person, action, comment = '', slotIndex = null,
  when = null, twoFactor = false, rider = '' }) {
  if (!HOPS[action]) throw new Error(`unknown hop type: ${action}`);
  const seq = chain.hops.length + 1;
  const fallback = action.startsWith('concur') ? CONCUR_DEFAULT : '';
  const hop = {
    seq,
    note: `N${seq}`,
    pb: person?.pb ?? null,
    name: person?.name ?? '',
    designation: person?.grade ?? person?.designation ?? '',
    dept: person?.deptRaw ?? '',
    division: person?.division ?? '',
    gradeLevel: person?.gradeLevel ?? null,
    slotIndex,
    action,
    comment: fallback ? cleanComment(comment, fallback) : String(comment ?? '').trim(),
    date: when || todayDMY(),
    txnId: txnId(chain.fileId, seq, person?.pb ?? '?'),
    twoFactor: Boolean(twoFactor),
    rider: rider || ''
  };
  chain.hops.push(hop);
  if (rider) {
    chain.riders.push({ hop: hop.note, by: person?.name ?? '?', condition: rider, recorded: true });
  }
  if (slotIndex != null && chain.plan.slots[slotIndex]) {
    chain.plan.slots[slotIndex].actioned = true;
    chain.plan.slots[slotIndex].action = action;
  }
  if (action === 'approve' || action === 'reject') {
    chain.decision = action;
    chain.closed = true;
  }
  return hop;
}

export function newChain(plan, fileId = '0000000000') {
  return { plan, fileId, hops: [], riders: [], decision: null, closed: false };
}

// THE GATE. Three conditions, all from the sample data: the CFA has decided, every
// authority the checklist made mandatory has acted, and every rider is on record.
export function releaseReady(chain) {
  const why = [];
  if (chain.decision !== 'approve') {
    why.push(chain.decision === null
      ? 'the CFA has not approved'
      : `the CFA ${chain.decision}ed — the file is closed, not released`);
  }
  for (const s of chain.plan.slots) {
    if (!s.required || s.kind === 'originator' || s.kind === 'cfa') continue;
    if (s.external && !s.actioned) {
      why.push(`${s.title} is outside HAL and has not been recorded as obtained`);
    } else if (!s.actioned) {
      why.push(`${s.title} has not acted`);
    }
  }
  for (const r of chain.riders) if (!r.recorded) why.push(`rider from ${r.hop} is not recorded`);
  return { ok: why.length === 0, why };
}

export const gradePath = (chain) => chain.hops.map((h) => h.gradeLevel).filter((g) => g != null);

export function elapsedDays(chain) {
  const ds = chain.hops.map((h) => h.date).filter(Boolean);
  if (ds.length < 2) return null;
  const parse = (s) => {
    const [d, m, y] = s.split('/').map(Number);
    return Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y) ? new Date(y, m - 1, d) : null;
  };
  const a = parse(ds[0]);
  const b = parse(ds[ds.length - 1]);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}

// Which hop types this desk may use right now, and who is next in the plan.
export function nextActor(chain) {
  const pending = chain.plan.slots
    .map((s, i) => ({ ...s, index: i }))
    .filter((s) => !s.actioned && s.person && s.kind !== 'originator');
  const cfaIdx = chain.plan.slots.findIndex((s) => s.kind === 'cfa');
  const cfa = cfaIdx >= 0 ? { ...chain.plan.slots[cfaIdx], index: cfaIdx } : null;
  const nonCfa = pending.filter((s) => s.kind !== 'cfa');
  const next = nonCfa.length ? nonCfa[0] : cfa;
  const atCfa = !nonCfa.length;
  const allowed = atCfa
    ? ['approve', 'reject', 'concur', 'forward', 'query']
    : ['concur', 'concur_with_rider', 'forward', 'examine', 'query'];
  return { next, allowed, pendingCount: nonCfa.length, atCfa };
}

export function serialize(chain) {
  const gate = releaseReady(chain);
  return {
    fileId: chain.fileId,
    plan: chain.plan,
    hops: chain.hops,
    riders: chain.riders,
    decision: chain.decision,
    closed: chain.closed,
    released: gate.ok,
    releaseBlockedBy: gate.why,
    gradePath: gradePath(chain),
    monotonic: gradePath(chain).every((g, i, a) => i === 0 || a[i - 1] <= g),
    elapsedDays: elapsedDays(chain),
    ...nextActor(chain)
  };
}

// -- committee mode ----------------------------------------------------------
// Stage 3 is not a chain. Annexure 21A wants a members table — signature, designation,
// date — and since Amendment 1 dt 29-01-2024, a conflict-of-interest declaration from
// each of them. Order does not matter; completeness does.
export function buildCommittee(noteId, specs, division, { autoPick = true } = {}) {
  const shape = chainShape(noteId);
  const members = (specs ?? []).map((spec) => {
    const head = String(spec).split('-')[0].trim();
    const role = String(spec).includes('-') ? String(spec).split('-').slice(1).join('-').trim() : 'Member';
    const res = org.resolveAuthority(head, division);
    const { person, chose } = autoPick ? org.pick(res) : { person: null, chose: false };
    return {
      spec, role, person,
      caveats: org.caveatsOf(res, chose),
      signed: false, coiDeclared: false, date: null, remark: ''
    };
  });
  return {
    noteId, division, source: shape.source, declaration: COI_DECLARATION,
    sourced: Boolean((shape.committeeSpecs ?? []).length), members
  };
}

// (ok, reasons). Every member must have signed AND declared no conflict — an unsigned
// member or an undeclared conflict blocks the report.
export function committeeComplete(com) {
  const why = [];
  if (!com.members.length) why.push('no members named');
  for (const m of com.members) {
    const who = m.person?.name ?? m.spec ?? '?';
    if (!m.signed) why.push(`${who} has not signed`);
    else if (!m.coiDeclared) why.push(`${who} has not made the conflict-of-interest declaration`);
  }
  return { ok: why.length === 0, why };
}

export default {
  HOPS, CONCUR_DEFAULT, COI_DECLARATION, LEVEL_DESIG, SERIAL, COMMITTEE, NOTE_CHAINS,
  chainShape, noteOptions, buildPlan, newChain, addHop, releaseReady, gradePath,
  elapsedDays, nextActor, serialize, buildCommittee, committeeComplete, cleanComment,
  txnId, todayDMY
};
