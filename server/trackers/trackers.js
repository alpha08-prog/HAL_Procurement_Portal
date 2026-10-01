// Read-only PO/receipt/securities trackers behind the Portal Hub "tracker" tools
// (CON-02/04/05/06/07/09/10, PAY-06). Everything is derived at request time from the IFS
// fixtures (server/mock/pos.json, rvs.json, vendors.json, paymentAdvices.json) and the
// contract register (contracts.db); there is no live IFS/GeM connector, and every response
// says so in `source`. LD figures come from the same computeLd() the payment advice uses.
import { allPos } from '../contracts/poSource.js';
import { computeItems } from '../contracts/money.js';
import { all as contractsAll } from '../contracts/db.js';
import { db, vendorById, todayISO, daysBetween } from '../store.js';
import { computeLd } from '../ld.js';
import { sd, pbg } from '../ai/rules.js';

export const SOURCE = 'IFS fixtures (server/mock/pos.json, rvs.json, vendors.json, paymentAdvices.json) + contracts.db — no live IFS/GeM connector in the prototype';

const dpDays = (s) => {
  const m = /(\d+)\s*days/i.exec(String(s ?? ''));
  return m ? Number(m[1]) : null;
};
export const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function contractsByPo() {
  const m = new Map();
  try {
    for (const c of contractsAll('SELECT * FROM contracts ORDER BY id')) if (!m.has(c.po_no)) m.set(c.po_no, c);
  } catch {
    /* contracts store unavailable — trackers still work without contract columns */
  }
  return m;
}

// One row per PO in the fixture, joined with its RVs, PAs, vendor and contract.
export function poRows() {
  const today = todayISO();
  const cbp = contractsByPo();
  return allPos().map((p) => {
    const vendor = vendorById(p.vendorId);
    const { totals } = computeItems(p.items);
    const rvs = db.rvs.filter((r) => r.poNo === p.poNo);
    const pas = db.paymentAdvices.filter((x) => x.poNo === p.poNo);
    const days = dpDays(p.deliveryPeriod);
    // Once an RV exists its own delivery-due date is authoritative (it is what the PA uses).
    const dueDate = rvs[0]?.deliveryDueDate ?? (days != null ? addDays(p.poDate, days) : null);
    const c = cbp.get(p.poNo) ?? null;
    return {
      poNo: p.poNo,
      poDate: p.poDate,
      tenderNo: p.tenderNo,
      carNo: p.carNo,
      vendorId: p.vendorId,
      vendorName: vendor.name ?? p.vendorId,
      mseCategory: vendor.mseCategory ?? 'Non-MSE',
      description: p.description,
      deliveryPeriod: p.deliveryPeriod,
      dueDate,
      daysToDue: dueDate ? daysBetween(today, dueDate) : null,
      basicValue: totals.basicValue,
      landedValue: totals.landedValue,
      lineCount: p.items.length,
      rvNos: rvs.map((r) => r.rvNo),
      received: rvs.length > 0,
      gateEntryDate: rvs[0]?.gateEntryDate ?? null,
      paNo: pas[0]?.paNo ?? null,
      paStatus: pas[0]?.status ?? null,
      paid: pas.some((x) => x.status === 'paid'),
      contractId: c?.id ?? null,
      contractNo: c?.contract_no ?? null,
      contractStatus: c?.status ?? null,
      releasedAt: c?.released_at ?? null,
      gemContractNo: rvs.find((r) => r.gemContractNo)?.gemContractNo ?? null,
      gemContractDate: rvs.find((r) => r.gemContractDate)?.gemContractDate ?? null,
      isGem: /^GEM\//i.test(p.tenderNo)
    };
  });
}

function poDue() {
  return poRows()
    .filter((r) => !r.received)
    .map((r) => ({
      ...r,
      status: r.daysToDue == null ? 'No delivery period on PO' : r.daysToDue < 0 ? 'Overdue' : r.daysToDue <= 15 ? 'Due within 15 days' : 'On schedule'
    }))
    .sort((a, b) => (a.daysToDue ?? 9e9) - (b.daysToDue ?? 9e9));
}

