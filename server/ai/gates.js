// Hard gates the cascade checks before a note is raised at a node, read from the other
// modules. The responsibility-cascading sheet itself has no conditional logic, so — like the
// advisory rules — a gate can be overridden, but the override is recorded on the note.
//   post_pp  a PO may only follow a Purchase Proposal that was APPROVED on the noting side
//            (Module C) with its internal approval chain RELEASED (Module E).
import { get as notingGet } from '../noting/db.js';
import { loadChain } from '../approvals/store.js';

export function ppApproved(caseRow) {
  if (!caseRow?.noting_file_pk) {
    return { ok: false, why: 'No noting proposal is linked to this case, so no Purchase Proposal approval is on record' };
  }
  const pp = notingGet("SELECT id, ref_no, status, approval_chain_id FROM notes WHERE file_pk = ? AND stage_id = 'pp' ORDER BY seq DESC LIMIT 1", caseRow.noting_file_pk);
  if (!pp) return { ok: false, why: 'The linked proposal has no Purchase Proposal stage file yet' };
  if (pp.status !== 'approved') return { ok: false, why: `Purchase Proposal ${pp.ref_no} is ${pp.status}, not approved` };
  if (pp.approval_chain_id) {
    const c = loadChain(pp.approval_chain_id);
    if (c && !c.released) {
      return { ok: false, why: `Approval chain #${c.id} for ${pp.ref_no} is not released (${(c.releaseBlockedBy ?? []).join('; ') || 'awaiting the CFA'})` };
    }
  }
  return { ok: true, why: null, note: pp.ref_no };
}

export const GATES = { post_pp: ppApproved };
