// Mirror of the AI pipeline's procurement stage order (ai/stages.py ORDER) — the Node
// server cannot import the Python module, so the sequence + titles are duplicated here
// (as server/routes/ai.js already does for STAGE_META). Used by reports (current stage)
// and the cabinet next-action prompt (Phase 7). Keep in sync if ai/stages.py changes.
export const STAGE_ORDER = [
  'provisioning', 'tender_doc', 'emd', 'tec_req', 'tec_report', 'pbo', 'pnc_req', 'pnc_rec', 'pp', 'po'
];

export const STAGE_TITLE = {
  provisioning: 'Provisioning Note',
  tender_doc: 'Tender Document',
  emd: 'EMD Stage Acceptance',
  tec_req: 'TEC Request',
  tec_report: 'TEC Report',
  pbo: 'Price Bid Opening',
  pnc_req: 'PNC Request',
  pnc_rec: 'PNC Recommendation',
  pp: 'Purchase Proposal',
  po: 'Purchase Order + Contract'
};

// Need-based notes outside the linear ORDER (ai/stages.py NEEDBASED). `next` is used by
// the generic approval guard only to decide whether the file stays open after approval.
// The exact next note is still chosen by the user/cascade flow.
export const NEEDBASED = {
  retender: { title: 'Retender Note', next: 'tec_req' },
  short_closure: { title: 'Short Closure Note', next: null },
  tec_query: { title: 'TEC Query Note', next: 'tec_report' },
  advance_payment: { title: 'Advance Payment Note', next: 'pp' },
  po_amendment: { title: 'PO Amendment', next: null }
};

export const VALID_STAGES = new Set([...STAGE_ORDER, ...Object.keys(NEEDBASED)]);

export const stageTitle = (id) => STAGE_TITLE[id] || NEEDBASED[id]?.title || (id ? id : '—');

// The stage at which the tendering phase begins — stamps files.tendering_start so the
// live-status report can show "time since tendering" (email point 27).
export const TENDERING_START_STAGE = 'tender_doc';

export function nextStage(id) {
  if (Object.hasOwn(NEEDBASED, id)) return NEEDBASED[id].next;
  const i = STAGE_ORDER.indexOf(id);
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}
