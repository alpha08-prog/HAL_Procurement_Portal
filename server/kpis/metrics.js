// The 16 Portal Hub KPIs, computed from the stores the portal actually has: the requisition
// register, the noting stage files, the PO/RV/PA fixtures, the vendor master and the contract
// register. Nothing here is typed in. Every metric returns { value, unit, series[], source,
// note, target } — value is null (with a note) when the prototype has no data for it.
//
// Definitions (say so to HAL — Portal Hub descriptions were the only spec):
//   window        the last `months` calendar months, ending this month
//   "PO placed"   a PO in server/mock/pos.json (its poDate)
//   "PO closed"   the PO's goods received — the receipt voucher date in rvs.json
//   "converted"   a requisition whose PO is placed (po_no on the register → pos.json poDate)
//   "tender floated" a tender in pos.json (tenderDate); "tender opened" the first post-
//                 provisioning stage file on a noting proposal (EMD / TEC request / PBO)
//   shares 11–14  value-weighted over ALL POs on file, using vendors.json flags
//   KPI-15        RV date → dispatch to CPPC, as the payment register computes it
//   KPI-16        requisition date → PO date for converted requisitions
import { listRequisitions } from '../requisitions/register.js';
import { all as notingAll } from '../noting/db.js';
import { all as contractsAll } from '../contracts/db.js';
import { allPos, allTenders } from '../contracts/poSource.js';
import { computeItems } from '../contracts/money.js';
import { db as storeDb, rvByNo, vendorById, todayISO, daysBetween } from '../store.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthKey = (iso) => (iso ? String(iso).slice(0, 7) : null);
export const monthLabel = (key) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
export function lastMonths(n, today = todayISO()) {
  const [y, m] = today.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}
const monthEnd = (key) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
};
const monthStart = (key) => `${key}-01`;
const mean = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);
const safe = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

function safeAll(fn) {
  return safe(fn, []);
}

export function buildContext(today = todayISO()) {
  const requisitions = safeAll(() => listRequisitions());
  const notes = safeAll(() => notingAll('SELECT n.id, n.file_pk, n.stage_id, n.status, n.created_at, n.closed_at, f.car_no FROM notes n JOIN files f ON f.id = n.file_pk'));
  const contracts = safeAll(() => contractsAll('SELECT id, po_no, status, created_at, finalised_at, released_at, landed_value, requisition_id FROM contracts'));
  const pos = allPos().map((p) => {
    const { totals } = computeItems(p.items);
    const rv = storeDb.rvs.find((r) => r.poNo === p.poNo) ?? null;
    const vendor = vendorById(p.vendorId);
    return {
      ...p,
      basicValue: totals.basicValue,
      landedValue: totals.landedValue,
      vendor,
      receivedDate: rv?.rvDate ?? null,
      isGem: /^GEM\//i.test(p.tenderNo)
    };
  });
  const pas = storeDb.paymentAdvices.map((pa) => {
    const rv = rvByNo(pa.rvNo) ?? {};
    const sentDate = pa.history?.find((h) => h.to === 'sent_to_cppc')?.date ?? null;
    const paidDate = pa.history?.find((h) => h.to === 'paid')?.date ?? null;
    return { ...pa, rv, vendor: vendorById(pa.vendorId), sentDate, paidDate, rvToPaymentDays: rv.rvDate && sentDate ? daysBetween(rv.rvDate, sentDate) : null };
  });
  const reqPoDate = (r) => (r.po_no ? (pos.find((p) => p.poNo === r.po_no)?.poDate ?? null) : null);
  return { today, requisitions, notes, contracts, pos, pas, rvs: storeDb.rvs, tenders: allTenders(), vendors: storeDb.vendors, reqPoDate };
}

