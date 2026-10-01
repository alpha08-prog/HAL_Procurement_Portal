// Regression check for the fixture-backed trackers. Run: node server/trackers/trackers.check.mjs
// Uses a throwaway CONTRACTS_DB so the real register is never touched.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.CONTRACTS_DB = path.join(mkdtempSync(path.join(tmpdir(), 'hal-trackers-check-')), 'contracts.db');

const { TRACKERS, runTracker, poRows, addDays } = await import('./trackers.js');
const { computeLd } = await import('../ld.js');
const { db, todayISO, daysBetween } = await import('../store.js');
const { allPos } = await import('../contracts/poSource.js');

assert.equal(addDays('2026-05-08', 120), '2026-09-05');

for (const name of Object.keys(TRACKERS)) {
  const out = runTracker(name);
  assert.ok(Array.isArray(out.rows), `${name}: rows`);
  assert.equal(out.count, out.rows.length);
  assert.match(out.source, /fixture/i, `${name}: source names the fixture`);
  assert.ok(out.title && out.hub && out.asOf === todayISO(), `${name}: meta`);
}
assert.equal(runTracker('nope'), null);

const rows = poRows();
assert.equal(rows.length, allPos().length, 'one row per PO in pos.json');
const nvb = rows.find((r) => r.poNo === 'IMM/PO/25-26/0533');
assert.ok(nvb, 'NVB PO present');
assert.equal(nvb.dueDate, addDays(nvb.poDate, 120), 'due date derived from the PO delivery period when no RV exists');
assert.equal(nvb.received, db.rvs.some((r) => r.poNo === nvb.poNo));

// A PO with an RV takes the RV's own due date (what the payment advice uses).
const withRv = rows.find((r) => r.received);
assert.ok(withRv);
assert.equal(withRv.dueDate, db.rvs.find((r) => r.poNo === withRv.poNo).deliveryDueDate);

// po-due lists only unreceived POs; dp-expired LD equals computeLd on the same inputs.
const due = runTracker('po-due');
assert.ok(due.rows.every((r) => !r.received));
const exp = runTracker('dp-expired');
for (const r of exp.rows) {
  assert.ok(r.daysLate > 0);
  const arrived = r.received ? r.gateEntryDate : todayISO();
  const ld = computeLd({ deliveryDueDate: r.dueDate, gateEntryDate: arrived, rvValue: r.rvValue ?? r.landedValue, poValue: r.landedValue }, { ldApplicable: 'Yes', ldByGateEntry: 'Yes', ldByFtr: 'No' });
  assert.equal(r.ldWeeks, ld.ldWeeks, `${r.poNo}: LD weeks`);
  assert.equal(r.ldWeeks, Math.ceil(daysBetween(r.dueDate, arrived) / 7));
}
if (!nvb.received && daysBetween(nvb.dueDate, todayISO()) > 0) {
  assert.ok(exp.rows.some((r) => r.poNo === nvb.poNo), 'an unreceived PO past its due date is DP-expired');
}

// securities: SD 5% / PBG 10% of basic for fixture POs
const sec = runTracker('securities');
const secNvb = sec.rows.find((r) => r.poNo === 'IMM/PO/25-26/0533');
assert.equal(secNvb.basicValue, 1350900);
assert.equal(secNvb.sdAmount, 67545);
assert.equal(secNvb.pbgAmount, 135090);

// balance-outstanding: paid RVs owe nothing; others owe the PA's final payment or the RV value
const bal = runTracker('balance-outstanding');
assert.equal(bal.rows.length, db.rvs.length);
for (const r of bal.rows) {
  if (r.status === 'paid') assert.equal(r.outstanding, 0);
  else assert.equal(r.outstanding, r.payable);
}

// receipts: one row per RV
assert.equal(runTracker('po-receipts').rows.length, db.rvs.length);
// erelease / gem-sync: every row explains itself
for (const r of runTracker('erelease').rows) assert.ok(r.releaseStatus);
for (const r of runTracker('gem-sync').rows) assert.ok(r.syncStatus);

console.log(`trackers.check: ${Object.keys(TRACKERS).length} trackers over ${rows.length} POs / ${db.rvs.length} RVs, LD matches ld.js. OK`);
