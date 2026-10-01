// A requisition's status is DERIVED, never stored: it is whatever the linked records say
// right now — the noting stage files (C), the contract (D), the RV and payment advice (A).
// Ladder (first match wins, from the end of the lifecycle backwards):
//   short_closed / rejected   an approved Short Closure note, or the latest stage rejected
//   paid                      a payment advice on the PO reached `paid`
//   received                  a receipt voucher exists for the PO
//   contracted                a finalised/released contract on the PO
//   po_placed                 a PO no is linked, or the PO stage note is approved
//   pp_approved               the Purchase Proposal stage note is approved
//   tendering                 a tender no, tendering_start, or any post-provisioning stage
//   provisioning              a noting file exists
//   checklist_done            the indentor checklist was submitted (approvals)
//   registered                nothing linked yet
import { all as notingAll, get as notingGet } from '../noting/db.js';
import { get as contractsGet } from '../contracts/db.js';
import { db as storeDb } from '../store.js';
import { stageTitle } from '../noting/stages.js';

export const STATUS_ORDER = ['registered', 'checklist_done', 'provisioning', 'tendering', 'pp_approved', 'po_placed', 'contracted', 'received', 'paid'];
export const TERMINAL_STATUSES = ['short_closed', 'rejected'];
export const STATUS_LABEL = {
  registered: 'Registered',
  checklist_done: 'Checklist submitted',
  provisioning: 'Provisioning',
  tendering: 'Tendering',
  pp_approved: 'PP approved',
  po_placed: 'PO placed',
  contracted: 'Contracted',
  received: 'Received',
  paid: 'Paid',
  short_closed: 'Short-closed',
  rejected: 'Rejected'
};

const S = (status, evidence) => ({ status, label: STATUS_LABEL[status], evidence });

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function deriveStatus(r) {
  const notes = r.noting_file_pk
    ? safe(() => notingAll('SELECT seq, stage_id, status, closed_at, created_at FROM notes WHERE file_pk = ? ORDER BY seq', r.noting_file_pk), [])
    : [];
  const file = r.noting_file_pk ? safe(() => notingGet('SELECT id, status, tendering_start FROM files WHERE id = ?', r.noting_file_pk), null) : null;
  const last = notes.at(-1) ?? null;

  const shortClosed = notes.find((n) => n.stage_id === 'short_closure' && n.status === 'approved');
  if (shortClosed) return S('short_closed', `Short closure approved ${shortClosed.closed_at}`);
  if (last?.status === 'rejected') return S('rejected', `${stageTitle(last.stage_id)} (S${last.seq}) rejected ${last.closed_at}`);

  if (r.po_no) {
    const pas = storeDb.paymentAdvices.filter((p) => p.poNo === r.po_no);
    const paid = pas.find((p) => p.status === 'paid');
    if (paid) return S('paid', `PA ${paid.paNo} paid`);
    const rv = storeDb.rvs.find((x) => x.poNo === r.po_no);
    if (rv) return S('received', `RV ${rv.rvNo} dated ${rv.rvDate}${pas[0] ? ` — PA ${pas[0].paNo} ${pas[0].status}` : ''}`);
  }
  const contract = r.contract_id
    ? safe(() => contractsGet('SELECT id, contract_no, status, finalised_at FROM contracts WHERE id = ?', r.contract_id), null)
    : r.po_no
      ? safe(() => contractsGet('SELECT id, contract_no, status, finalised_at FROM contracts WHERE po_no = ? ORDER BY id DESC LIMIT 1', r.po_no), null)
      : null;
  if (contract && contract.status !== 'draft') return S('contracted', `Contract ${contract.contract_no} ${contract.status}${contract.finalised_at ? ` ${contract.finalised_at.slice(0, 10)}` : ''}`);
  if (r.po_no) return S('po_placed', `PO ${r.po_no}${contract ? ` — contract ${contract.contract_no} in draft` : ''}`);
  const poNote = notes.find((n) => n.stage_id === 'po' && n.status === 'approved');
  if (poNote) return S('po_placed', `PO stage (S${poNote.seq}) approved ${poNote.closed_at}`);
  const pp = notes.find((n) => n.stage_id === 'pp' && n.status === 'approved');
  if (pp) return S('pp_approved', `Purchase Proposal (S${pp.seq}) approved ${pp.closed_at}`);
  if (r.tender_no || file?.tendering_start || notes.some((n) => n.stage_id && n.stage_id !== 'provisioning')) {
    return S('tendering', r.tender_no ? `Tender ${r.tender_no}` : `${stageTitle(last?.stage_id)} (S${last?.seq}) ${last?.status}`);
  }
  if (file) return S('provisioning', last ? `${stageTitle(last.stage_id)} (S${last.seq}) ${last.status}` : 'Proposal file opened');
  if (r.checklist_submission_id) return S('checklist_done', `Indentor checklist submission #${r.checklist_submission_id}`);
  return S('registered', `Registered ${r.req_date}`);
}
