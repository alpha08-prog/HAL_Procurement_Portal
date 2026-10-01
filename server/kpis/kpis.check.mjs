// Regression check for the computed KPIs. Run: node server/kpis/kpis.check.mjs
// Throwaway DBs seeded like the server does, so the numbers are derived from the same fixtures.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tmp = mkdtempSync(path.join(tmpdir(), 'hal-kpis-check-'));
for (const k of ['REQUISITIONS_DB', 'NOTING_DB', 'CONTRACTS_DB', 'AI_CASES_DB', 'APPROVALS_DB']) process.env[k] = path.join(tmp, `${k.toLowerCase()}.db`);

(await import('../noting/seed.js')).reseed();
(await import('../contracts/seed.js')).seedIfEmpty();
(await import('../requisitions/seed.js')).reseed();
const { computeAll, lastMonths, monthKey, METRICS } = await import('./metrics.js');
const { paymentDeskKpis } = await import('./paymentDesk.js');
const { db, daysBetween } = await import('../store.js');
const { listRequisitions } = await import('../requisitions/register.js');
const { allPos } = await import('../contracts/poSource.js');
const { computeItems } = await import('../contracts/money.js');

const today = '2026-09-30';
assert.deepEqual(lastMonths(3, today), ['2026-07', '2026-08', '2026-09']);
const out = computeAll({ months: 6, today });
assert.equal(out.metrics.length, 16, 'sixteen KPIs');
assert.equal(METRICS.map((m) => m.code).join(','), out.metrics.map((m) => m.code).join(','));
for (const m of out.metrics) {
  assert.ok(/^KPI-\d{2}$/.test(m.code) && m.title && m.unit, `${m.code} meta`);
  assert.ok(m.value === null || typeof m.value === 'number', `${m.code} value is numeric or null`);
  assert.equal(m.series.length, 6, `${m.code} has one point per month`);
  assert.ok(m.source, `${m.code} names its source`);
  if (m.value == null) assert.ok(m.note, `${m.code} says why it has no value`);
}
const by = Object.fromEntries(out.metrics.map((m) => [m.code, m]));

// KPI-02 counts requisitions dated in the window
const keys = lastMonths(6, today);
const expected02 = listRequisitions().filter((r) => keys.includes(monthKey(r.req_date))).length;
assert.equal(by['KPI-02'].value, expected02);
assert.equal(by['KPI-02'].series.reduce((s, p) => s + p.value, 0), expected02, 'series sums to the value');

// KPI-06 = landed value of POs placed in the window (only the NVB PO, May 2026)
const posInWindow = allPos().filter((p) => keys.includes(monthKey(p.poDate)));
assert.equal(by['KPI-06'].value, posInWindow.reduce((s, p) => s + computeItems(p.items).totals.landedValue, 0));
assert.equal(by['KPI-06'].detail.count, posInWindow.length);

// KPI-13 MSE share of PO value, value-weighted over all POs, from vendors.json flags
const vendors = Object.fromEntries(db.vendors.map((v) => [v.id, v]));
const total = allPos().reduce((s, p) => s + computeItems(p.items).totals.landedValue, 0);
const mseVal = allPos().filter((p) => vendors[p.vendorId].mseCategory === 'MSE').reduce((s, p) => s + computeItems(p.items).totals.landedValue, 0);
assert.equal(by['KPI-13'].value, Math.round((mseVal / total) * 1000) / 10);
assert.equal(by['KPI-13'].target, 25);
assert.ok(by['KPI-11'].value >= 0 && by['KPI-12'].value >= 0, 'SC/ST and women shares come from vendors.json flags');
assert.ok(by['KPI-11'].detail.vendors.length >= 1, 'a SC/ST vendor exists in the fixture');

// KPI-15 = mean RV → CPPC dispatch days over PAs that reached CPPC
const cyc = db.paymentAdvices.map((pa) => {
  const rv = db.rvs.find((r) => r.rvNo === pa.rvNo);
  const sent = pa.history?.find((h) => h.to === 'sent_to_cppc')?.date;
  return rv && sent ? daysBetween(rv.rvDate, sent) : null;
}).filter((d) => d != null);
assert.equal(by['KPI-15'].value, Math.round((cyc.reduce((s, d) => s + d, 0) / cyc.length) * 10) / 10);
assert.equal(by['KPI-15'].detail.count, cyc.length);
assert.equal(by['KPI-15'].target, 30);

// KPI-16 lead time only over converted requisitions
assert.ok(by['KPI-16'].value > 0 && by['KPI-16'].detail.count >= 4, 'four PO-backed requisitions give a lead time');
// KPI-08 outstanding at end of this month excludes received POs
const openNow = allPos().filter((p) => !db.rvs.some((r) => r.poNo === p.poNo)).length;
assert.equal(by['KPI-08'].value, openNow);

// payment desk analytics
const pd = paymentDeskKpis({ months: 12, today });
assert.equal(pd.pipeline.length, 8);
assert.ok(pd.stageTimeline.every((s) => s.days === null || typeof s.days === 'number'));
assert.equal(pd.monthlyTrend.length, 12);
assert.equal(pd.summary.msmeSlaTargetDays, 45);
assert.ok(pd.slaDistribution.reduce((s, b) => s + b.count, 0) === pd.clearedCount, 'SLA buckets partition the cleared bills');
assert.ok(pd.officerPerformance.length >= 1 && pd.vendorBreakdown.length >= 1);
const pdShort = paymentDeskKpis({ months: 1, today });
assert.ok(pdShort.summary.totalAdvices <= pd.summary.totalAdvices, 'a narrower window never has more advices');

console.log(`kpis.check: 16 metrics over ${out.window[0]}–${out.window[5]}, payment desk analytics OK`);
