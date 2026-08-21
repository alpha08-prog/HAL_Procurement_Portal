// The annexure builders — a port of ai/formats.py.
//
// Every one of these is pure data assembly from the case. They are the tables that go on
// the file as Annexures 21A–21F, the Purchase Proposal, the PO and the contract. None of
// them is ever drafted by the language model: the model receives only the annexure
// *names* so it can reference them in prose, never their contents.

const list = (x) => (Array.isArray(x) ? x : (x == null || x === '' ? [] : [x]));
const first = (x) => (Array.isArray(x) ? (x.length ? x[0] : null) : x);

// Vendor lists arrive either as plain names or as "name | udyam | mse | NIC" detail rows.
const vendors = (x) => list(x).map((v) => String(v).split('|')[0].trim());

const B = {
  mpr_car: (c) => ({
    format: 'MPR/SPR/CAR', car_no: c.car_no, date: c.car_date, item: c.item_description,
    budget_year: c.budget_year, value: first(c.amount_figures)
  }),
  tec_statement: (c) => ({
    format: 'Annex 21A TEC Statement',
    accepted: vendors(c.tec_accepted_final),
    rejected: list(c.tec_rejected_final),
    non_compliance: list(c.spec_non_compliance)
  }),
  comparative_statement: (c) => ({
    format: 'Annex 21B Comparative Statement', l1_vendor: c.l1_vendor,
    l1_price: first(c.l1_price), estimate: c.budget_estimate ?? first(c.amount_figures),
    bidders: list(c.pb_accepted)
  }),
  commercial_eval: (c) => ({
    format: 'Annex 21C Commercial Evaluation', l1_vendor: c.l1_vendor,
    l1_price: first(c.l1_price), ra_status: c.ra_status
  }),
  price_justification: (c) => ({
    format: 'Annex 21D Price Justification', l1_price: first(c.l1_price),
    lpp: c.lpp_price, lpp_contract: c.lpp_contract, variance_pct: c.price_variance_pct,
    estimate: c.budget_estimate ?? first(c.amount_figures)
  }),
  pnc_agenda: (c) => ({
    format: 'Annex 21E PNC Agenda', committee: c.pnc_committee, l1_vendor: c.l1_vendor,
    l1_price: first(c.l1_price), variance_pct: c.price_variance_pct
  }),
  pnc_recommendation: (c) => ({
    format: 'Annex 21F PNC Recommendation',
    vendor: c.recommended_vendor ?? c.l1_vendor, qty: c.recommended_qty,
    counter_offer: first(c.counter_offer_price), final_price: first(c.final_price),
    savings: c.savings_amount, savings_pct: c.savings_pct
  }),
  purchase_proposal: (c) => ({
    format: 'Annex 21 Purchase Proposal', proposal_id: c.proposal_id,
    vendor: c.recommended_vendor ?? c.l1_vendor,
    value: c.final_value ?? first(c.final_price), initiator: c.initiator,
    fca: c.fca_name, cfa: c.cfa_name, dop_level: c.dop_level
  }),
  purchase_order: (c) => ({
    format: 'Purchase Order', po_no: c.po_no, vendor: c.recommended_vendor ?? c.l1_vendor,
    value: c.final_value ?? first(c.final_price), sd: c.sd_amount, pbg: c.pbg_amount,
    warranty: c.warranty, delivery: c.delivery_terms
  }),
  hal_contract: (c) => ({
    format: 'HAL Standard Contract', vendor: c.recommended_vendor ?? c.l1_vendor,
    sd: c.sd_amount, pbg: c.pbg_amount, warranty: c.warranty
  }),
  advance_payment: (c) => ({
    format: 'Advance Payment Format', vendor: c.recommended_vendor ?? c.l1_vendor,
    pct: c.advance_pct, advance: first(c.advance_amount),
    bg_amount: first(c.advance_bg_amount), justification: c.advance_justification
  }),
  sd_format: () => ({ format: 'Bank Guarantee (Security Deposit)', pct: '5% of PO basic value' }),
  pbg_format: () => ({ format: 'Bank Guarantee (Performance)', pct: '10% of PO basic value' })
};

export const REGISTRY = Object.keys(B);

export function build(fid, caseData) {
  const fn = B[fid];
  return fn ? fn(caseData ?? {}) : { format: fid, note: 'no builder registered' };
}

export default { build, REGISTRY };
