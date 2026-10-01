// Payment-desk analytics (/api/payment-advices/kpis) computed from the in-memory payment
// advices, their history dates, the RVs and the vendor master — nothing is a constant series.
// Cycle times follow the payment register (RV date → dispatch to CPPC). The two SLA numbers are
// documented policy inputs, not measurements: MSMED Act 45 days, HAL internal 7 days.
import { db as storeDb, rvByNo, vendorById, todayISO, daysBetween, daysSince } from '../store.js';
import { lastMonths, monthKey, monthLabel } from './metrics.js';

const TERMINAL = new Set(['sent_to_cppc', 'paid']);
const MSMED_SLA_DAYS = 45;
const HAL_SLA_DAYS = 7;
const lakhs = (v) => Math.round((v / 1e5) * 10) / 10;
const mean = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
const sum = (xs, f) => xs.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const reached = (pa, state) => pa.history?.find((h) => h.to === state)?.date ?? null;
const between = (a, b) => (a && b ? daysBetween(a, b) : null);

const STAGES = [
  ['Gate entry → RV', (x) => between(x.rv.gateEntryDate, x.rv.rvDate)],
  ['RV → PA created (maker)', (x) => between(x.rv.rvDate, x.createdDate)],
  ['PA created → officer', (x) => between(x.createdDate, reached(x, 'forwarded_to_officer'))],
  ['Officer → payment desk', (x) => between(reached(x, 'forwarded_to_officer'), reached(x, 'at_payment_desk'))],
  ['Payment desk → HOD', (x) => between(reached(x, 'at_payment_desk'), reached(x, 'sent_to_hod'))],
  ['HOD stamped → CPPC', (x) => between(reached(x, 'stamped_by_hod'), reached(x, 'sent_to_cppc'))],
  ['CPPC → paid', (x) => between(reached(x, 'sent_to_cppc'), reached(x, 'paid'))]
];