// A PO is DP-expired when the goods arrived after the due date, or have not arrived and the
// due date has passed. LD is computed exactly as on the payment advice; for goods still
// outstanding the delay is projected to today.
function dpExpired() {
  const today = todayISO();
  const rows = [];
  for (const r of poRows()) {
    if (!r.dueDate) continue;
    const arrived = r.received ? r.gateEntryDate : today;
    if (daysBetween(r.dueDate, arrived) <= 0) continue;
    const rv = db.rvs.find((x) => x.poNo === r.poNo);
    const ld = computeLd(
      { deliveryDueDate: r.dueDate, gateEntryDate: arrived, rvValue: rv?.rvValue ?? r.landedValue, poValue: rv?.poValue ?? r.landedValue },
      { ldApplicable: 'Yes', ldByGateEntry: 'Yes', ldByFtr: 'No' }
    );
    rows.push({
      ...r,
      daysLate: daysBetween(r.dueDate, arrived),
      ldBasis: r.received ? `Gate entry ${r.gateEntryDate} (RV ${r.rvNos.join(', ')})` : `Not received — delay projected to ${today}`,
      ldWeeks: ld.ldWeeks,
      ldSupplyAmount: ld.ldSupplyAmount,
      ldCap: ld.ldCap,
      ldCapApplied: ld.ldCapApplied,
      ldAmount: ld.ldAmount,
      action: r.received ? 'LD recovered on the payment advice' : 'Expedite; DP extension note (Portal Hub PRO-11) if the delay is not attributable to the vendor'
    });
  }
  // RVs whose PO is not in the PO fixture still carry their own due/gate dates.
  const covered = new Set(rows.map((r) => r.poNo));
  for (const rv of db.rvs) {
    if (covered.has(rv.poNo) || allPos().some((p) => p.poNo === rv.poNo)) continue;
    if (daysBetween(rv.deliveryDueDate, rv.gateEntryDate) <= 0) continue;
    const vendor = vendorById(rv.vendorId);
    const ld = computeLd(rv, { ldApplicable: 'Yes', ldByGateEntry: 'Yes', ldByFtr: 'No' });
    rows.push({
      poNo: rv.poNo,
      poDate: rv.poDate,
      vendorName: vendor.name ?? rv.vendorId,
      description: rv.description,
      dueDate: rv.deliveryDueDate,
      landedValue: rv.poValue,
      received: true,
      rvNos: [rv.rvNo],
      gateEntryDate: rv.gateEntryDate,
      daysLate: daysBetween(rv.deliveryDueDate, rv.gateEntryDate),
      ldBasis: `Gate entry ${rv.gateEntryDate} (RV ${rv.rvNo})`,
      ldWeeks: ld.ldWeeks,
      ldSupplyAmount: ld.ldSupplyAmount,
      ldCap: ld.ldCap,
      ldCapApplied: ld.ldCapApplied,
      ldAmount: ld.ldAmount,
      action: 'LD recovered on the payment advice'
    });
  }
  return rows.sort((a, b) => b.daysLate - a.daysLate);
}

function livePo() {
  return poRows().map((r) => ({
    ...r,
    stage: r.paid
      ? 'Paid'
      : r.paStatus
        ? `Payment advice ${r.paStatus}`
        : r.received
          ? `Received (RV ${r.rvNos.join(', ')})`
          : r.releasedAt
            ? 'Contract released'
            : r.contractStatus === 'finalised'
              ? 'Contract finalised'
              : r.contractStatus === 'draft'
                ? 'Contract draft'
                : 'Open — awaiting supply'
  }));
}

function poReceipts() {
  const today = todayISO();
  return db.rvs.map((rv) => {
    const vendor = vendorById(rv.vendorId);
    const pa = db.paymentAdvices.find((x) => x.rvNo === rv.rvNo);
    return {
      rvNo: rv.rvNo,
      rvDate: rv.rvDate,
      gateEntryNo: rv.gateEntryNo,
      gateEntryDate: rv.gateEntryDate,
      qcDate: rv.qcDate ?? null,
      ftrDate: rv.ftrDate ?? null,
      poNo: rv.poNo,
      poDate: rv.poDate,
      vendorName: vendor.name ?? rv.vendorId,
      description: rv.description,
      rvValue: rv.rvValue,
      invoiceNo: rv.invoiceNo ?? null,
      invoiceValue: rv.invoiceValue ?? null,
      gemContractNo: rv.gemContractNo ?? null,
      paNo: pa?.paNo ?? null,
      paStatus: pa?.status ?? rv.paStatus ?? 'rv_pending',
      daysSinceRv: daysBetween(rv.rvDate, today)
    };
  });
}

