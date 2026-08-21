// Asserts the ported approval layer against its sources, and against the Python module
// it was ported from — the two must not drift apart.
//
// Same shape as server/noting/noting.check.mjs and server/contracts/contracts.check.mjs:
// no HTTP, no external DB, so it runs anywhere.
//
//   node server/approvals/approvals.check.mjs

import * as bids from './bids.js';
import * as chain from './chain.js';
import * as checklist from './checklist.js';
import * as org from './org.js';

let pass = 0;
const failures = [];

function check(ok, label, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${label}${detail ? `   -- ${detail}` : ''}`);
  }
  return Boolean(ok);
}

const section = (t) => console.log(`\n ${t}`);

// -- the personnel directory -------------------------------------------------
section('org.js — the personnel directory');
const s = org.summary();
check(s.people === 1354, '1354 officers loaded', `got ${s.people}`);
check(s.units === 19, '19 units', `got ${s.units}`);
check(s.deptsRaw === 55, '55 raw department spellings', `got ${s.deptsRaw}`);
check(s.deptsCanonical === 47, '47 departments after normalising', `got ${s.deptsCanonical}`);
// The sheet has 23 grade labels but one, "9 -  General Manager", carries a double space
// and normalises onto its twin — so 22 distinct grades is correct here.
check(s.gradeLabels === 22, '22 distinct grades after whitespace normalisation', `got ${s.gradeLabels}`);
check(s.unitDeptPairs === 272, '272 division-department pairs', `got ${s.unitDeptPairs}`);
check(s.ambiguousHeads === 88, '88 units have no identifiable head', `got ${s.ambiguousHeads}`);

check(org.gradeLevel('9 -  General Manager') === 9, 'a double space in a grade label is harmless');
check(org.gradeLevel('1 - Assistant Finance Office') === 1, 'the sheet’s missing "r" is harmless');
check(org.gradeLevel('CEO') === 11 && org.gradeLevel('SCH A') === 13,
  'CEO / SCH A / SCH B rank above Executive Director');

check(org.desigLevel('GM(AOD)') === 9, 'GM(AOD) reads as grade 9');
check(org.desigLevel('AGM(IMM-OH)') === 8, 'AGM reads as grade 8');
check(org.desigLevel('DY. GENERAL MANAGER (HR)') === 7,
  'DY. GENERAL MANAGER is 7, not 9 — GM is a substring of DGM');
check(org.desigLevel('ADDL GENERAL MANAGER(PROJ & PLG)') === 8, 'ADDL GENERAL MANAGER is 8, not 9');

for (const [a, b] of [['Mat PLg', 'Mat Plg'], ['SHOP', 'Shop'], ['FIN', 'Finance'],
  ['MANUFACTURING SHHOP', 'Manufacturing Shop'], ['MARKETING', 'Marketing'],
  ['TRANSPORT', 'Transport'], ['Project PLg', 'PROJECT PLANNING']]) {
  check(org.normDept(a) === org.normDept(b), `"${a}" and "${b}" are one unit`);
}

check(org.matchDept('IMM-OH', 'DIV1') === 'IMM', '"IMM-OH" narrows to IMM');
check(org.matchDept('SEC & FIRE', 'DIV1') === 'FIRE & SEC', '"SEC & FIRE" matches FIRE & SEC');
check(org.matchDept('AOD', 'DIV1') === '', '"AOD" is a division, not a department — no false match');

const h1 = org.headOf('DIV1', 'IMM');
check(h1.ambiguous && !h1.person && h1.candidates.length === 3,
  'headOf reports a tie instead of guessing');
const picked = org.pick(h1);
check(picked.person && picked.chose, 'pick breaks a tie but reports that it did');
const gm = org.resolveAuthority('GM(AOD)', 'DIV1');
check(Boolean(gm.person) && gm.person.gradeLevel === 9, 'GM(AOD) resolves to the single grade-9');

// -- the checklist -----------------------------------------------------------
section('checklist.js — the indentor checklist');
const c = checklist.counts();
check(c.rows === 67, '67 rows', `got ${c.rows}`);
check(c.provisioning === 25 && c.tender === 42, '25 provisioning + 42 tender rows');
check(c.technical === 42, '42 rows marked technical', `got ${c.technical}`);
check(c.commercial === 21, '21 rows marked commercial', `got ${c.commercial}`);
check(c.feeds_tec_report === 15, '15 rows feed the TEC Report', `got ${c.feeds_tec_report}`);
check(c.feeds_comm_eval === 27, '27 rows feed the Commercial Evaluation', `got ${c.feeds_comm_eval}`);
check(checklist.materialClasses().length === 13, '13 material classes');
check(checklist.dopLevel() === 'Level I', 'DOP level reads as Level I from provisioning sl 11');
check(checklist.injections().length === 10, '10 rows name an approving authority');

const fired = new Set(checklist.injected().map((i) => i.sl));
check(['10', '11', '12', '21'].every((x) => fired.has(x)) && fired.size === 4,
  'the sheet’s own answers oblige exactly sl 10, 11, 12 and 21',
  `got ${[...fired].sort().join(', ')}`);
check(!fired.has('13'),
  'sl 13 answered YES obliges nobody — the inverted trigger works');

const flipped = { ...checklist.defaultAnswers(), 'provisioning:22': 'YES', 'provisioning:13': 'NO' };
const fired2 = new Set(checklist.injected(flipped).map((i) => i.sl));
check(fired2.has('22'), 'answering YES to short tendering adds the Head of Division');
check(fired2.has('13'), 'answering NO to the six-month rule adds the Head of Division');
const ministry = checklist.injected({ ...checklist.defaultAnswers(), 'provisioning:19': 'YES' })
  .find((i) => i.kind === 'ministry');
check(ministry?.external === true, 'the Ministry is flagged external — no directory entry satisfies it');

// Each injection must still have the sheet's own words behind it.
for (const spec of checklist.injections()) {
  const row = checklist.find(spec.block, spec.sl);
  const text = `${row?.clause ?? ''} | ${row?.description ?? ''} | ${row?.remark ?? ''}`.toUpperCase();
  check(text.includes(String(spec.evidence).toUpperCase()),
    `sl ${spec.sl}: the sheet still says "${spec.evidence}"`);
}

// -- the chain ---------------------------------------------------------------
section('chain.js — the approval chain');
for (const hop of ['forward', 'concur', 'concur_with_rider', 'examine', 'query',
  'return_to', 'approve', 'reject']) {
  check(hop in chain.HOPS, `hop type "${hop}" is defined`);
}
check(chain.HOPS.examine.advances === false, '"examine" does not advance — it comes back');
check(chain.HOPS.query.advances === false, '"query" does not advance — it keeps its place');
check(chain.HOPS.approve.by === 'cfa', 'only the CFA may approve');
check(chain.CONCUR_DEFAULT === 'Concurred and Forwarded / सहमत एवं भेजा गया',
  'the default remark matches the real note verbatim, Hindi half included');
check(chain.cleanComment('') === chain.CONCUR_DEFAULT, 'an empty remark becomes the standard line');
check(chain.cleanComment(' . * , ') === chain.CONCUR_DEFAULT, 'a symbols-only remark does too');
check(chain.cleanComment('Pl examine') === 'Pl examine', 'a real remark is left alone');
check(chain.COI_DECLARATION.includes('no conflict of interest'),
  'the Annexure 21A Para C declaration is carried verbatim');

const plan = chain.buildPlan({ noteId: 'provisioning', division: 'DIV9', originatorDept: 'FIRE & SEC' });
check(plan.slots.length === 14, 'the provisioning chain resolves 14 positions', `got ${plan.slots.length}`);
check(plan.unresolved === 0, 'every position resolves in DIV9', `${plan.unresolved} unresolved`);
check(plan.dopLevel === 'Level I' && plan.dopLevelComputed === false,
  'the DOP level is taken from the checklist and never computed from an amount');
check(plan.slots.some((x) => x.kind === 'cfa'), 'the chain has a CFA position');
check(plan.slots.filter((x) => x.kind === 'concurrence').length === 5,
  'five cross-department concurrences, as F1 recorded');
check(plan.slots.some((x) => x.caveats.length > 0),
  'positions the directory could not settle cleanly are flagged');

// A CFA approval alone must not release the file.
const bare = chain.newChain(plan, 'CHK');
const cfaIdx = plan.slots.findIndex((x) => x.kind === 'cfa');
chain.addHop(bare, { person: plan.slots[cfaIdx].person, action: 'approve', slotIndex: cfaIdx });
const bareGate = chain.releaseReady(bare);
check(!bareGate.ok && bareGate.why.length > 0,
  'a CFA approval with concurrences outstanding does NOT release the file');

// Walk it properly and the gate opens.
const plan2 = chain.buildPlan({ noteId: 'provisioning', division: 'DIV9', originatorDept: 'FIRE & SEC' });
const full = chain.newChain(plan2, 'CHK2');
plan2.slots.forEach((x, i) => {
  if (!x.person || x.kind === 'originator' || x.kind === 'cfa') return;
  chain.addHop(full, { person: x.person, action: 'concur', slotIndex: i });
});
const cfa2 = plan2.slots.findIndex((x) => x.kind === 'cfa');
chain.addHop(full, { person: plan2.slots[cfa2].person, action: 'approve', slotIndex: cfa2 });
const fullGate = chain.releaseReady(full);
check(fullGate.ok, 'with every required position actioned and the CFA approved, it releases',
  fullGate.why.join(' | '));
check(chain.gradePath(full).length === full.hops.length, 'every hop carries a grade');
const ids = new Set(full.hops.map((x) => x.txnId));
check(ids.size === full.hops.length, 'every hop gets its own transaction id');
check(full.hops[0].txnId.endsWith('-0001'), 'the per-hop id counter starts at 0001');

// Committee mode.
const com = chain.buildCommittee('pnc_req', chain.chainShape('pnc_req').committeeSpecs, 'DIV9');
check(com.members.length === 4, 'the PNC committee has the four members F5 names');
check(chain.committeeComplete(com).ok === false, 'an unsigned committee cannot report');
com.members.forEach((m) => { m.signed = true; m.coiDeclared = false; });
check(chain.committeeComplete(com).why.some((w) => w.includes('conflict-of-interest')),
  'signing without declaring still blocks the report');
com.members.forEach((m) => { m.coiDeclared = true; });
check(chain.committeeComplete(com).ok, 'signed and declared — the report can be raised');
check(chain.chainShape('tec_report').committeeSpecs.length === 0,
  'the TEC composition is left empty — it is not in sampleData, so it is not invented');

// -- bid evaluation ----------------------------------------------------------
section('bids.js — the EMD and TEC decisions');
if (!bids.available()) {
  check(false, 'bids.json is present',
    'run: conda run -n hal python ai/fixtures/make_bid_E33046.py && ai/export_web.py');
} else {
  const e = bids.evaluate();
  check(e.fixture === true, 'the bid data is flagged as a fixture');
  check(e.summary.total === 6, '6 bids', `got ${e.summary.total}`);
  check(e.summary.emdRejected === 2, '2 bidders out at EMD', `got ${e.summary.emdRejected}`);
  check(e.summary.tecRejected === 2, '2 bidders out at TEC', `got ${e.summary.tecRejected}`);
  check(e.summary.accepted === 2, '2 technically accepted', `got ${e.summary.accepted}`);

  const dv5 = e.rows.find((r) => r.id === 'DV5');
  check(dv5.emd === 'Not Accepted' && !dv5.manufacturer,
    'a trading house claiming an MSE waiver is refused — it does not manufacture');
  const dv2 = e.rows.find((r) => r.id === 'DV2');
  check(dv2.emd === 'Accepted' && dv2.specFailed.join(',') === '2,7',
    'DV2 clears EMD but fails specification sl 2 and 7');
  check(e.price.variancePct === 17.86, 'L1 is +17.86% over the estimate', `got ${e.price.variancePct}`);
  check(e.price.pncAdvised === true, 'no RA participation means negotiation is advised');
  check(e.price.savingPct === 11.11, 'the negotiated saving is 11.11%', `got ${e.price.savingPct}`);
  check(e.price.sd === 473000 && e.price.pbg === 946000, 'SD 5% and PBG 10% computed from basic');
}

// -- summary -----------------------------------------------------------------
const total = pass + failures.length;
console.log(`\n${'='.repeat(66)}`);
console.log(` ${pass}/${total} checks passed`);
console.log('='.repeat(66));
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
