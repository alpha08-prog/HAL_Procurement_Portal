// Read-only PO/tender source — the "IFS-fetched" context a contract is generated from.
// Fixture-backed like Module A's rvs/vendors (server/mock/pos.json + vendors.json);
// contracts snapshot everything they need, so fixture edits never mutate old contracts.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(here, '..', 'mock', f), 'utf8'));
const tenders = load('pos.json');
const vendors = new Map(load('vendors.json').map((v) => [v.id, v]));

export const allTenders = () =>
  tenders.map((t) => ({
    tenderNo: t.tenderNo,
    tenderDate: t.tenderDate,
    carNo: t.carNo,
    poCount: t.pos.length,
    description: t.pos.map((p) => p.description).join('; ')
  }));

export const findTender = (tenderNo) =>
  tenders.find((t) => t.tenderNo.toLowerCase() === String(tenderNo || '').trim().toLowerCase()) || null;

export function findPo(tenderNo, poNo) {
  const tender = findTender(tenderNo);
  const po = tender && tender.pos.find((p) => p.poNo === poNo);
  if (!po) return null;
  const vendor = vendors.get(po.vendorId) || null;
  return { tender, po, vendor };
}
