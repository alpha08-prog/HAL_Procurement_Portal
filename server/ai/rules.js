// Deterministic money and branch logic — a port of ai/rules.py.
//
// The hard constraint the whole design rests on: the language model drafts prose and
// NEVER computes a figure or a statutory level. LD, SD, PBG, variance, savings and the
// CFA level are legal rules, not language, so they live here.
//
// Provenance of the percentages (all from sampleData):
//   SD 5%, PBG 10%        Checklist for Indentor + COMMERCIAL STANDARD TERMS AND CONDITIONS
//   LD 0.5%/wk, max 10%   Checklist clause 18 (was 17 before the June-2026 revision)
//   Indemnity 5%          Indemnity Bond Format.pdf
//   CFA level             DOP-2025 Annexure-3 — NOT in sampleData, so it stays a placeholder

const num = (s) => {
  if (s == null) return null;
  if (typeof s === 'number') return s;
  if (Array.isArray(s)) return s.length ? num(s[0]) : null;
  const t = String(s).replace(/[^\d.]/g, '');
  return t ? Number(t) : null;
};

// Case fields each branch rule needs before its answer means anything. The walker shows
// a rule as "undecided" rather than advising off absent data — at stage 1 nothing has
// ingested total_bids yet, so retender_required() cannot honestly say anything.
export const RULE_INPUTS = {
  pnc_required: ['l1_price'],
  retender_required: ['total_bids']
};

// Negotiation is advised when L1 is above the estimate, or nobody turned up to the
// reverse auction. Advisory only — the spreadsheet holds no conditional logic, so the
// walker may always override, and records that it did.
export function pnc_required(c) {
  const l1 = num(c.l1_price);
  const est = num(c.budget_estimate) ?? num(c.amount_figures);
  const ra = String(c.ra_status ?? '').toLowerCase();
  const noRa = ['none', 'nil', 'not participated', 'no vendor', 'did not']
    .some((k) => ra.includes(k));
  const over = l1 != null && est != null && l1 > est;
  return Boolean(over || noRa);
}

export function retender_required(c) {
  const tb = num(c.total_bids);
  const acc = c.emd_accepted ?? [];
  return tb === 0 || acc.length === 0;
}

export const pb_accepted = (c) => (c.pb_accepted ?? []).length > 0;

export const sd = (poBasic) => { const v = num(poBasic); return v ? Math.round(v * 0.05 * 100) / 100 : null; };
export const pbg = (poBasic) => { const v = num(poBasic); return v ? Math.round(v * 0.10 * 100) / 100 : null; };
export const indemnity = (poVal) => { const v = num(poVal); return v ? Math.round(v * 0.05 * 100) / 100 : null; };

export function ld(rv, weeks, po) {
  const r = num(rv);
  const p = num(po);
  if (r == null || p == null) return null;
  return Math.min(
    Math.round(0.005 * r * Math.ceil(weeks) * 100) / 100,
    Math.round(0.10 * p * 100) / 100
  );
}

export const basicOf = (total, gst = 0.18) => {
  const v = num(total);
  return v ? Math.round((v / (1 + gst)) * 100) / 100 : null;
};

export function savings(l1, final) {
  const a = num(l1);
  const b = num(final);
  if (a == null || b == null) return [null, null];
  const amt = Math.round((a - b) * 100) / 100;
  return [amt, a ? Math.round((amt / a) * 10000) / 100 : null];
}

export function variance(l1, est) {
  const a = num(l1);
  const b = num(est);
  if (a == null || b == null || !b) return null;
  return Math.round(((a - b) / b) * 10000) / 100;
}

export const LEVEL_DESIG = { 'Level I': 'GM(AOD)', 'Level II': 'AGM(IMM-OH)' };

// The DOP-2025 Annexure-3 value-band table is not in sampleData, so the level cannot be
// computed from an amount. The clause is derivable from the number of valid offers; the
// level is not, and says so rather than guessing.
export function dopCfaLevel({ tenderType = 'Open', validOffers = 2, value = null } = {}) {
  const multi = Boolean(validOffers && validOffers > 1);
  const clause = multi
    ? 'Annex-3-B-2 (L1 basis, more than one valid offer, Open/Limited tender)'
    : 'Annex-3-B-3 (single valid offer)';
  return {
    clause,
    tenderType,
    validOffers,
    value,
    level: '<DOP-2025 Annexure-3 value-band table not in sampleData — level requires the table>',
    levelDesignationMap: LEVEL_DESIG
  };
}

// A waiver is valid only if the bidder manufactures the offered product in the relevant
// NIC category. The bidder's own claim is not evidence.
export const emdWaiver = (b) => Boolean(b?.manufacturer && b?.nic_match);

// Evaluate a named branch rule against the case so far.
// Returns { value, undecided, missing } — undecided when the inputs are not on file yet.
export function evaluate(name, data) {
  const need = RULE_INPUTS[name] ?? [];
  const missing = need.filter((k) => {
    const v = data?.[k];
    return v == null || v === '' || (Array.isArray(v) && !v.length);
  });
  if (missing.length) return { value: null, undecided: true, missing };
  const fn = { pnc_required, retender_required }[name];
  if (!fn) return { value: null, undecided: true, missing: [`unknown rule ${name}`] };
  return { value: Boolean(fn(data)), undecided: false, missing: [] };
}

export default {
  RULE_INPUTS, pnc_required, retender_required, pb_accepted, sd, pbg, indemnity, ld,
  basicOf, savings, variance, dopCfaLevel, emdWaiver, evaluate, LEVEL_DESIG
};
