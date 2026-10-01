// E → C. A stage file the DOP requires an internal approval chain for (approvalPolicy.json
// `autoChain`) gets its chain planned the moment the stage file opens, and the noting decision
// on that stage cannot be "approve" until the chain is released — every required position has
// acted, every rider is discharged and the CFA approved (approvals/chain.js releaseReady).
// Rejection on the noting side is never blocked. Chain creation failures never block the note;
// they are logged and the stage simply carries no chain.
import { readFileSync } from 'node:fs';
import { run } from './db.js';
import * as approvals from '../approvals/store.js';

export const POLICY = JSON.parse(readFileSync(new URL('./approvalPolicy.json', import.meta.url), 'utf8'));
export const AUTO_CHAIN = new Set(POLICY.autoChain ?? []);

export const chainFor = (note) => (note?.approval_chain_id ? approvals.loadChain(note.approval_chain_id) : null);

export function ensureChain(note, file, me, user = null) {
  if (!note?.stage_id || !AUTO_CHAIN.has(note.stage_id) || note.approval_chain_id) return null;
  try {
    const c = approvals.createChain({
      noteId: note.stage_id,
      division: POLICY.division,
      dept: POLICY.dept ?? null,
      caseRef: file?.car_no || file?.file_id || note.ref_no,
      originatorPb: me?.pb ?? null,
      fileId: note.ref_no,
      notingNoteId: note.id,
      requisitionId: file?.requisition_id ?? null,
      user: user ?? (me ? { id: me.pb, name: me.name, role: me.app_role } : null)
    });
    run('UPDATE notes SET approval_chain_id = ? WHERE id = ?', c.id, note.id);
    note.approval_chain_id = c.id;
    return c;
  } catch (e) {
    console.warn(`approval chain not created for ${note.ref_no}: ${e.message}`);
    return null;
  }
}

// Why the noting decision cannot be "approve" yet; null when the chain is released or absent.
export function releaseBlock(note) {
  const c = chainFor(note);
  if (!c || c.released) return null;
  return { chainId: c.id, decision: c.decision, why: c.releaseBlockedBy ?? [] };
}

export function chainSummary(note) {
  const c = chainFor(note);
  if (!c) return null;
  return {
    id: c.id,
    label: c.plan?.label ?? null,
    released: c.released,
    decision: c.decision,
    closed: c.closed,
    releaseBlockedBy: c.releaseBlockedBy ?? [],
    next: c.next ?? null,
    hops: c.hops?.length ?? 0,
    unresolved: c.unresolved?.length ?? 0
  };
}
