// Connected reference numbers for a note (the email's ask: every note N1..Nn carries
// a unique + linked Reference No, Transaction ID and File ID). Three distinct handles:
//   File ID       AOD/<DEPT>/<YEAR>/<NNNN>     — the parent e-file / case
//   Reference No  <File ID>/N<seq>             — the note within the file (connected)
//   Transaction   TXN-<YEAR>-<NNNNNN>          — globally-unique system handle (share links)
import { get } from './db.js';

const pad = (n, w) => String(n).padStart(w, '0');

export function deptCodeFor(sectionId) {
  const unit = sectionId && get('SELECT id, kind, code, parent_id FROM org_units WHERE id = ?', sectionId);
  if (!unit) return 'IMM';
  if (unit.kind === 'department') return unit.code || 'IMM';
  if (unit.parent_id) return get('SELECT code FROM org_units WHERE id = ?', unit.parent_id)?.code || 'IMM';
  return unit.code || 'IMM';
}

export function nextFileId(deptCode = 'IMM', when = new Date()) {
  const prefix = `AOD/${deptCode}/${when.getFullYear()}/`;
  const c = get('SELECT COUNT(*) AS c FROM files WHERE file_id LIKE ?', prefix + '%').c;
  return prefix + pad(c + 1, 4);
}

export const noteRefNo = (fileId, seq) => `${fileId}/N${seq}`;

export function nextTxnId(when = new Date()) {
  const c = get('SELECT COUNT(*) AS c FROM notes').c;
  return `TXN-${when.getFullYear()}-${pad(c + 1, 6)}`;
}
