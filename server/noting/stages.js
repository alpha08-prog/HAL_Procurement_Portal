// Mirror of the AI pipeline's procurement stage order (ai/stages.py ORDER) — the Node
// server cannot import the Python module, so the sequence + titles are duplicated here
// (as server/routes/ai.js already does for STAGE_META). Used by reports (current stage)
// and the cabinet next-action prompt (Phase 7). Keep in sync if ai/stages.py changes.
// Tender Document is prepared directly from the Provisioning Checklist and 72 STC clauses without note generation.
// Each stage is its own stage file (S1 Provisioning, S2 EMD or TEC Request, …) with minutes N1..Nx.
import { CASCADE_NODES } from '../ai/cascadeGraph.js';

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

// Tendering begins with the first stage raised after provisioning — EMD, or straight to TEC
// (client, 13/09/2026) — which stamps files.tendering_start for the live-status report.
export const startsTendering = (id) => Boolean(id) && id !== 'provisioning' && id !== 'tender_doc';

export function nextStage(id) {
  if (id === 'provisioning') return 'emd';
  if (Object.hasOwn(NEEDBASED, id)) return NEEDBASED[id].next;
  const i = STAGE_ORDER.indexOf(id);
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}

// What may follow an approved stage file, read off the responsibility-cascade sheet
// (server/ai/cascadeGraph.js): every stage leads to one decision node, whose options are the
// next stage's N1 or a need-based note (Retender, TEC Query, Short Closure, …). Advisory,
// like the sheet — the cabinet still lets the user skip to another stage.
const NODE_AFTER = Object.fromEntries(
  Object.values(CASCADE_NODES).flatMap((n) => n.options.map((o) => [o.noteId, o.next]))
);

export const followUps = (id) =>
  (CASCADE_NODES[NODE_AFTER[id]]?.options ?? []).map((o) => ({
    stageId: o.noteId,
    title: stageTitle(o.noteId),
    needBased: Object.hasOwn(NEEDBASED, o.noteId)
  }));
