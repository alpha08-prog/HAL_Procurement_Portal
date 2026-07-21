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

// Need-based notes outside the linear ORDER (ai/stages.py NEEDBASED). `po_amendment` is
// the only one wired up: it can be added to a CLOSED file whose last approved note is the
// PO (or a previous amendment) — it reopens the file, and nextStage() stays null for it so
// its own approval closes the file again.
export const NEEDBASED = { po_amendment: 'PO Amendment' };

export const VALID_STAGES = new Set([...STAGE_ORDER, ...Object.keys(NEEDBASED)]);

export const stageTitle = (id) => STAGE_TITLE[id] || NEEDBASED[id] || (id ? id : '—');

// The stage at which the tendering phase begins — stamps files.tendering_start so the
// live-status report can show "time since tendering" (email point 27).
export const TENDERING_START_STAGE = 'tender_doc';

export function nextStage(id) {
  const i = STAGE_ORDER.indexOf(id);
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}