function securities() {
  const rows = poRows().map((r) => {
    const pa = r.paNo ? db.paymentAdvices.find((x) => x.paNo === r.paNo) : null;
    const s = pa?.securities ?? null;
    return {
      poNo: r.poNo,
      vendorName: r.vendorName,
      description: r.description,
      basicValue: r.basicValue,
      sdAmount: sd(r.basicValue),
      pbgAmount: pbg(r.basicValue),
      emd: s?.emd?.applicable ?? 'NA',
      sdStatus: s ? `${s.sd.applicable}${s.sd.onHold ? ' — on hold' : ''}${s.sd.copyEnclosed === 'Yes' ? ' — copy enclosed' : ''}` : 'Not yet lodged on a payment advice',
      pbgStatus: s ? `${s.pbg.applicable}${s.pbg.onHold ? ' — on hold' : ''}${s.pbg.copyEnclosed === 'Yes' ? ' — copy enclosed' : ''}` : 'Not yet lodged on a payment advice',
      indemnity: s?.indemnity?.applicable ?? 'NA',
      paNo: r.paNo,
      basis: 'SD 5% / PBG 10% of PO basic value (server/ai/rules.js)'
    };
  });
  const covered = new Set(rows.map((r) => r.poNo));
  for (const pa of db.paymentAdvices) {
    if (covered.has(pa.poNo) || !pa.securities) continue;
    const vendor = vendorById(pa.vendorId);
    const s = pa.securities;
    rows.push({
      poNo: pa.poNo,
      vendorName: vendor.name ?? pa.vendorId,
      description: db.rvs.find((r) => r.rvNo === pa.rvNo)?.description ?? '',
      basicValue: null,
      sdAmount: s.sd?.amount ?? null,
      pbgAmount: s.pbg?.amount ?? null,
      emd: s.emd?.applicable ?? 'NA',
      sdStatus: `${s.sd.applicable}${s.sd.onHold ? ' — on hold' : ''}${s.sd.copyEnclosed === 'Yes' ? ' — copy enclosed' : ''}`,
      pbgStatus: `${s.pbg.applicable}${s.pbg.onHold ? ' — on hold' : ''}${s.pbg.copyEnclosed === 'Yes' ? ' — copy enclosed' : ''}`,
      indemnity: s.indemnity?.applicable ?? 'NA',
      paNo: pa.paNo,
      basis: 'As recorded on the payment advice (PO not in pos.json)'
    });
  }
  return rows;
}

function balanceOutstanding() {
  const today = todayISO();
  return db.rvs.map((rv) => {
    const vendor = vendorById(rv.vendorId);
    const pa = db.paymentAdvices.find((x) => x.rvNo === rv.rvNo);
    const status = pa?.status ?? rv.paStatus ?? 'rv_pending';
    const payable = pa?.finalPayment ?? rv.rvValue;
    return {
      rvNo: rv.rvNo,
      rvDate: rv.rvDate,
      poNo: rv.poNo,
      vendorName: vendor.name ?? rv.vendorId,
      rvValue: rv.rvValue,
      ldAmount: pa?.ldAmount ?? null,
      payable,
      status,
      outstanding: status === 'paid' ? 0 : payable,
      agingDays: daysBetween(rv.rvDate, today),
      paNo: pa?.paNo ?? null
    };
  });
}

function erelease() {
  return poRows().map((r) => ({
    ...r,
    releaseStatus: !r.contractNo
      ? 'No contract generated yet (Contract Generator, CON-03)'
      : r.releasedAt
        ? `Released to IFS on ${r.releasedAt}`
        : r.contractStatus === 'finalised'
          ? 'Contract finalised — release to IFS not yet recorded'
          : 'Contract still in draft'
  }));
}

function gemSync() {
  return poRows().map((r) => ({
    ...r,
    syncStatus: !r.isGem
      ? 'Not a GeM tender'
      : r.gemContractNo
        ? 'GeM contract no on record (from the RV)'
        : 'GeM contract no not on record — update after PO acceptance on GeM'
  }));
}

export const TRACKERS = {
  'po-due': { hub: 'CON-06', title: 'PO Due — delivery countdown', run: poDue, note: 'POs without a receipt voucher, ordered by days to the contractual due date.' },
  'dp-expired': { hub: 'CON-07', title: 'DP Expired — liquidated damages', run: dpExpired, note: 'LD at 0.5% of RV value per week or part thereof, capped at 10% of the PO value (server/ld.js).' },
  'live-po': { hub: 'CON-05', title: 'Live PO status', run: livePo, note: 'Every PO in the fixture with its contract, receipt and payment stage.' },
  'po-receipts': { hub: 'CON-09', title: 'PO receipt information (GRN / RV linkage)', run: poReceipts, note: 'One row per receipt voucher with gate entry, QC/FTR and payment-advice status.' },
  securities: { hub: 'CON-10', title: 'EMD, SD, PBG securities', run: securities, note: 'SD 5% and PBG 10% of the PO basic value; lodging status from the payment advice.' },
  'balance-outstanding': { hub: 'PAY-06', title: 'Balance / outstanding payment', run: balanceOutstanding, note: 'Payable per RV after LD, less what CPPC has paid.' },
  erelease: { hub: 'CON-02', title: 'e-Release of PO to IFS', run: erelease, note: 'Release is recorded on the contract; no IFS connector exists in the prototype.' },
  'gem-sync': { hub: 'CON-04', title: 'GeM contract synchronisation', run: gemSync, note: 'GeM contract numbers are those recorded on the receipt voucher.' }
};

export const trackerNames = () => Object.keys(TRACKERS);

export function runTracker(name) {
  const t = TRACKERS[name];
  if (!t) return null;
  const rows = t.run();
  return { name, hub: t.hub, title: t.title, note: t.note, rows, count: rows.length, source: SOURCE, asOf: todayISO() };
}
