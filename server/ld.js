import { daysBetween } from './store.js';

// Liquidated damages, per PO terms (run `node server/ld.check.mjs` to verify).
// The maker drives three switches (Screen 2 "black"/user operations) and the totals
// are re-derived server-side so the UI never does money math:
//   ldApplicable   'Yes'/'No' — master switch; 'No' zeroes the whole deduction.
//   ldByGateEntry  'Yes'/'No' — include (a), the automatic supply-delay LD.
//   ldByFtr        'Yes'/'No' — include (b), the manual installation & commissioning LD.
//   (a) supply delay  — 0.5% of RV value per week OR PART THEREOF (ceil) of delay
//                       between the PO delivery-due date and gate entry. Computed.
//   (b) installation & commissioning delay — manual maker entry (ldIcAmount), judged
//                       against the FTR date.
//   LD total = a + b, capped at 10% of the PO ORDER VALUE (not the RV value —
//   flagged for client confirmation). Final proposed payment = RV value − LD total.
//
// Second arg accepts either an options object or, for back-compat, a bare ldIcAmount
// number (in which case every switch is treated as "on").
export function computeLd(rv, opts = {}) {
  const o =
    typeof opts === 'number'
      ? { ldIcAmount: opts, ldApplicable: 'Yes', ldByGateEntry: 'Yes', ldByFtr: 'Yes' }
      : opts;
  const ldApplicable = o.ldApplicable ?? 'Yes';
  const ldByGateEntry = o.ldByGateEntry ?? 'Yes';
  const ldByFtr = o.ldByFtr ?? 'No';
  const applicable = ldApplicable === 'Yes';

  const daysLate = Math.max(0, daysBetween(rv.deliveryDueDate, rv.gateEntryDate));
  const ldWeeks = Math.ceil(daysLate / 7);
  const ldCap = Math.round((rv.poValue ?? rv.rvValue) * 0.1);

  const ldSupplyAmount =
    applicable && ldByGateEntry === 'Yes' ? Math.round(rv.rvValue * 0.005 * ldWeeks) : 0;
  const ldIcAmount =
    applicable && ldByFtr === 'Yes' ? Math.round(Number(o.ldIcAmount) || 0) : 0;
  const uncapped = ldSupplyAmount + ldIcAmount;
  const ldAmount = Math.min(uncapped, ldCap);
  return {
    ldApplicable,
    ldByGateEntry,
    ldByFtr,
    ldWeeks,
    ldSupplyAmount,
    ldIcAmount,
    ldCap,
    ldCapApplied: uncapped > ldCap,
    ldAmount,
    finalPayment: rv.rvValue - ldAmount
  };
}
