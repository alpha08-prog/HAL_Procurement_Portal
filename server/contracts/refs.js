// Contract numbers reference the HAL PO (the client's ask): the PO's serial is embedded.
//   HAL/AOD/CTR/<FY>/<po-serial>/<NN>   e.g. HAL/AOD/CTR/25-26/0457/01
// FY is the Indian financial year (Apr–Mar). NN = MAX(existing suffix)+1 under the same
// prefix (not COUNT — survives deletions/reseeds, same idiom as noting/refs.js).
// Contract nos contain slashes, so API paths use the numeric contracts.id instead.
import { all } from './db.js';

const pad = (n, w) => String(n).padStart(w, '0');

export function financialYear(when = new Date()) {
  const y = when.getMonth() >= 3 ? when.getFullYear() : when.getFullYear() - 1;
  return `${String(y).slice(2)}-${String(y + 1).slice(2)}`;
}

export const poSerial = (poNo) => (poNo.match(/(\d+)\s*$/) || [, '0000'])[1];

export function nextContractNo(poNo, when = new Date()) {
  const prefix = `HAL/AOD/CTR/${financialYear(when)}/${poSerial(poNo)}/`;
  const rows = all('SELECT contract_no FROM contracts WHERE contract_no LIKE ?', prefix + '%');
  const max = rows.reduce((m, r) => Math.max(m, Number(r.contract_no.slice(prefix.length)) || 0), 0);
  return prefix + pad(max + 1, 2);
}
