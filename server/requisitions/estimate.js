// Pre-tender price estimate (Portal Hub PRV-06). Pure function, all money server-side:
//   basic      = qty × unit rate
//   escalation = basic × escalation%          (price-level adjustment on the basis price)
//   gst        = (basic + escalation) × gst%
//   total      = basic + escalation + gst + freight & insurance
// Rounded half-up to 2 decimals at each step, like server/contracts/money.js.
import { amountInWords } from '../lib/amountWords.js';

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v, d = 0) => {
  if (v == null || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

export const BASES = {
  LPP: 'Last Purchase Price (LPP)',
  BQ: 'Budgetary quotations (minimum 3)',
  GEM: 'GeM portal indicative rate',
  INHOUSE: 'In-house cost estimate'
};

export function estimate(input = {}) {
  const basis = String(input.basis ?? 'LPP').toUpperCase();
  if (!BASES[basis]) fail(422, `basis must be one of ${Object.keys(BASES).join(', ')}`);
  const qty = num(input.qty, 0);
  const unitRate = num(input.unitRate, 0);
  const escalationPct = num(input.escalationPct, 0);
  const gstPct = num(input.gstPct, 18);
  const freight = num(input.freight, 0);
  for (const [k, v] of Object.entries({ qty, unitRate, escalationPct, gstPct, freight }))
    if (Number.isNaN(v)) fail(422, `${k} must be a number`);
  if (qty <= 0) fail(422, 'qty must be greater than zero');
  if (unitRate < 0 || escalationPct < 0 || gstPct < 0 || freight < 0) fail(422, 'inputs cannot be negative');

  const basic = r2(qty * unitRate);
  const escalation = r2((basic * escalationPct) / 100);
  const pretax = r2(basic + escalation);
  const gst = r2((pretax * gstPct) / 100);
  const total = r2(pretax + gst + freight);
  return {
    basis,
    basisLabel: BASES[basis],
    reference: input.reference ? String(input.reference).trim() : null,
    inputs: { qty, unitRate, escalationPct, gstPct, freight },
    lines: [
      { label: 'Basic price', formula: `${qty} × ₹${unitRate}`, amount: basic },
      { label: `Escalation (${escalationPct}%)`, formula: 'on basic price', amount: escalation },
      { label: `GST (${gstPct}%)`, formula: 'on basic + escalation', amount: gst },
      { label: 'Freight & insurance', formula: 'FOR HAL Nashik, added after tax', amount: r2(freight) }
    ],
    totals: { basic, escalation, pretax, gst, freight: r2(freight), total },
    totalWords: amountInWords(total),
    note: 'Computed server-side (server/requisitions/estimate.js). DOP-2025 value bands are not applied: ai/dop2025.json is pending from HAL, so the CFA level is not derived from this estimate.'
  };
}
