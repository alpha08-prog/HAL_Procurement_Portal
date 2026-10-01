// Claims (rejection / transit damage / shortage / warranty) — Module A's pattern: the JSON
// fixture loads once into memory, mutations live here until the server restarts. A claim
// always hangs off a real receipt voucher, so its PO, vendor and item come from the RV.
//   raised → dispatched (RMGP to vendor) → received (replacement / rectified) → closed
// `close` may also follow `raised` directly (credit note without a return).
import { readFileSync } from 'node:fs';
import { db as storeDb, rvByNo, vendorById, todayISO, daysBetween } from '../store.js';

export const claims = JSON.parse(readFileSync(new URL('../mock/claims.json', import.meta.url), 'utf8'));

export const CLAIM_TYPES = {
  rejection: 'Rejection at inward inspection',
  transit_damage: 'Transit damage',
  shortage: 'Shortage in consignment',
  warranty: 'Failure within warranty'
};
export const ACTIONS_SOUGHT = ['Replacement', 'Repair / rectification', 'Credit note', 'Free supply of shortage'];
export const CLAIM_STATUS = ['raised', 'dispatched', 'received', 'closed'];

export const CLAIM_TRANSITIONS = {
  dispatch: { from: ['raised'], to: 'dispatched', by: ['stores_inspection', 'admin'], label: 'Dispatch to vendor (returnable gate pass)', meta: ['gatePassNo'] },
  receive: { from: ['dispatched'], to: 'received', by: ['stores_inspection', 'admin'], label: 'Replacement / rectified item received', meta: [] },
  close: { from: ['received', 'raised'], to: 'closed', by: ['purchase_maker', 'stores_inspection', 'admin'], label: 'Close & settle', meta: ['settlement'] }
};

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

