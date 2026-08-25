// Module E — internal approval chains, mounted gated at /api/approvals.
//
// What this adds over the noting module: noting routes a note member-to-member with no
// plan, so nothing can be enforced. Here the chain is resolved BEFORE anyone acts — from
// the indentor's own checklist answers plus the personnel directory — and a release gate
// refuses to let the file leave the agency until every required authority has acted.
//
// Read-only endpoints need no store; only live chains and committees are persisted.

import { Router } from 'express';
import * as bids from '../../approvals/bids.js';
import * as chain from '../../approvals/chain.js';
import * as checklist from '../../approvals/checklist.js';
import * as org from '../../approvals/org.js';
import * as store from '../../approvals/store.js';

const router = Router();

const fail = (res, code, error) => res.status(code).json({ error });

// -- reference data ----------------------------------------------------------

// Everything a screen needs to render its controls: notes, units, hop vocabulary.
router.get('/meta', (_req, res) => {
  res.json({
    notes: chain.noteOptions(),
    divisions: org.divisions(),
    unitTree: org.unitTree(),
    hops: Object.entries(chain.HOPS).map(([id, h]) => ({ id, ...h })),
    concurDefault: chain.CONCUR_DEFAULT,
    coiDeclaration: chain.COI_DECLARATION,
    levelDesig: chain.LEVEL_DESIG,
    directory: org.summary(),
    checklist: checklist.summary(),
    bidsAvailable: bids.available(),
    // Stated plainly so no screen has to imply otherwise.
    limits: {
      dopBands: 'DOP-2025 Annexure-3 value bands are not in sampleData, so a CFA level '
        + 'cannot be computed from the amount. It is read from the checklist and marked '
        + 'human-supplied.',
      headOfUnit: 'The personnel sheet has no head-of-unit column. Where the top grade in '
        + 'a unit is tied, every candidate is returned and the tie is reported, not resolved.',
      tecCommittee: 'No document in sampleData states who sits on a TEC, so that '
        + 'composition is never generated.'
    }
  });
});

// The personnel directory, filterable. This is who the chain resolves approvers against.
router.get('/directory', (req, res) => {
  const { division, dept, minGrade, q } = req.query;
  let rows = org.people({
    division: division || undefined,
    dept: dept || undefined,
    minGrade: minGrade ? Number(minGrade) : undefined
  });
  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter((p) => `${p.name} ${p.pb} ${p.deptRaw} ${p.grade}`.toLowerCase().includes(needle));
  }
  res.json({
    total: rows.length,
    people: rows.slice(0, 500).map((p) => ({
      pb: p.pb, name: p.name, division: p.division, dept: p.deptRaw,
      grade: p.grade, gradeLevel: p.gradeLevel
    })),
    truncated: rows.length > 500,
    summary: org.summary()
  });
});

// Who heads a unit — and, honestly, whether the data can say.
router.get('/head', (req, res) => {
  const { division, dept } = req.query;
  if (!division) return fail(res, 422, 'division is required');
  const r = dept ? org.headOf(division, dept) : org.headOfDivision(division);
  res.json({
    unit: r.unit,
    ambiguous: r.ambiguous,
    person: r.person,
    candidates: r.candidates,
    note: r.ambiguous
      ? `${r.candidates.length} officers share the top grade here; the personnel sheet has `
        + 'no head column, so this cannot be resolved from the data.'
      : null
  });
});

// -- the checklist -----------------------------------------------------------

// The intake form: both blocks, every row, and which rows carry an authority.
router.get('/checklist', (_req, res) => {
  res.json({
    sections: checklist.formSections(),
    injectionIndex: checklist.injectionIndex(),
    defaults: checklist.defaultAnswers(),
    materialClasses: checklist.materialClasses(),
    summary: checklist.summary()
  });
});

// Answers in, obliged authorities out. No persistence — this is what the form calls as
// the user types, so they can watch the approval chain change under their answers.
router.post('/checklist/preview', (req, res) => {
  const answers = req.body?.answers ?? checklist.defaultAnswers();
  const injected = checklist.injected(answers);
  res.json({
    injected,
    dopLevel: checklist.dopLevel(answers),
    answered: Object.values(answers).filter((v) => String(v ?? '').trim()).length,
    total: checklist.counts().rows
  });
});

router.post('/checklist/submissions', (req, res) => {
  const { caseRef, title, division, dept, answers } = req.body ?? {};
  if (!division) return fail(res, 422, 'division is required');
  if (!answers || typeof answers !== 'object') return fail(res, 422, 'answers object is required');
  res.status(201).json({
    submission: store.saveSubmission({ caseRef, title, division, dept, answers, user: req.user })
  });
});

router.get('/checklist/submissions', (_req, res) =>
  res.json({ submissions: store.listSubmissions() }));