export function paymentDeskKpis({ months = 6, today = todayISO() } = {}) {
  const n = Math.min(24, Math.max(1, Number(months) || 6));
  const keys = lastMonths(n, today);
  const all = storeDb.paymentAdvices.map((pa) => {
    const rv = rvByNo(pa.rvNo) ?? {};
    const sentDate = reached(pa, 'sent_to_cppc');
    return { ...pa, rv, vendor: vendorById(pa.vendorId), sentDate, rvToPaymentDays: between(rv.rvDate, sentDate), geToPaymentDays: between(rv.gateEntryDate, sentDate) };
  });
  const win = all.filter((p) => keys.includes(monthKey(p.createdDate)));
  const cleared = win.filter((p) => TERMINAL.has(p.status));
  const inFlight = win.filter((p) => !TERMINAL.has(p.status));
  const withCycle = win.filter((p) => p.rvToPaymentDays != null);
  const mse = win.filter((p) => p.vendor.mseCategory === 'MSE');
  const mseCleared = mse.filter((p) => p.rvToPaymentDays != null);

  const summary = {
    totalAdvices: win.length,
    totalRvValue: sum(win, (p) => p.rvValue),
    totalFinalPayment: sum(win, (p) => p.finalPayment),
    totalLdAmount: sum(win, (p) => p.ldAmount),
    totalPaidCount: cleared.length,
    totalPaidValue: sum(cleared, (p) => p.finalPayment),
    totalInFlightCount: inFlight.length,
    totalInFlightValue: sum(inFlight, (p) => p.finalPayment),
    avgRvToPaymentDays: mean(withCycle.map((p) => p.rvToPaymentDays)),
    avgGateToPaymentDays: mean(win.filter((p) => p.geToPaymentDays != null).map((p) => p.geToPaymentDays)),
    mseSharePct: win.length ? Math.round((mse.length / win.length) * 100) : null,
    mseWithin45Pct: mseCleared.length ? Math.round((mseCleared.filter((p) => p.rvToPaymentDays <= MSMED_SLA_DAYS).length / mseCleared.length) * 100) : null,
    mseWithin45Count: mseCleared.length,
    withinHalSlaPct: withCycle.length ? Math.round((withCycle.filter((p) => p.rvToPaymentDays <= HAL_SLA_DAYS).length / withCycle.length) * 100) : null,
    ldPct: win.length ? Math.round((win.filter((p) => Number(p.ldAmount) > 0).length / win.length) * 100) : null,
    msmeSlaTargetDays: MSMED_SLA_DAYS,
    halInternalSlaDays: HAL_SLA_DAYS
  };

  const stageTimeline = STAGES.map(([stage, fn]) => {
    const xs = all.map(fn).filter((d) => d != null && d >= 0);
    return { stage, days: mean(xs), n: xs.length };
  });

  const STATE_META = [
    ['rv_pending', 'RV pending (stores)', '#64748b'], ['pa_created', 'Draft PA (maker)', '#3b82f6'], ['forwarded_to_officer', 'Officer review', '#0ea5e9'],
    ['at_payment_desk', 'Desk verification', '#f59e0b'], ['sent_to_hod', 'HOD IMM approval', '#8b5cf6'], ['stamped_by_hod', 'HOD stamped', '#10b981'],
    ['sent_to_cppc', 'CPPC dispatched', '#059669'], ['paid', 'Paid', '#15803d']
  ];
  const pipeline = STATE_META.map(([id, label, color]) => ({
    id, label, color,
    count: id === 'rv_pending' ? storeDb.rvs.filter((r) => r.paStatus === 'rv_pending').length : all.filter((p) => p.status === id).length
  }));

  const monthlyTrend = keys.map((k) => {
    const received = all.filter((p) => monthKey(p.createdDate) === k);
    const clearedM = all.filter((p) => monthKey(p.sentDate) === k);
    return {
      month: monthLabel(k),
      billsReceived: received.length,
      billsCleared: clearedM.length,
      valueClaimedLakhs: lakhs(sum(received, (p) => p.rvValue)),
      valueClearedLakhs: lakhs(sum(clearedM, (p) => p.finalPayment)),
      ldDeductedLakhs: lakhs(sum(clearedM, (p) => p.ldAmount)),
      avgDays: mean(clearedM.filter((p) => p.rvToPaymentDays != null).map((p) => p.rvToPaymentDays))
    };
  });

  const cats = new Map();
  for (const p of all) {
    const v = p.vendor;
    const label = v.mseCategory === 'MSE' ? `MSE${v.mseWomen && v.mseWomen !== 'NA' ? ' — women-owned' : ''}${v.mseScSt && v.mseScSt !== 'NA' ? ' — SC/ST' : ''}` : 'Non-MSE';
    if (!cats.has(label)) cats.set(label, []);
    cats.get(label).push(p);
  }
  const vendorBreakdown = [...cats.entries()].map(([category, ps]) => {
    const done = ps.filter((p) => p.rvToPaymentDays != null);
    return {
      category, count: ps.length, valueLakhs: lakhs(sum(ps, (p) => p.finalPayment)),
      onTimePct: done.length ? Math.round((done.filter((p) => p.rvToPaymentDays <= HAL_SLA_DAYS).length / done.length) * 100) : null,
      avgDays: mean(done.map((p) => p.rvToPaymentDays))
    };
  });

  const byOfficer = new Map();
  for (const p of all) {
    const key = p.officer || '—';
    if (!byOfficer.has(key)) byOfficer.set(key, []);
    byOfficer.get(key).push(p);
  }
  const officerPerformance = [...byOfficer.entries()].map(([officer, ps]) => {
    const done = ps.filter((p) => TERMINAL.has(p.status));
    const cyc = ps.filter((p) => p.rvToPaymentDays != null);
    const avgDays = mean(cyc.map((p) => p.rvToPaymentDays));
    return {
      officer, active: ps.length - done.length, cleared: done.length,
      totalValueLakhs: lakhs(sum(done, (p) => p.finalPayment)), avgDays,
      rating: avgDays == null ? 'No cleared bills yet' : avgDays <= HAL_SLA_DAYS ? 'Within HAL SLA' : avgDays <= MSMED_SLA_DAYS ? 'Within MSMED 45 days' : 'Over 45 days',
      oldestPendingDays: ps.filter((p) => !TERMINAL.has(p.status)).reduce((m, p) => Math.max(m, daysSince(p.createdDate)), 0) || null
    };
  });

  const buckets = [
    ['< 3 days', (d) => d < 3, '#15803d'], ['3 – 7 days (HAL SLA)', (d) => d >= 3 && d <= 7, '#0b3d6b'],
    ['8 – 15 days', (d) => d > 7 && d <= 15, '#b85d19'], ['> 15 days', (d) => d > 15, '#b3261e']
  ];
  const cyc = all.filter((p) => p.rvToPaymentDays != null);
  const slaDistribution = buckets.map(([range, test, color]) => {
    const count = cyc.filter((p) => test(p.rvToPaymentDays)).length;
    return { range, count, pct: cyc.length ? Math.round((count / cyc.length) * 100) : 0, color };
  });

  return {
    asOf: today, months: n, window: keys.map(monthLabel), summary, stageTimeline, pipeline, monthlyTrend, vendorBreakdown, officerPerformance, slaDistribution,
    clearedCount: cyc.length,
    source: 'server/mock/paymentAdvices.json + rvs.json + vendors.json (in-memory; history dates), summary over advices created in the window, timelines over all advices'
  };
}
