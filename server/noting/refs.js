// Connected reference numbers for a note (the email's ask: every note N1..Nn carries
// a unique + linked Reference No, Transaction ID and File ID). Three distinct handles:
//   File ID       AOD/<DEPT>/<YEAR>/<NNNN>     — the parent e-file / case
//   Reference No  <File ID>/N<seq>             — the note within the file (connected)
//   Transaction   TXN-<YEAR>-<NNNNNN>          — globally-unique system handle (share links)
import { all, get } from './db.js';

const pad = (n, w) => String(n).padStart(w, '0');

// Walk up the org tree to the enclosing DEPARTMENT's code (a section may sit under a
// sub-unit, and a division-level member has no department at all — fall back to own code).
export function deptCodeFor(unitId) {
  let unit = unitId && get('SELECT id, kind, code, parent_id FROM org_units WHERE id = ?', unitId);
  if (!unit) return 'IMM';
  const own = unit.code || 'IMM';
  while (unit) {
    if (unit.kind === 'department') return unit.code || 'IMM';
    unit = unit.parent_id && get('SELECT id, kind, code, parent_id FROM org_units WHERE id = ?', unit.parent_id);
  }
  return own;
}

// MAX-of-existing-suffix + 1 (not COUNT(*)): survives deletions and partial reseeds
// without tripping the UNIQUE constraints on file_id / txn_id.
const maxSuffix = (rows, key, prefix) =>
  rows.reduce((m, r) => Math.max(m, Number(r[key].slice(prefix.length)) || 0), 0);

export function nextFileId(deptCode = 'IMM', when = new Date()) {
  const prefix = `AOD/${deptCode}/${when.getFullYear()}/`;
  const rows = all('SELECT file_id FROM files WHERE file_id LIKE ?', prefix + '%');
  return prefix + pad(maxSuffix(rows, 'file_id', prefix) + 1, 4);
}

export const noteRefNo = (fileId, seq) => `${fileId}/N${seq}`;

export function nextTxnId(when = new Date()) {
  const prefix = `TXN-${when.getFullYear()}-`;
  const rows = all('SELECT txn_id FROM notes WHERE txn_id LIKE ?', prefix + '%');
  return prefix + pad(maxSuffix(rows, 'txn_id', prefix) + 1, 6);
}
