// Regression check for the requisition register. Run: node server/requisitions/requisitions.check.mjs
// Throwaway DBs for requisitions, noting, contracts and AI cases (the register links across
// them), so nothing under server/data is touched.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tmp = mkdtempSync(path.join(tmpdir(), 'hal-requisitions-check-'));
for (const k of ['REQUISITIONS_DB', 'NOTING_DB', 'CONTRACTS_DB', 'AI_CASES_DB', 'APPROVALS_DB']) process.env[k] = path.join(tmp, `${k.toLowerCase()}.db`);

const { estimate, BASES } = await import('./estimate.js');

// --- estimate math ------------------------------------------------------------------------
const e = estimate({ basis: 'lpp', qty: 5, unitRate: 270180, escalationPct: 5, gstPct: 18, freight: 15000 });
assert.equal(e.basisLabel, BASES.LPP);
assert.equal(e.totals.basic, 1350900);
assert.equal(e.totals.escalation, 67545);
assert.equal(e.totals.pretax, 1418445);
assert.equal(e.totals.gst, 255320.1);
assert.equal(e.totals.total, 1688765.1);
assert.match(e.totalWords, /^Sixteen Lakh Eighty-Eight Thousand Seven Hundred Sixty-Five And Ten Paise Only$/);
assert.equal(estimate({ qty: 1, unitRate: 100 }).totals.total, 118, 'GST defaults to 18%');
assert.equal(estimate({ qty: 3, unitRate: 33.335, gstPct: 0 }).totals.basic, 100.01, 'half-up rounding per step');
for (const bad of [{ qty: 0, unitRate: 1 }, { qty: 1, unitRate: -1 }, { qty: 'x', unitRate: 1 }, { basis: 'guess', qty: 1, unitRate: 1 }])
  assert.throws(() => estimate(bad), (err) => err.status === 422, `rejects ${JSON.stringify(bad)}`);

// --- register over seeded noting + contracts ----------------------------------------------
const noting = await import('../noting/seed.js');
noting.reseed();
const contracts = await import('../contracts/seed.js');
contracts.seedIfEmpty();
const { reseed } = await import('./seed.js');
reseed();
const { get, all } = await import('./db.js');
const { createRequisition, getRequisition, listRequisitions, patchRequisition, setEstimate, ppApprovedForContract, KINDS } = await import('./register.js');
const { link, requisitionByPo, requisitionByReqNo, contractByPo } = await import('./links.js');
const { deriveStatus, STATUS_ORDER } = await import('./status.js');
const { nextReqNo } = await import('./refs.js');

const rows = listRequisitions();
assert.equal(rows.length, 10, 'ten seeded requisitions');
assert.ok(rows.every((r) => KINDS.includes(r.kind) && r.req_no && r.status && r.status_label), 'every row has a kind, no and derived status');

const nvb = requisitionByReqNo('CAR/25/229');
assert.ok(nvb, 'NVB requisition seeded');
const nvbH = getRequisition(nvb.id);
assert.ok(nvbH.noting_file_pk, 'NVB linked to its noting proposal');
assert.equal(nvbH.links.notingFile.file_id, 'AOD/IMM/2026/0001');
assert.equal(nvbH.po_no, 'IMM/PO/25-26/0533');
assert.equal(nvbH.links.po.tenderNo, 'GEM/2025/B/6638737');
assert.equal(nvbH.estimate_basic, 1350900, 'PO-backed estimate = 5 × 270180 from pos.json');
assert.equal(nvbH.estimate_total, 1594062);
assert.equal(nvbH.status, 'received', 'NVB: RV SEC/26/031 received against PO 0533, no payment advice yet');
assert.equal(requisitionByPo('IMM/PO/25-26/0533').req_no, 'CAR/25/229');
assert.ok(contractByPo('IMM/PO/25-26/0533')?.contract_no, 'contract lookup by PO');

