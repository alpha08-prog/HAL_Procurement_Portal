// Requisition numbers: <KIND>/<YY>/<NNN> (the HAL sample's CAR/25/229 shape). MAX-of-existing-
// suffix + 1 within the kind/year prefix, like the noting connected ids, so reseeds and
// deletions never trip the UNIQUE constraint.
import { all } from './db.js';

const pad = (n, w) => String(n).padStart(w, '0');

export function nextReqNo(kind, when = new Date()) {
  const prefix = `${kind}/${String(when.getFullYear()).slice(-2)}/`;
  const rows = all('SELECT req_no FROM requisitions WHERE req_no LIKE ?', prefix + '%');
  const max = rows.reduce((m, r) => Math.max(m, Number(r.req_no.slice(prefix.length)) || 0), 0);
  return prefix + pad(max + 1, 3);
}