export function financialYear(iso) {
  const [y, m] = String(iso).split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${String(start).slice(-2)}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export function nextClaimNo(iso = todayISO()) {
  const fy = financialYear(iso);
  const prefix = `CLM/${fy}/`;
  const max = claims.filter((c) => c.claimNo.startsWith(prefix)).reduce((m, c) => Math.max(m, Number(c.claimNo.slice(prefix.length)) || 0), 0);
  return prefix + String(max + 1).padStart(3, '0');
}

export function joinClaim(c) {
  const rv = rvByNo(c.rvNo) ?? {};
  const vendor = vendorById(c.vendorId);
  const pa = storeDb.paymentAdvices.find((p) => p.rvNo === c.rvNo) ?? null;
  const today = todayISO();
  return {
    ...c,
    typeLabel: CLAIM_TYPES[c.type] ?? c.type,
    vendorName: vendor.name ?? c.vendorId,
    item: rv.description ?? null,
    rvDate: rv.rvDate ?? null,
    rvValue: rv.rvValue ?? null,
    invoiceValue: rv.invoiceValue ?? null,
    paNo: pa?.paNo ?? null,
    paStatus: pa?.status ?? rv.paStatus ?? null,
    agingDays: c.status === 'closed' ? daysBetween(c.raisedDate, c.closedDate) : daysBetween(c.raisedDate, today),
    availableActions: Object.entries(CLAIM_TRANSITIONS).filter(([, t]) => t.from.includes(c.status)).map(([id, t]) => ({ id, label: t.label, by: t.by, meta: t.meta }))
  };
}

export const claimByNo = (claimNo) => claims.find((c) => c.claimNo === claimNo) ?? null;
export const listClaims = () => claims.map(joinClaim);

export function createClaim(input = {}, user = null) {
  const rv = rvByNo(input.rvNo);
  if (!rv) fail(422, `Unknown RV "${input.rvNo ?? ''}" — a claim is raised against a receipt voucher on record`);
  if (!CLAIM_TYPES[input.type]) fail(422, `type must be one of ${Object.keys(CLAIM_TYPES).join(', ')}`);
  const qty = Number(input.qty);
  if (!(qty > 0)) fail(422, 'qty must be a positive number');
  const reason = String(input.reason ?? '').trim();
  if (!reason) fail(422, 'reason is required');
  const actionSought = ACTIONS_SOUGHT.includes(input.actionSought) ? input.actionSought : ACTIONS_SOUGHT[0];
  const today = todayISO();
  const claim = {
    claimNo: nextClaimNo(today),
    rvNo: rv.rvNo,
    poNo: rv.poNo,
    vendorId: rv.vendorId,
    type: input.type,
    qty,
    reason,
    actionSought,
    status: 'raised',
    raisedBy: user?.name ?? null,
    raisedByRole: user?.role ?? null,
    raisedDate: today,
    gatePassNo: null,
    dispatchDate: null,
    receivedDate: null,
    settlement: null,
    creditNoteNo: null,
    closedDate: null,
    history: [{ action: 'raised', by: user?.name ?? null, role: user?.role ?? null, date: today, remark: reason }]
  };
  claims.unshift(claim);
  return joinClaim(claim);
}

export function transitionClaim(claimNo, action, payload = {}, user = null) {
  const claim = claimByNo(claimNo);
  if (!claim) fail(404, `Unknown claim ${claimNo}`);
  const t = CLAIM_TRANSITIONS[action];
  if (!t) fail(422, `Unknown action "${action}"`);
  if (!t.from.includes(claim.status)) fail(409, `${claimNo} is ${claim.status}; "${t.label}" needs ${t.from.join(' or ')}`);
  if (user?.role !== 'admin' && !t.by.includes(user?.role)) fail(403, `Only ${t.by.filter((r) => r !== 'admin').join(' / ')} may ${t.label.toLowerCase()}`);
  for (const k of t.meta) if (!String(payload[k] ?? '').trim()) fail(422, `${k} is required for "${t.label}"`);
  const today = todayISO();
  if (action === 'dispatch') {
    claim.gatePassNo = String(payload.gatePassNo).trim();
    claim.dispatchDate = today;
  } else if (action === 'receive') {
    claim.receivedDate = today;
  } else if (action === 'close') {
    claim.settlement = String(payload.settlement).trim();
    claim.creditNoteNo = String(payload.creditNoteNo ?? '').trim() || null;
    claim.closedDate = today;
  }
  claim.status = t.to;
  claim.history.push({ action, by: user?.name ?? null, role: user?.role ?? null, date: today, remark: String(payload.remark ?? '').trim() || t.label });
  return joinClaim(claim);
}

// Where a claim may be needed but none is raised: RVs accepted below the invoice (a credit
// note is due) and payment advices held on a bank mismatch.
export function discrepancies() {
  const rows = [];
  for (const rv of storeDb.rvs) {
    const short = Number(rv.invoiceValue ?? 0) - Number(rv.rvValue ?? 0);
    if (short > 0 && !rv.creditNoteWaived) {
      rows.push({
        rvNo: rv.rvNo, poNo: rv.poNo, vendorName: vendorById(rv.vendorId).name ?? rv.vendorId, kind: 'value_shortfall',
        detail: `RV accepted ₹${short.toLocaleString('en-IN')} below the invoice — credit note ${rv.creditNoteUploaded ? 'uploaded' : 'pending'}`,
        amount: short, claimNo: claims.find((c) => c.rvNo === rv.rvNo)?.claimNo ?? null
      });
    }
  }
  for (const pa of storeDb.paymentAdvices) {
    if (pa.bankMismatch && !pa.bankMismatchResolved) {
      rows.push({
        rvNo: pa.rvNo, poNo: pa.poNo, vendorName: vendorById(pa.vendorId).name ?? pa.vendorId, kind: 'bank_mismatch',
        detail: `PA ${pa.paNo}: invoice bank differs from the PO/IFS bank — held at ${pa.status}`,
        amount: pa.finalPayment ?? null, claimNo: claims.find((c) => c.rvNo === pa.rvNo)?.claimNo ?? null
      });
    }
  }
  return rows;
}

export function summary() {
  const by = Object.fromEntries(CLAIM_STATUS.map((s) => [s, claims.filter((c) => c.status === s).length]));
  return {
    total: claims.length,
    byStatus: by,
    unitsDispatched: claims.filter((c) => c.status === 'dispatched').reduce((s, c) => s + c.qty, 0),
    unitsReceived: claims.filter((c) => c.status === 'received' || c.status === 'closed').reduce((s, c) => s + c.qty, 0),
    closed: by.closed,
    withCreditNote: claims.filter((c) => c.creditNoteNo).length
  };
}
