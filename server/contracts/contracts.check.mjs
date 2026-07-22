// Smoke test for Module D contract generation — counterpart to noting.check.mjs.
// Runs against a throwaway DB (CONTRACTS_DB env), so it never touches the dev store.
//   node server/contracts/contracts.check.mjs
import assert from 'node:assert';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CONTRACTS_DB = join(mkdtempSync(join(tmpdir(), 'contracts-')), 'test.db');

// Importing the router tree first proves every contracts route module loads.
await import('../routes/contracts/index.js');
const { reseed } = await import('./seed.js');
reseed();
const { all, get, run } = await import('./db.js');
const { computeItems } = await import('./money.js');
const { classifyCell, clausesForType } = await import('./matrix.js');
const { financialYear, poSerial, nextContractNo } = await import('./refs.js');
const { generateContract, patchDraft, finaliseContract, verifyContract, fullContract, CLASSIFICATIONS } = await import('./generate.js');
const { requireAdmin } = await import('../middleware/requireAdmin.js');

// --- Seed sanity: the client's 72-clause set + 71×8 matrix, verbatim ---
assert.equal(get('SELECT COUNT(*) AS c FROM contract_types').c, 8, '8 contract types');
assert.equal(get('SELECT COUNT(*) AS c FROM clauses').c, 72, '72 clauses');
assert.equal(get('SELECT COUNT(*) AS c FROM clauses WHERE matrix_no IS NOT NULL').c, 71, '71 matrix-mapped clauses');
assert.equal(get('SELECT COUNT(*) AS c FROM clause_matrix').c, 568, '568 matrix cells (71×8)');
const option = get('SELECT * FROM clauses WHERE matrix_no IS NULL');
assert.equal(option.title, 'Option Clause', 'the one unmapped clause is the Option Clause');
assert.equal(option.optional_extra, 1, 'Option Clause is offered regardless of matrix');
assert.equal(get('SELECT title FROM clauses WHERE matrix_no = 28').title, 'Arbitration', 'docx 28/29 swap resolved: matrix 28 = Arbitration');
assert.equal(get('SELECT title FROM clauses WHERE matrix_no = 27').title, 'Obsolescence', 'docx 28/29 swap resolved: matrix 27 = Obsolescence');
assert.deepEqual(CLASSIFICATIONS, ['normal', 'restricted', 'confidential', 'secret', 'top_secret'], '5-level classification incl. restricted');

// --- Money: per-line GST, totals from ROUNDED lines, half-split is combined tax ---
{
  const { lines, totals } = computeItems([
    { partNo: 'A', qty: 3, uom: 'Nos', unitPrice: 100, gstType: 'CGST+SGST', gstPct: 18 },
    { partNo: 'B', qty: 2, uom: 'Nos', unitPrice: 33.335, gstType: 'IGST', gstPct: 18 }
  ]);
  assert.equal(lines[0].taxAmount, 54, 'tax = basic × pct');
  assert.equal(lines[0].lineTotal, 354, 'line total = basic + tax');
  assert.equal(lines[1].basic, 66.67, 'per-line basic rounds half-up');
  assert.equal(lines[1].taxAmount, 12, 'tax computed on the rounded basic');
  assert.equal(totals.basicValue, 366.67, 'basic total sums the rounded lines');
  assert.equal(totals.taxTotal, 66, 'tax total sums the rounded lines');
  assert.equal(totals.landedValue, 432.67, 'landed = basic + tax');
}

