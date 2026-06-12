import { daysBetween } from './store.js';

// Liquidated damages, per PO terms (run `node server/ld.check.mjs` to verify):
//   (a) supply delay  — 0.5% of RV value per week OR PART THEREOF (ceil) of delay
//                       between the PO delivery-due date and gate entry. Computed.
//   (b) installation & commissioning delay — manual maker entry, judged against
//                       the FTR date. Comes in as ldIcAmount.
//   LD total = a + b, capped at 10% of the PO ORDER VALUE (not the RV value —
//   flagged for client confirmation). Final proposed payment = RV value − LD total.
export function computeLd(rv, ldIcAmount = 0) {
  const daysLate = Math.max(0, daysBetween(rv.deliveryDueDate, rv.gateEntryDate));
  const ldWeeks = Math.ceil(daysLate / 7);
  const ldSupplyAmount = Math.round(rv.rvValue * 0.005 * ldWeeks);
  const ldCap = Math.round((rv.poValue ?? rv.rvValue) * 0.1);
  const ic = Math.round(Number(ldIcAmount) || 0);
  const uncapped = ldSupplyAmount + ic;
  const ldAmount = Math.min(uncapped, ldCap);
  return {
    ldWeeks,
    ldSupplyAmount,
    ldIcAmount: ic,
    ldCap,
    ldCapApplied: uncapped > ldCap,
    ldAmount,
    finalPayment: rv.rvValue - ldAmount
  };
}
