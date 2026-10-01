// The one place that writes cross-module pointers onto a requisition, and the read-only
// lookups other modules use to find their way back. Modules A/C/D/E/F import this; it imports
// nothing from them at module level except their stores, so there is no cycle.
//   link(reqId, { noting_file_pk, ai_case_id, approval_chain_id, checklist_submission_id,
//                 contract_id, tender_no, po_no })   → writes the given pointers + an event
//   requisitionByPo(poNo) / requisitionByReqNo(reqNo) / requisitionForNotingFile(filePk)
//   contractByPo(poNo)                            → contracts.db row (id, contract_no, status)
//   chainForNote(noteId)                          → approvals chain id for a noting note
import { get, run, nowStamp } from './db.js';
import { get as contractsGet } from '../contracts/db.js';
import { get as approvalsGet } from '../approvals/db.js';

export const LINK_COLUMNS = ['noting_file_pk', 'ai_case_id', 'approval_chain_id', 'checklist_submission_id', 'contract_id', 'tender_no', 'po_no'];

export function link(reqId, patch, { actor = null } = {}) {
  const row = get('SELECT * FROM requisitions WHERE id = ?', Number(reqId));
  if (!row) return null;
  const sets = [];
  const vals = [];
  const changed = [];
  for (const col of LINK_COLUMNS) {
    if (!(col in patch) || patch[col] == null || patch[col] === '') continue;
    if (row[col] === patch[col]) continue;
    sets.push(`${col} = ?`);
    vals.push(patch[col]);
    changed.push(`${col}=${patch[col]}`);
  }
  if (!sets.length) return row;
  const stamp = nowStamp();
  run(`UPDATE requisitions SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, ...vals, stamp, row.id);
  run('INSERT INTO requisition_events(requisition_id, kind, detail, actor, created_at) VALUES(?, ?, ?, ?, ?)', row.id, 'linked', changed.join(', '), actor, stamp);
  return get('SELECT * FROM requisitions WHERE id = ?', row.id);
}

export const requisitionByPo = (poNo) => (poNo ? get('SELECT * FROM requisitions WHERE po_no = ? ORDER BY id LIMIT 1', String(poNo)) ?? null : null);
export const requisitionByReqNo = (reqNo) => (reqNo ? get('SELECT * FROM requisitions WHERE req_no = ?', String(reqNo)) ?? null : null);
export const requisitionForNotingFile = (filePk) => (filePk ? get('SELECT * FROM requisitions WHERE noting_file_pk = ?', Number(filePk)) ?? null : null);

// What Module A joins onto an RV / payment advice by PO number.
export function poLinks(poNo) {
  const r = requisitionByPo(poNo);
  const c = contractByPo(poNo);
  return {
    requisitionId: r?.id ?? null,
    requisitionNo: r?.req_no ?? null,
    contractId: c?.id ?? null,
    contractNo: c?.contract_no ?? null,
    contractStatus: c?.status ?? null
  };
}

export function contractByPo(poNo) {
  if (!poNo) return null;
  try {
    return contractsGet('SELECT id, contract_no, status, finalised_at, landed_value FROM contracts WHERE po_no = ? ORDER BY id DESC LIMIT 1', String(poNo)) ?? null;
  } catch {
    return null;
  }
}

export function chainForNote(noteId) {
  if (!noteId) return null;
  try {
    return approvalsGet('SELECT id, status FROM approval_chains WHERE noting_note_id = ? ORDER BY id DESC LIMIT 1', Number(noteId)) ?? null;
  } catch {
    return null;
  }
}