// --- Matrix crawl: Y→auto, N→excluded, TBD/conditions→offered, "general clause"→auto ---
assert.equal(classifyCell('Y'), 'auto');
assert.equal(classifyCell('N'), 'excluded');
assert.equal(classifyCell('TBD'), 'offered');
assert.equal(classifyCell('General clause applicable to all types of contracts'), 'auto');
assert.equal(classifyCell('Need to include on case to case basis, as per requirement'), 'offered');
{
  const gp = clausesForType('supply_general');
  const inList = (list, no) => list.some((c) => c.clauseNo === no);
  assert.ok(inList(gp.auto, 1), 'Scope of Work is auto for General Purchases');
  assert.ok(inList(gp.auto, 20), 'Termination ("general clause…") is auto');
  assert.ok(inList(gp.excluded, 3), 'Price Variation is excluded (N) for General Purchases');
  assert.ok(inList(gp.offered, 13), 'EMD (case-to-case) is offered');
  assert.ok(gp.offered.some((c) => c.clauseNo == null), 'Option Clause is offered');
  const lic = clausesForType('licence');
  assert.ok(inList(lic.offered, 4), 'Packing Conditions is TBD → offered for Licence Agreements');
  assert.ok(inList(lic.excluded, 68), 'Right to reject Proposal keeps its explicit N for Licence');
  assert.ok(inList(lic.offered, 68) === false, 'the spanning condition does not override an explicit N');
  for (const t of all('SELECT id FROM contract_types')) {
    const plan = clausesForType(t.id);
    assert.equal(plan.auto.length + plan.offered.length + plan.excluded.length, 72, `every clause classified for ${t.id}`);
    assert.ok(plan.offered.some((c) => c.clauseNo == null), `Option Clause offered for ${t.id}`);
  }
}

// --- Contract numbers: Indian FY + PO serial + MAX+1 ---
assert.equal(financialYear(new Date('2026-01-15')), '25-26', 'January belongs to the prior FY');
assert.equal(financialYear(new Date('2026-04-01')), '26-27', 'April starts the new FY');
assert.equal(poSerial('IMM/PO/25-26/0457'), '0457');
assert.ok(nextContractNo('IMM/PO/25-26/0533').endsWith('/0533/02'), 'suffix = max existing + 1 (seed made /01)');

// --- Generate guards ---
assert.throws(() => generateContract({ tenderNo: 'nope', poNo: 'x', contractTypeId: 'supply_general' }, null), (e) => e.status === 422, 'unknown tender → 422');
assert.throws(() => generateContract({ tenderNo: 'GEM/2025/B/6638737', poNo: 'IMM/PO/25-26/0533', contractTypeId: 'wat' }, null), (e) => e.status === 422, 'unknown type → 422');
assert.throws(
  () => generateContract({ tenderNo: 'GEM/2025/B/6638737', poNo: 'IMM/PO/25-26/0533', contractTypeId: 'supply_other', customClauses: [{ title: 'x', body: '' }] }, null),
  (e) => e.status === 422, 'custom clause without text → 422'
);
assert.throws(
  () => generateContract({ tenderNo: 'GEM/2025/B/6638737', poNo: 'IMM/PO/25-26/0533', contractTypeId: 'supply_other', classification: 'ultra' }, null),
  (e) => e.status === 422, 'invalid classification → 422'
);

// --- The seeded finalised contract: snapshots, hash, QR, smart sim ---
const nvb = fullContract(get(`SELECT id FROM contracts WHERE status = 'finalised'`).id);
assert.equal(nvb.contract.classification, 'restricted', 'seeded NVB contract is restricted');
assert.ok(nvb.contract.contract_no.startsWith('HAL/AOD/CTR/'), 'contract no shape');
assert.ok(nvb.contract.contract_no.includes('/0533/'), 'contract no references the PO serial');
assert.equal(nvb.contract.landed_value, 1594062, 'NVB landed value = 5 × 270180 × 1.18');
const ldSnap = nvb.clauses.find((c) => c.clause_no === 12);
assert.equal(ldSnap.clause_version, 2, 'NVB snapshotted the amended (v2) LD clause');
assert.ok(nvb.clauses.some((c) => c.source === 'extra' && c.clause_no === 13), 'EMD ticked as extra');
assert.ok(nvb.clauses.some((c) => c.source === 'custom'), 'custom clause present');
const positions = nvb.clauses.map((c) => c.position);
assert.deepEqual(positions, positions.map((_, i) => i + 1), 'clause positions are 1..n');
const qr = JSON.parse(nvb.contract.qr_payload);
assert.ok(qr.contract === nvb.contract.contract_no && qr.sha256 === nvb.contract.content_hash && qr.at && qr.signer, 'QR payload carries no/hash/time/signer');
assert.equal(nvb.contract.smart_contract_sim.simulated, true, 'smart-contract anchor is honestly simulated');
assert.equal(verifyContract(nvb.contract.id).match, true, 'stored hash verifies');
assert.throws(() => finaliseContract(nvb.contract.id, null), (e) => e.status === 409, 're-finalise → 409');
assert.throws(() => patchDraft(nvb.contract.id, { description: 'x' }, null), (e) => e.status === 409, 'patch after finalise → 409');

