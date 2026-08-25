// Mirror of the AI pipeline's procurement stage order (ai/stages.py ORDER) — the Node
// server cannot import the Python module, so the sequence + titles are duplicated here
// (as server/routes/ai.js already does for STAGE_META). Used by reports (current stage)
// and the cabinet next-action prompt (Phase 7). Keep in sync if ai/stages.py changes.
// Tender Document is prepared directly from the Provisioning Checklist and 72 STC clauses without note generation.
// Note 1 (N1) is Provisioning, Note 2 (N2) is EMD / TEC Request.
export const STAGE_ORDER = [
  'provisioning', 'emd', 'tec_req', 'tec_report', 'pbo', 'pnc_req', 'pnc_rec', 'pp', 'po'
];

export const STAGE_TITLE = {
  provisioning: 'Provisioning Note',
  emd: 'EMD Stage Acceptance Note',
  tec_req: 'TEC Request Note',
  tec_report: 'TEC Report Note',
  pbo: 'Price Bid Opening Note',
  pnc_req: 'PNC Request Note',
  pnc_rec: 'PNC Recommendation Note',
  pp: 'Purchase Proposal Note',
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

export const VALID_STAGES = new Set([...STAGE_ORDER, ...Object.keys(NEEDBASED), 'tender_doc']);

export const stageTitle = (id) => STAGE_TITLE[id] || NEEDBASED[id]?.title || (id ? id : '—');

// The stage at which the tendering phase begins — stamps files.tendering_start so the
// live-status report can show "time since tendering".
export const TENDERING_START_STAGE = 'emd';

export function nextStage(id) {
  if (id === 'provisioning') return 'emd';
  if (Object.hasOwn(NEEDBASED, id)) return NEEDBASED[id].next;
  const i = STAGE_ORDER.indexOf(id);
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}