const inMonth = (iso, key) => monthKey(iso) === key;
const shareMetric = (ctx, flag, label) => {
  const total = ctx.pos.reduce((s, p) => s + p.landedValue, 0);
  const hit = ctx.pos.filter((p) => flag(p));
  const hitValue = hit.reduce((s, p) => s + p.landedValue, 0);
  return {
    value: pct(hitValue, total),
    unit: 'pct',
    detail: { poCount: hit.length, totalPoCount: ctx.pos.length, poValue: hitValue, totalPoValue: total, vendors: [...new Set(hit.map((p) => p.vendor.name))] },
    series: (keys) => keys.map((k) => {
      const inM = ctx.pos.filter((p) => inMonth(p.poDate, k));
      const v = inM.reduce((s, p) => s + p.landedValue, 0);
      return { month: monthLabel(k), value: pct(inM.filter(flag).reduce((s, p) => s + p.landedValue, 0), v), count: inM.filter(flag).length };
    }),
    source: `vendors.json ${label} flag × PO values in pos.json (value-weighted, all POs on file)`
  };
};

export const METRICS = [
  {
    code: 'KPI-01', id: 'mis_report', title: 'MIS report', unit: 'months',
    compute: (ctx, keys) => ({
      value: keys.length,
      series: keys.map((k) => ({
        month: monthLabel(k),
        requisitions: ctx.requisitions.filter((r) => inMonth(r.req_date, k)).length,
        posPlaced: ctx.pos.filter((p) => inMonth(p.poDate, k)).length,
        posValue: ctx.pos.filter((p) => inMonth(p.poDate, k)).reduce((s, p) => s + p.landedValue, 0),
        billsCleared: ctx.pas.filter((p) => inMonth(p.sentDate, k)).length,
        paid: ctx.pas.filter((p) => inMonth(p.sentDate, k)).reduce((s, p) => s + (p.finalPayment ?? 0), 0)
      })),
      source: 'One row per month from the metrics below; print the dashboard for the report',
      note: 'The MIS report is this dashboard: requisitions, POs, tenders and payments per month, printed with the browser.'
    })
  },
  {
    code: 'KPI-02', id: 'mpr_received', title: 'Requisitions received per month', unit: 'count',
    compute: (ctx, keys) => ({
      value: ctx.requisitions.filter((r) => keys.includes(monthKey(r.req_date))).length,
      series: keys.map((k) => ({ month: monthLabel(k), value: ctx.requisitions.filter((r) => inMonth(r.req_date, k)).length })),
      source: 'requisitions.db req_date (MPR/CAR/CPR/SPR)'
    })
  },
  {
    code: 'KPI-03', id: 'mpr_converted', title: 'Requisitions converted to PO', unit: 'count',
    compute: (ctx, keys) => {
      const conv = ctx.requisitions.map((r) => ({ r, poDate: ctx.reqPoDate(r) })).filter((x) => x.poDate);
      return {
        value: conv.filter((x) => keys.includes(monthKey(x.poDate))).length,
        series: keys.map((k) => ({ month: monthLabel(k), value: conv.filter((x) => inMonth(x.poDate, k)).length })),
        source: 'requisitions.db po_no → pos.json poDate',
        note: `${conv.length} of ${ctx.requisitions.length} requisitions on file have a PO`
      };
    }
  },
  {
    code: 'KPI-04', id: 'mpr_outstanding', title: 'Requisitions outstanding at month end', unit: 'count',
    compute: (ctx, keys) => {
      const open = (k) => ctx.requisitions.filter((r) => {
        if (r.req_date > monthEnd(k)) return false;
        if (['rejected', 'short_closed'].includes(r.status) && r.status_evidence) return false;
        const pd = ctx.reqPoDate(r);
        return !pd || pd > monthEnd(k);
      });
      return {
        value: open(keys[keys.length - 1]).length,
        series: keys.map((k) => ({ month: monthLabel(k), value: open(k).length })),
        source: 'requisitions.db req_date vs pos.json poDate; rejected / short-closed proposals excluded'
      };
    }
  },
  {
    code: 'KPI-05', id: 'po_outstanding_start', title: 'POs outstanding at start of month', unit: 'count',
    compute: (ctx, keys) => {
      const open = (k) => ctx.pos.filter((p) => p.poDate < monthStart(k) && (!p.receivedDate || p.receivedDate >= monthStart(k)));
      return {
        value: open(keys[keys.length - 1]).length,
        series: keys.map((k) => ({ month: monthLabel(k), value: open(k).length, poValue: open(k).reduce((s, p) => s + p.landedValue, 0) })),
        source: 'pos.json poDate vs rvs.json rvDate (a PO closes when its goods are received)'
      };
    }
  },
  {
    code: 'KPI-06', id: 'po_placed', title: 'POs placed in month and their value', unit: 'inr',
    compute: (ctx, keys) => {
      const inW = ctx.pos.filter((p) => keys.includes(monthKey(p.poDate)));
      return {
        value: inW.reduce((s, p) => s + p.landedValue, 0),
        detail: { count: inW.length },
        series: keys.map((k) => {
          const m = ctx.pos.filter((p) => inMonth(p.poDate, k));
          return { month: monthLabel(k), value: m.reduce((s, p) => s + p.landedValue, 0), count: m.length };
        }),
        source: 'pos.json poDate and computed landed value (money.js)'
      };
    }
  },
  {
    code: 'KPI-07', id: 'po_closed', title: 'POs closed in month and their value', unit: 'inr',
    compute: (ctx, keys) => {
      const inW = ctx.pos.filter((p) => p.receivedDate && keys.includes(monthKey(p.receivedDate)));
      return {
        value: inW.reduce((s, p) => s + p.landedValue, 0),
        detail: { count: inW.length },
        series: keys.map((k) => {
          const m = ctx.pos.filter((p) => inMonth(p.receivedDate, k));
          return { month: monthLabel(k), value: m.reduce((s, p) => s + p.landedValue, 0), count: m.length };
        }),
        source: 'rvs.json rvDate for POs in pos.json'
      };
    }
  },
  {
    code: 'KPI-08', id: 'po_outstanding_end', title: 'POs outstanding at end of month', unit: 'count',
    compute: (ctx, keys) => {
      const open = (k) => ctx.pos.filter((p) => p.poDate <= monthEnd(k) && (!p.receivedDate || p.receivedDate > monthEnd(k)));
      return {
        value: open(keys[keys.length - 1]).length,
        series: keys.map((k) => ({ month: monthLabel(k), value: open(k).length, poValue: open(k).reduce((s, p) => s + p.landedValue, 0) })),
        source: 'pos.json poDate vs rvs.json rvDate'
      };
    }
  },
  {
    code: 'KPI-09', id: 'tenders_floated', title: 'Tenders floated in month', unit: 'count',
    compute: (ctx, keys) => ({
      value: ctx.tenders.filter((t) => keys.includes(monthKey(t.tenderDate))).length,
      series: keys.map((k) => ({ month: monthLabel(k), value: ctx.tenders.filter((t) => inMonth(t.tenderDate, k)).length })),
      source: 'pos.json tenderDate (GeM and IFS enquiries)',
      note: 'Tender publication is not a portal action in the prototype; the dates are the fixture’s.'
    })
  },
  {
    code: 'KPI-10', id: 'tenders_opened', title: 'Tenders opened in month', unit: 'count',
    compute: (ctx, keys) => {
      const opened = ctx.notes.filter((n) => ['emd', 'tec_req', 'pbo'].includes(n.stage_id));
      const firstPerFile = [...new Map(opened.sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).map((n) => [n.file_pk, n])).values()];
      return {
        value: firstPerFile.filter((n) => keys.includes(monthKey(n.created_at))).length,
        series: keys.map((k) => ({ month: monthLabel(k), value: firstPerFile.filter((n) => inMonth(n.created_at, k)).length })),
        source: 'noting.db — first EMD / TEC request / price-bid stage file on each proposal',
        note: 'Bid opening is read off the noting stage files; GeM opening events are not connected.'
      };
    }
  },
  { code: 'KPI-11', id: 'po_sc_st', title: 'PO value placed on SC/ST entrepreneurs', unit: 'pct', target: 4, compute: (ctx, keys) => { const m = shareMetric(ctx, (p) => p.vendor.mseScSt && p.vendor.mseScSt !== 'NA', 'mseScSt'); return { ...m, series: m.series(keys) }; } },
  { code: 'KPI-12', id: 'po_women', title: 'PO value placed on women entrepreneurs', unit: 'pct', target: 3, compute: (ctx, keys) => { const m = shareMetric(ctx, (p) => p.vendor.mseWomen && p.vendor.mseWomen !== 'NA', 'mseWomen'); return { ...m, series: m.series(keys) }; } },
  { code: 'KPI-13', id: 'po_msme', title: 'PO value placed on MSE suppliers', unit: 'pct', target: 25, compute: (ctx, keys) => { const m = shareMetric(ctx, (p) => p.vendor.mseCategory === 'MSE', 'mseCategory'); return { ...m, series: m.series(keys) }; } },
  { code: 'KPI-14', id: 'po_gem', title: 'PO value placed through GeM', unit: 'pct', target: null, compute: (ctx, keys) => { const m = shareMetric(ctx, (p) => p.isGem, 'tender no (GEM/…)'); return { ...m, series: m.series(keys), source: 'pos.json tender numbers beginning GEM/ × PO values (value-weighted, all POs on file)' }; } },
  {
    code: 'KPI-15', id: 'payment_time', title: 'Time taken for payment processing', unit: 'days', target: 30,
    compute: (ctx, keys) => {
      const done = ctx.pas.filter((p) => p.rvToPaymentDays != null);
      return {
        value: mean(done.map((p) => p.rvToPaymentDays)),
        detail: { count: done.length },
        series: keys.map((k) => { const m = done.filter((p) => inMonth(p.sentDate, k)); return { month: monthLabel(k), value: mean(m.map((p) => p.rvToPaymentDays)), count: m.length }; }),
        source: 'paymentAdvices.json history: RV date → dispatch to CPPC (as the payment register computes it)'
      };
    }
  },
  {
    code: 'KPI-16', id: 'mpr_to_po_time', title: 'Time taken from requisition to PO', unit: 'days', target: 60,
    compute: (ctx, keys) => {
      const conv = ctx.requisitions.map((r) => ({ r, poDate: ctx.reqPoDate(r) })).filter((x) => x.poDate).map((x) => ({ ...x, days: daysBetween(x.r.req_date, x.poDate) }));
      return {
        value: mean(conv.map((x) => x.days)),
        detail: { count: conv.length },
        series: keys.map((k) => { const m = conv.filter((x) => inMonth(x.poDate, k)); return { month: monthLabel(k), value: mean(m.map((x) => x.days)), count: m.length }; }),
        source: 'requisitions.db req_date → pos.json poDate for converted requisitions'
      };
    }
  }
];

export function computeAll({ months = 6, today = todayISO() } = {}) {
  const n = Math.min(24, Math.max(1, Number(months) || 6));
  const keys = lastMonths(n, today);
  const ctx = buildContext(today);
  const metrics = METRICS.map((m) => {
    const out = m.compute(ctx, keys);
    return {
      code: m.code,
      id: m.id,
      title: m.title,
      unit: out.unit ?? m.unit,
      value: out.value ?? null,
      target: m.target ?? null,
      targetSource: m.target != null ? 'Portal Hub item description' : null,
      detail: out.detail ?? null,
      series: out.series ?? [],
      source: out.source ?? null,
      note: out.note ?? (out.value == null ? 'No data in the prototype for this window' : null)
    };
  });
  return { asOf: today, months: n, window: keys.map(monthLabel), metrics, counts: { requisitions: ctx.requisitions.length, pos: ctx.pos.length, pas: ctx.pas.length, tenders: ctx.tenders.length, notes: ctx.notes.length } };
}