router.get('/checklist/submissions/:id', (req, res) => {
  const s = store.getSubmission(Number(req.params.id));
  return s ? res.json({ submission: s }) : fail(res, 404, 'No such submission');
});

// -- planning (no persistence) ----------------------------------------------

// Resolve the chain without starting it: who would have to act, who each of them is, and
// every caveat about how confidently the directory named them.
router.post('/plan', (req, res) => {
  const { noteId = 'provisioning', division, dept, answers, originatorPb } = req.body ?? {};
  if (!division) return fail(res, 422, 'division is required');
  if (!org.divisions().includes(division)) return fail(res, 422, `Unknown division "${division}"`);
  const plan = chain.buildPlan({
    noteId, division, dept, answers: answers ?? null, originatorPb: originatorPb ?? null,
    originatorDept: originatorPb ? null : dept
  });
  res.json({ plan });
});

// -- live chains -------------------------------------------------------------
router.get('/chains', (_req, res) => res.json({ chains: store.listChains() }));

router.post('/chains', (req, res) => {
  const { noteId = 'provisioning', division, dept, caseRef, answers, originatorPb,
    submissionId, fileId } = req.body ?? {};
  if (!division) return fail(res, 422, 'division is required');
  if (!org.divisions().includes(division)) return fail(res, 422, `Unknown division "${division}"`);
  const shape = chain.chainShape(noteId);
  if (shape.mode === chain.COMMITTEE) {
    return fail(res, 422,
      `${shape.label} is decided by a committee, not a serial chain — use /committees`);
  }
  const created = store.createChain({
    noteId, division, dept, caseRef, answers: answers ?? null,
    originatorPb: originatorPb ?? null, submissionId, fileId, user: req.user
  });
  res.status(201).json({ chain: created });
});

router.get('/chains/:id', (req, res) => {
  const c = store.loadChain(Number(req.params.id));
  return c ? res.json({ chain: c }) : fail(res, 404, 'No such chain');
});

// Act on a chain. `slotIndex` acts as the planned position; `pb` lets somebody outside
// the plan act (a junior examining, or the originator answering a query — both happen on
// the real note). Refusals come back 422 with the reason.
router.post('/chains/:id/hops', (req, res) => {
  const { action, slotIndex, pb, comment, rider, twoFactor, when } = req.body ?? {};
  if (!action) return fail(res, 422, 'action is required');
  if (action === 'concur_with_rider' && !String(rider ?? '').trim()) {
    return fail(res, 422, 'A rider hop needs the condition it binds a later stage to');
  }
  const out = store.act(Number(req.params.id), {
    action,
    slotIndex: slotIndex ?? null,
    pb: pb ?? null,
    comment: comment ?? '',
    rider: rider ?? '',
    twoFactor: Boolean(twoFactor),
    when: when ?? null,
    user: req.user
  });
  return out.ok ? res.json({ chain: out.chain }) : fail(res, 422, out.error);
});

// -- committees --------------------------------------------------------------
router.get('/committees', (_req, res) => res.json({ committees: store.listCommittees() }));

router.post('/committees', (req, res) => {
  const { noteId, division, caseRef, specs } = req.body ?? {};
  if (!noteId || !division) return fail(res, 422, 'noteId and division are required');
  const shape = chain.chainShape(noteId);
  const list = specs?.length ? specs : (shape.committeeSpecs ?? []);
  if (!list.length) {
    return fail(res, 422,
      'This committee has no composition in sampleData — Annexure 21A prints a members '
      + 'table but never says who sits on a TEC. Name the members explicitly to proceed.');
  }
  res.status(201).json({
    committee: store.createCommittee({ noteId, division, caseRef, specs: list, user: req.user })
  });
});

router.get('/committees/:id', (req, res) => {
  const c = store.loadCommittee(Number(req.params.id));
  return c ? res.json({ committee: c }) : fail(res, 404, 'No such committee');
});

router.post('/committees/:id/members/:memberId/sign', (req, res) => {
  const { coiDeclared, remark } = req.body ?? {};
  const out = store.signMember(Number(req.params.id), Number(req.params.memberId), {
    coiDeclared: Boolean(coiDeclared), remark
  });
  return out.ok ? res.json({ committee: out.committee }) : fail(res, 404, out.error);
});

// -- bids --------------------------------------------------------------------

// The two decisions that eliminate suppliers, recomputed here from the filled compliance
// sheets rather than read from them.
router.get('/bids', (_req, res) => {
  if (!bids.available()) {
    return fail(res, 404,
      'No filled bid sheets. Generate them: conda run -n hal python '
      + 'ai/fixtures/make_bid_E33046.py && conda run -n hal python ai/export_web.py');
  }
  res.json(bids.evaluate());
});

export default router;
