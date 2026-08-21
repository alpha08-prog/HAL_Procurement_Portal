// Case facts → per-stage inputs. A port of ai/load_inputs.py.
//
// One case object is assembled once, then each note draws only the fields it needs. The
// derived figures (variance, savings, SD, PBG) are computed here through rules.js, not
// transcribed from the source file — so a case can be edited and the numbers follow.
//
// The seed is ai/case_input.json, which is itself machine-generated from sampleData by
// ai/seed_case_input.py. A fixture (ai/fixtures/case_input_E33046.json) can be loaded
// instead; it carries `_fixture: true` so every screen can say so.

import { existsSync, readFileSync } from 'node:fs';
import * as rules from './rules.js';

const CASES = {
  nvb: {
    id: 'nvb',
    label: 'Night Vision Binoculars — CAR/25/229 (from sampleData)',
    url: new URL('../../ai/case_input.json', import.meta.url),
    fixture: false
  },
  led: {
    id: 'led',
    label: '250W LED High Bay — E-33046 (fabricated bids)',
    url: new URL('../../ai/fixtures/case_input_E33046.json', import.meta.url),
    fixture: true
  }
};

export function availableCases() {
  return Object.values(CASES)
    .filter((c) => existsSync(c.url))
    .map(({ id, label, fixture }) => ({ id, label, fixture }));
}

export function loadCase(id = 'nvb') {
  const spec = CASES[id] ?? CASES.nvb;
  if (!existsSync(spec.url)) {
    throw new Error(`case "${spec.id}" not found — expected ${spec.url.pathname}`);
  }
  const raw = JSON.parse(readFileSync(spec.url, 'utf8'));
  return { ...raw, _caseId: spec.id, _caseLabel: spec.label, _fixture: Boolean(raw._fixture ?? spec.fixture) };
}

const detail = (b) =>
  `${b.name} | ${b.udyam} | ${b.mse ?? ''} | NIC ${b.nic ?? 'N/A'}`;

// Map the case object onto the fields each note declares as new (stages.js `neu`).
export function toStageInputs(ci) {
  const req = ci.requisition ?? {};
  const tn = ci.tender ?? {};
  const b = ci.bidders ?? [];
  const tec = ci.tec ?? {};
  const pb = ci.price_bid ?? {};
  const lpp = ci.lpp ?? {};
  const co = ci.counter_offer ?? {};
  const pnc = ci.pnc ?? {};
  const pr = ci.proposal ?? {};

  const acc = b.filter((x) => x.emd === 'Accepted');
  const rej = b.filter((x) => x.emd !== 'Accepted');
  const est = req.mpr_estimate;
  const l1 = pb.l1_price;

  const varPct = rules.variance(l1, est);
  const [savAmt, savPct] = rules.savings(l1, co.price);
  const basic = rules.basicOf(co.price);

  return {
    provisioning: {
      item_description: req.item_description, car_no: req.car_no, car_date: req.car_date,
      budget_year: req.budget_year, budget_type: req.budget_type, amount_figures: est,
      amount_in_words: req.amount_in_words, dop_clause: req.dop_clause,
      reference_no: req.reference_no
    },
    tender_doc: {
      tender_type: tn.tender_type, commercial_conditions: 'Standard HAL Commercial T&C',
      ifs_enquiry_no: tn.tender_enquiry, tender_no: tn.tender_no
    },
    emd: {
      tender_no: tn.tender_no, tender_date: tn.tender_date,
      tender_enquiry: tn.tender_enquiry, total_bids: tn.total_bids,
      emd_accepted_detail: acc.map(detail),
      emd_rejected_detail: rej.map((x) =>
        `${x.name} | ${x.udyam} | ${x.emd_reason ?? 'Not qualified for EMD exemption (irrelevant NIC category)'}`),
      emd_accepted: acc.map((x) => x.name),
      emd_rejected: rej.map((x) => x.name)
    },
    tec_req: { tec_forwarded_detail: acc.map(detail) },
    tec_report: {
      tec_query: tec.query,
      tec_accepted_final: tec.accepted ?? [],
      tec_rejected_final: (tec.rejected ?? []).map((r) => r.name),
      spec_non_compliance: (tec.rejected ?? []).map((r) => `${r.name}: sl no ${r.spec_slnos}`)
    },
    pbo: {
      pb_accepted: tec.accepted ?? [],
      pb_rejected: (tec.rejected ?? []).map((r) => r.name),
      pm_clause: tec.pm_clause, l1_vendor: pb.l1_vendor, l1_price: l1,
      budget_estimate: est, ra_status: pb.ra_status
    },
    pnc_req: {
      lpp_contract: lpp.contract, lpp_price: lpp.price, price_variance_pct: varPct,
      pnc_committee: (pnc.committee ?? []).join('; ')
    },
    pnc_rec: {
      counter_offer_price: co.price, counter_offer_date: co.date,
      savings_amount: co.savings_amount ?? savAmt, savings_pct: savPct,
      recommended_vendor: pr.vendor, recommended_qty: req.quantity, final_price: co.price
    },
    pp: {
      proposal_id: pr.id, initiator: pr.initiator, initiator_desig: pr.initiator_desig,
      fca_name: pr.fca, fca_designation: pr.fca_desig, cfa_name: pr.cfa,
      cfa_designation: pr.cfa_desig, dop_level: pr.dop_level, final_value: pr.value,
      recommended_vendor: pr.vendor, recommended_qty: req.quantity
    },
    po: {
      po_no: '<from IFS-ERP>', recommended_vendor: pr.vendor,
      sd_amount: rules.sd(basic), pbg_amount: rules.pbg(basic),
      warranty: '12 months from acceptance / 18 from delivery',
      delivery_terms: 'FOR HAL Nashik'
    },

    // Need-based notes: reached out of order, so they are seeded with what the case knows
    // and the rest is entered on the screen at the moment they are raised.
    retender: {
      retender_reason: '', tender_no: tn.tender_no, tender_enquiry: tn.tender_enquiry,
      total_bids: tn.total_bids, retender_approval: ''
    },
    short_closure: {
      short_closure_reason: '', reference_no: req.reference_no, car_no: req.car_no,
      item_description: req.item_description
    },
    tec_query: { tec_query: tec.query, tec_query_bidders: acc.map((x) => x.name), tec_query_reply_due: '' },
    advance_payment: {
      recommended_vendor: pr.vendor, advance_pct: '', advance_amount: '',
      advance_bg_amount: '', advance_justification: ''
    },
    po_amendment: {
      po_no: '<from IFS-ERP>', amendment_no: '', amendment_reason: '',
      revised_value: '', recommended_vendor: pr.vendor
    }
  };
}

export default { availableCases, loadCase, toStageInputs };