// --- Amendment history + snapshot immutability ---
const ld = get('SELECT * FROM clauses WHERE matrix_no = 12');
assert.equal(ld.version, 2, 'LD clause at v2 after the seeded amendment');
const v1 = get('SELECT * FROM clause_versions WHERE clause_id = ? AND version = 1', ld.id);
assert.ok(v1 && v1.prior_body && v1.reference_doc.includes('LGL/2026/014'), 'v1 history row holds prior text + reference doc');
assert.notEqual(v1.prior_body, ld.body, 'library body moved on');
// amend again (as the route does) — the finalised contract's snapshot must not move
run(
  `INSERT INTO clause_versions(clause_id,version,prior_body,changed_by_name,changed_by_pb,changed_at,change_note,reference_doc)
   VALUES(?,?,?,?,?,?,?,?)`,
  ld.id, ld.version, ld.body, 'Administrator', 'PB-40000', '2026-07-22', 'check-script amendment', 'LGL/2026/099'
);
run(`UPDATE clauses SET body = body || ' AMENDED-AGAIN', version = version + 1 WHERE id = ?`, ld.id);
assert.equal(get('SELECT body FROM contract_clauses WHERE id = ?', ldSnap.id).body, ldSnap.body, 'contract snapshot byte-identical after amendment');
assert.equal(verifyContract(nvb.contract.id).match, true, 'hash still verifies after a library amendment');

// --- Tamper detection ---
run(`UPDATE contract_clauses SET body = body || ' [tampered]' WHERE id = ?`, ldSnap.id);
assert.equal(verifyContract(nvb.contract.id).match, false, 'tampering a stored clause flips verification');
run(`UPDATE contract_clauses SET body = ? WHERE id = ?`, ldSnap.body, ldSnap.id);
assert.equal(verifyContract(nvb.contract.id).match, true, 'restore → verifies again');

// --- Draft lifecycle: patch selections, then finalise ---
const draft = fullContract(get(`SELECT id FROM contracts WHERE status = 'draft'`).id);
assert.equal(draft.contract.po_no, 'IMM/PO/25-26/0457', 'seeded draft is the seating case');
const optionId = get('SELECT id FROM clauses WHERE matrix_no IS NULL').id;
const patched = patchDraft(draft.contract.id, {
  classification: 'confidential',
  extraClauseIds: [optionId],
  customClauses: [{ title: 'Site Housekeeping', body: 'The SUPPLIER shall remove all packing debris from site on each delivery day.' }],
  formatIds: ['sd_bg']
}, null);
assert.equal(patched.contract.classification, 'confidential');
assert.ok(patched.clauses.some((c) => c.source === 'extra' && c.clause_id === optionId), 'Option Clause ticked as extra');
assert.equal(patched.clauses.filter((c) => c.source === 'custom').length, 1, 'custom replaced, not duplicated');
assert.equal(patched.formats.length, 1, 'format set replaced');
assert.equal(patched.contract.landed_value, draft.contract.landed_value, 'patch never touches money');
const auto0 = draft.clauses.filter((c) => c.source === 'auto').map((c) => c.clause_id);
const auto1 = patched.clauses.filter((c) => c.source === 'auto').map((c) => c.clause_id);
assert.deepEqual(auto1, auto0, 'auto clause set is immutable through a patch');
const fin = finaliseContract(draft.contract.id, { name: 'Asha Mhatre', pb: 'PB-44731', designation: 'Purchase Maker' });
assert.ok(fin.contract.content_hash && fin.contract.qr_payload, 'finalise stamps hash + QR');
assert.equal(fin.contract.smart_contract_sim, null, 'no smart anchor unless opted in');
assert.equal(verifyContract(fin.contract.id).match, true);

// --- requireAdmin: real account role only ---
{
  const call = (role) => {
    let out = null;
    requireAdmin({ user: role && { role } }, { status: (s) => ({ json: (b) => (out = { s, b }) }) }, () => (out = { next: true }));
    return out;
  };
  assert.deepEqual(call('admin'), { next: true }, 'admin passes');
  assert.equal(call('purchase_maker').s, 403, 'non-admin → 403');
  assert.equal(call(null).s, 403, 'no user → 403');
}

console.log('contracts.check: all assertions passed');
