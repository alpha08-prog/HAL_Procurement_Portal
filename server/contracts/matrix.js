// The "crawl": which STC land in a contract of a given type. Matrix cells are stored
// VERBATIM (Y / N / TBD / free-text condition); this is the single place their meaning
// is decided — client feedback about cell semantics changes classifyCell, not the seed.
//   auto     — included automatically ('Y', or "general clause applicable to all …")
//   offered  — shown as a tickable extra with the verbatim condition text ('TBD', case-to-case …)
//   excluded — 'N' for this type; still tickable (the client wants extras beyond the matrix)
// Option Clause (matrix_no NULL, optional_extra=1) is offered for every type.
import { all } from './db.js';

export function classifyCell(value) {
  if (value === 'Y') return 'auto';
  if (value === 'N') return 'excluded';
  if (/general clause applicable to all|applicable to all types/i.test(value)) return 'auto';
  return 'offered'; // TBD + every case-to-case condition
}

export function clausesForType(typeId) {
  const rows = all(
    `SELECT c.id AS clauseId, c.matrix_no AS clauseNo, c.title, c.boilerplate, c.guideline,
            c.version, m.value AS matrixValue
     FROM clauses c LEFT JOIN clause_matrix m
       ON m.clause_id = c.id AND m.contract_type_id = ?
     ORDER BY c.matrix_no IS NULL, c.matrix_no`,
    typeId
  );
  const plan = { auto: [], offered: [], excluded: [] };
  for (const r of rows) {
    const row = { ...r, boilerplate: !!r.boilerplate };
    if (r.matrixValue == null) plan.offered.push({ ...row, matrixValue: 'Optional clause — include on requirement' });
    else plan[classifyCell(r.matrixValue)].push(row);
  }
  return plan;
}
