// Note definitions — a port of ai/stages.py.
//
// Each note declares: which fields are genuinely NEW at that stage (`neu`, the delta the
// language model is allowed to see), which deterministic annexures it produces
// (`formats`), which earlier note's prose it carries forward (`carry`), and whether it is
// conditional on a rule (`cond`).
//
// The split matters: the carried-forward prose and the annexure tables are assembled in
// code and never sent to the model, which is what keeps the prompt small and the figures
// exact. Only the new section is drafted.
//
// `carry: '$last'` means "carry whatever note was raised last" — the need-based notes are
// reached out of order, so they cannot name a fixed predecessor.

export const ORDER = ['provisioning', 'emd', 'tec_req', 'tec_report', 'pbo', 'pnc_req',
  'pnc_rec', 'pp', 'po'];

export const STAGES = {
  provisioning: {
    seq: 0, phase: 'PROVISIONING', note: 'Provisioning Note', file: 'F1', resp: 'Indenting',
    neu: ['item_description', 'car_no', 'car_date', 'budget_year', 'budget_type',
      'amount_figures', 'amount_in_words', 'dop_clause', 'reference_no'],
    formats: ['mpr_car'], carry: null, cond: null, ref: false
  },
  // Kept for completeness: the tender document is prepared straight from the
  // provisioning checklist plus the 72 STC clauses, so it is not in ORDER.
  tender_doc: {
    seq: 1, phase: 'TENDERING', note: 'Tender Document (Checklist + 72 Clauses)',
    file: null, resp: 'Tendering',
    neu: ['tender_type', 'commercial_conditions', 'ifs_enquiry_no', 'tender_no'],
    formats: ['sd_format', 'pbg_format'], carry: null, cond: null, ref: false
  },
  emd: {
    seq: 2, phase: 'TENDERING', note: 'EMD Stage Acceptance Note', file: 'F2', resp: 'Tendering',
    neu: ['tender_no', 'tender_date', 'tender_enquiry', 'total_bids',
      'emd_accepted_detail', 'emd_rejected_detail'],
    formats: [], carry: null, cond: null, ref: false
  },
  tec_req: {
    seq: 3, phase: 'TECHNICAL', note: 'TEC Request Note', file: 'F3', resp: 'Tendering',
    neu: ['tec_forwarded_detail'],
    formats: [], carry: 'emd', cond: null, ref: false
  },
  tec_report: {
    seq: 4, phase: 'TECHNICAL', note: 'TEC Report Note', file: null, resp: 'Indenting',
    neu: ['tec_query', 'tec_accepted_final', 'tec_rejected_final', 'spec_non_compliance'],
    formats: ['tec_statement'], carry: 'tec_req', cond: null, ref: false
  },
  pbo: {
    seq: 5, phase: 'COMMERCIAL', note: 'Price Bid Opening Note', file: 'F4', resp: 'Tendering',
    neu: ['pb_accepted', 'pb_rejected', 'pm_clause', 'l1_vendor', 'l1_price',
      'budget_estimate', 'ra_status'],
    formats: ['tec_statement'], carry: 'tec_report', cond: null, ref: true
  },
  pnc_req: {
    seq: 6, phase: 'COMMERCIAL', note: 'PNC Request Note', file: 'F5', resp: 'Tendering',
    neu: ['lpp_contract', 'lpp_price', 'price_variance_pct', 'pnc_committee'],
    formats: ['commercial_eval', 'comparative_statement', 'price_justification', 'pnc_agenda'],
    carry: 'pbo', cond: 'pnc_required', ref: true
  },
  pnc_rec: {
    seq: 7, phase: 'COMMERCIAL', note: 'PNC Recommendation Note', file: 'F6', resp: 'Tendering',
    neu: ['counter_offer_price', 'counter_offer_date', 'savings_amount', 'savings_pct',
      'recommended_vendor', 'recommended_qty', 'final_price'],
    formats: ['pnc_recommendation'], carry: 'pnc_req', cond: 'pnc_required', ref: true
  },
  pp: {
    seq: 8, phase: 'COMMERCIAL', note: 'Purchase Proposal Note', file: 'F7', resp: 'Tendering',
    neu: ['proposal_id', 'initiator', 'initiator_desig', 'fca_name', 'fca_designation',
      'cfa_name', 'cfa_designation', 'dop_level', 'final_value', 'recommended_vendor',
      'recommended_qty'],
    formats: ['purchase_proposal'], carry: 'pnc_rec', cond: null, ref: true
  },
  po: {
    seq: 9, phase: 'COMMERCIAL', note: 'Purchase Order + HAL Contract', file: null, resp: 'Tendering',
    neu: ['po_no', 'recommended_vendor', 'sd_amount', 'pbg_amount', 'warranty', 'delivery_terms'],
    formats: ['purchase_order', 'hal_contract'], carry: null, cond: null, ref: true
  }
};

// The five need-based notes the responsibility-cascading sheet actually places in the
// post-tender-opening cascade. Same shape as STAGES so the pipeline can execute them;
// deliberately not in ORDER.
export const NEEDBASED_STAGES = {
  retender: {
    seq: 10, phase: 'TENDERING', note: 'Retender Note', file: null, resp: 'Tendering',
    neu: ['retender_reason', 'tender_no', 'tender_enquiry', 'total_bids', 'retender_approval'],
    formats: [], carry: null, cond: null, ref: false
  },
  short_closure: {
    seq: 11, phase: 'ANY', note: 'Short Closure Note', file: null, resp: 'Tendering',
    neu: ['short_closure_reason', 'reference_no', 'car_no', 'item_description'],
    formats: [], carry: '$last', cond: null, ref: false
  },
  tec_query: {
    seq: 12, phase: 'TECHNICAL', note: 'TEC Query Note', file: null, resp: 'Indenting',
    neu: ['tec_query', 'tec_query_bidders', 'tec_query_reply_due'],
    formats: [], carry: null, cond: null, ref: false
  },
  advance_payment: {
    seq: 13, phase: 'COMMERCIAL', note: 'Advance Payment Note', file: null, resp: 'Tendering',
    neu: ['recommended_vendor', 'advance_pct', 'advance_amount', 'advance_bg_amount',
      'advance_justification'],
    formats: ['advance_payment'], carry: '$last', cond: null, ref: true
  },
  po_amendment: {
    seq: 14, phase: 'COMMERCIAL', note: 'PO Amendment Note', file: null, resp: 'Tendering',
    neu: ['po_no', 'amendment_no', 'amendment_reason', 'revised_value', 'recommended_vendor'],
    formats: [], carry: '$last', cond: null, ref: true
  }
};

export const ALL_STAGES = { ...STAGES, ...NEEDBASED_STAGES };

export const REF = {
  provisioning: 'Provisioning_Note', tender_doc: 'Tender_Document',
  emd: 'EMD_Stage_Acceptance', tec_req: 'TEC_Req', tec_report: 'TEC_Report',
  pbo: 'PBO_Req', pnc_req: 'PNC_Req', pnc_rec: 'PNC_Recc',
  pp: 'Purchase_Proposal', po: 'PO_HAL_Contract', retender: 'Retender_Note',
  short_closure: 'Short_Closure_Note', tec_query: 'TEC_Query_Note',
  advance_payment: 'Advance_Payment_Note', po_amendment: 'PO_Amendment_Note'
};

export default { ORDER, STAGES, NEEDBASED_STAGES, ALL_STAGES, REF };
