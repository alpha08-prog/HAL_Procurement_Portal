// The HAL standard-formats library — one seed (seed/formats.json) behind the Portal Hub
// "formats" tools, the contract annexures (Module D) and the Module F annexure names.
// Read-only reference data: no DB, no mutation. Bodies were transcribed once from the
// documents named in each entry's `source`; entries with verified:false have no source in
// the repo and say so in `note`.
import { readFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync(new URL('./seed/formats.json', import.meta.url), 'utf8'));

export const FORMATS = seed.formats;
export const LIBRARY_NOTE = seed._note;
export const KINDS = ['proforma', 'certificate', 'statement', 'form', 'agreement', 'letter', 'reference'];

const byId = new Map(FORMATS.map((f) => [f.id, f]));

export const getFormat = (id) => byId.get(String(id)) ?? null;

export const summaryOf = (f) => ({
  id: f.id,
  code: f.code,
  title: f.title,
  kind: f.kind,
  category: f.category,
  verified: Boolean(f.verified),
  source: f.source ?? null,
  note: f.note ?? null,
  contractAnnex: Boolean(f.contractAnnex),
  cascadeFormatId: f.cascadeFormatId ?? null,
  fieldCount: f.fields.length
});

export function list({ contractAnnex, kind, category, verified } = {}) {
  return FORMATS.filter((f) => {
    if (contractAnnex != null && Boolean(f.contractAnnex) !== contractAnnex) return false;
    if (kind && f.kind !== kind) return false;
    if (category && f.category !== category) return false;
    if (verified != null && Boolean(f.verified) !== verified) return false;
    return true;
  }).map(summaryOf);
}

export function summary() {
  const byKind = {};
  const byCategory = {};
  for (const f of FORMATS) {
    byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
  }
  return {
    total: FORMATS.length,
    verified: FORMATS.filter((f) => f.verified).length,
    pending: FORMATS.filter((f) => !f.verified).length,
    contractAnnex: FORMATS.filter((f) => f.contractAnnex).length,
    byKind,
    byCategory
  };
}