// status ladder against the fixtures
const byNo = Object.fromEntries(rows.map((r) => [r.req_no, r]));
assert.equal(byNo['CAR/25/144'].status, 'received', 'seating: RV COM/26/148 on PO 0457, PA not yet paid');
assert.equal(byNo['CAR/25/097'].status, 'received', 'raw material: RV RAW/26/210, PA stamped by HOD');
assert.equal(byNo['CAR/25/188'].status, 'received', 'brackets: RV COM/26/151 on PO 0512');
assert.equal(byNo['MPR/26/0412'].status, 'provisioning', 'test rig: S1 provisioning approved, awaiting hand-over');
assert.equal(byNo['CAR/26/077'].status, 'rejected', 'tool kits: rejected proposal');
assert.equal(byNo['CAR/25/301'].status, 'po_placed', 'hydraulic seals: PO stage approved, no PO no in fixture');
assert.equal(byNo['CAR/26/118'].status, 'tendering', 'LED fixture: tender no recorded, no proposal file');
assert.equal(byNo['CAR/26/118'].fixture, true, 'LED case flagged fabricated');
assert.equal(byNo['SPR/26/017'].status, 'provisioning');
assert.ok(STATUS_ORDER.includes(byNo['CAR/26/104'].status));
assert.equal(listRequisitions({ kind: 'CAR' }).length, 8);
assert.equal(listRequisitions({ status: 'received' }).length, 4);
const queue = ppApprovedForContract();
assert.ok(queue.some((r) => r.req_no === 'CAR/25/301'), 'PO placed without a contract is in the Contract Generator queue');
assert.ok(!queue.some((r) => r.req_no === 'CAR/25/229'), 'a requisition with a contract is not queued');

// --- create / patch / estimate / link round trip ------------------------------------------
const actor = { name: 'Indent Cell', pb: 'PB-51002', dept: 'Indent Cell', memberId: 9 };
assert.equal(nextReqNo('CPR', new Date('2026-09-30')), 'CPR/26/001', 'first CPR of the year');
const cpr = createRequisition({ kind: 'cpr', title: 'Aeroshell synthetic oil', item_description: 'Aeroshell 500', quantity: 40, uom: 'L', tendering_type: 'Open (GeM)', estimate: { basis: 'GEM', qty: 40, unitRate: 1850, gstPct: 18 } }, actor);
assert.equal(cpr.kind, 'CPR');
assert.match(cpr.req_no, /^CPR\/\d{2}\/001$/);
assert.equal(cpr.status, 'registered');
assert.equal(cpr.estimate_total, 87320, '40 × 1850 × 1.18');
assert.equal(cpr.indentor_pb, 'PB-51002', 'indentor stamped from the actor');
assert.equal(cpr.estimate_basis_label, BASES.GEM);
const cpr2 = createRequisition({ kind: 'CPR', title: 'Second consumable' }, actor);
assert.match(cpr2.req_no, /\/002$/, 'MAX+1 numbering');
assert.throws(() => createRequisition({ kind: 'XYZ', title: 'x' }), /kind must be/);
assert.throws(() => createRequisition({ kind: 'MPR' }), /title is required/);
assert.throws(() => createRequisition({ kind: 'MPR', title: 'dup', req_no: 'CAR/25/229' }), /already registered/);

const patched = patchRequisition(cpr.id, { quantity: 50, budget_head: 'Consumables — lubricants', proprietary: true }, actor);
assert.equal(patched.quantity, 50);
assert.equal(patched.proprietary, true);
assert.equal(patched.estimate_total, 87320, 'patch without estimate inputs leaves the estimate alone');
const est = setEstimate(cpr.id, { basis: 'LPP', qty: 50, unitRate: 1800, gstPct: 18 }, actor);
assert.equal(est.estimate_total, 106200);
assert.equal(est.estimate_basis, 'LPP');
assert.throws(() => setEstimate(cpr.id, { basis: 'LPP' }), /qty and unitRate/);

const linked = link(cpr.id, { tender_no: 'GEM/2026/B/9000001', po_no: '' }, { actor: 'test' });
assert.equal(linked.tender_no, 'GEM/2026/B/9000001');
assert.equal(linked.po_no, null, 'blank pointers are ignored');
assert.equal(getRequisition(cpr.id).status, 'tendering', 'a tender no moves the status');
assert.ok(all('SELECT * FROM requisition_events WHERE requisition_id = ?', cpr.id).some((ev) => ev.kind === 'linked'), 'link writes an event');

// a requisition with a proposal file cannot be edited on the register
assert.throws(() => patchRequisition(nvb.id, { title: 'x' }), /already has a proposal file/);
assert.equal(deriveStatus(get('SELECT * FROM requisitions WHERE id = ?', cpr2.id)).status, 'registered');

console.log(`requisitions.check: ${rows.length} seeded + create/patch/estimate/link round trip, status ladder OK`);
