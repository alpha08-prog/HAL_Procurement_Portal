// Contract lifecycle core — generate (draft), patch (draft-only), finalise, verify.
// Routes, the seed and the check script all call these; nothing here reads req/res.
// Doctrine: clause bodies + item money are SNAPSHOTTED at generation; the actor is
// always stamped server-side; hashing happens over a canonical stable-key JSON so a
// finalised contract's SHA-256 can be recomputed (and tampering detected) later.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, get, run, nowISO, nowStamp } from './db.js';
import { computeItems } from './money.js';
import { clausesForType } from './matrix.js';
import { nextContractNo } from './refs.js';
import { findPo } from './poSource.js';

const here = dirname(fileURLToPath(import.meta.url));
export const FORMATS = JSON.parse(readFileSync(join(here, 'seed', 'formats.json'), 'utf8'));
export const CLASSIFICATIONS = ['normal', 'restricted', 'confidential', 'secret', 'top_secret'];

const HAL_PARTY = {
  division: 'Hindustan Aeronautics Limited — Aircraft Overhaul Division, Nashik',
  address: 'HAL Nashik Division, Ojhar, Nashik 422207, Maharashtra, India'
};

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function validateExtras(extraClauseIds, autoIds) {
  const ids = [...new Set((extraClauseIds || []).map(Number))].filter((id) => !autoIds.has(id));
  for (const id of ids) if (!get('SELECT id FROM clauses WHERE id = ?', id)) fail(422, `Unknown clause id ${id}`);
  return ids;
}

function validateCustoms(customClauses) {
  const customs = (customClauses || []).map((c) => ({ title: String(c.title || '').trim(), body: String(c.body || '').trim() }));
  if (customs.some((c) => !c.title || !c.body)) fail(422, 'Every additional clause needs a title and text');
  return customs;
}

function validateFormats(formatIds) {
  const ids = [...new Set(formatIds || [])];
  const known = new Map(FORMATS.map((f) => [f.id, f.label]));
  for (const id of ids) if (!known.has(id)) fail(422, `Unknown format "${id}"`);
  return ids.map((id) => ({ id, label: known.get(id) }));
}

export function generateContract(payload, actor) {
  const { tenderNo, poNo, contractTypeId, classification = 'normal', smartContract = false } = payload || {};
  const type = contractTypeId && get('SELECT * FROM contract_types WHERE id = ?', contractTypeId);
  if (!type) fail(422, 'Unknown contract type');
  if (!CLASSIFICATIONS.includes(classification)) fail(422, 'Invalid classification');
  const src = findPo(tenderNo, poNo);
  if (!src) fail(422, 'No PO found for that tender/PO combination');
  const { tender, po, vendor } = src;

  const plan = clausesForType(contractTypeId);
  const autoIds = new Set(plan.auto.map((c) => c.clauseId));
  const extraIds = validateExtras(payload.extraClauseIds, autoIds);
  const customs = validateCustoms(payload.customClauses);
  const formats = validateFormats(payload.formatIds);
  const { lines, totals } = computeItems(po.items);

  const today = nowISO();
  const contractNo = nextContractNo(po.poNo);
  const r = run(
    `INSERT INTO contracts(contract_no,po_no,po_date,tender_no,contract_type_id,description,classification,status,currency,
       basic_value,tax_total,landed_value,hal_division,hal_address,
       vendor_id,vendor_name,vendor_gstin,vendor_address,vendor_contact,
       car_no,cfa_dop_ref,mode_of_tendering,scope_of_work,tech_specs,
       period_from,period_to,validity,
       generated_by_name,generated_by_pb,generated_by_desig,generated_by_dept,generated_by_division,
       smart_contract,created_at)
     VALUES(?,?,?,?,?,?,?, 'draft', 'INR', ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?, ?,?,?,?,?, ?, ?)`,
    contractNo, po.poNo, po.poDate, tender.tenderNo, contractTypeId,
    String(payload.description || po.description).trim(), classification,
    totals.basicValue, totals.taxTotal, totals.landedValue, HAL_PARTY.division, HAL_PARTY.address,
    vendor?.id || null, vendor?.name || null, vendor?.gstin || null, vendor?.address || null, vendor?.contact || null,
    tender.carNo || null, tender.cfaDopRef || null, tender.modeOfTendering || null,
    po.scopeOfWork || null, po.techSpecs || null,
    payload.periodFrom || po.poDate || today, payload.periodTo || null,
    String(payload.validity || '').trim() || '12 months from the date of contract',
    actor?.name || null, actor?.pb || null, actor?.designation || null, actor?.dept || null, actor?.division || null,
    smartContract ? 1 : 0, today
  );
  const contractId = r.lastInsertRowid;

  insertClauses(contractId, plan, extraIds, customs);
  for (const l of lines)
    run(
      `INSERT INTO contract_items(contract_id,line_no,part_no,description,hsn,qty,uom,unit_price,gst_type,gst_pct,tax_amount,line_total)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      contractId, l.lineNo, l.partNo, l.description, l.hsn, l.qty, l.uom, l.unitPrice, l.gstType, l.gstPct, l.taxAmount, l.lineTotal
    );
  for (const f of formats) run('INSERT INTO contract_formats(contract_id,format_id,label) VALUES(?,?,?)', contractId, f.id, f.label);

  return fullContract(contractId);
}

// Standard clauses (auto + user-ticked extras) interleave by matrix clause no; user-written
// customs append at the end under "Additional Clauses". Bodies are snapshots of the library
// AT THIS MOMENT — later amendments never touch them.
function insertClauses(contractId, plan, extraIds, customs) {
  const byId = new Map([...plan.auto, ...plan.offered, ...plan.excluded].map((c) => [c.clauseId, c]));
  const standard = [
    ...plan.auto.map((c) => ({ ...c, source: 'auto' })),
    ...extraIds.map((id) => ({ ...byId.get(id), source: 'extra' }))
  ].sort((a, b) => (a.clauseNo ?? 999) - (b.clauseNo ?? 999) || a.clauseId - b.clauseId);
  let pos = 0;
  for (const c of standard) {
    const row = get('SELECT body, version FROM clauses WHERE id = ?', c.clauseId);
    run(
      `INSERT INTO contract_clauses(contract_id,position,clause_id,clause_no,title,body,clause_version,source,matrix_value)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      contractId, ++pos, c.clauseId, c.clauseNo, c.title, row.body, row.version, c.source, c.matrixValue
    );
  }
  for (const c of customs)
    run(
      `INSERT INTO contract_clauses(contract_id,position,clause_id,clause_no,title,body,clause_version,source,matrix_value)
       VALUES(?,?,NULL,NULL,?,?,NULL,'custom',NULL)`,
      contractId, ++pos, c.title, c.body
    );
}

export function fullContract(id) {
  const contract = get('SELECT * FROM contracts WHERE id = ?', Number(id));
  if (!contract) return null;
  return {
    contract: { ...contract, smart_contract_sim: contract.smart_contract_sim ? JSON.parse(contract.smart_contract_sim) : null },
    clauses: all('SELECT * FROM contract_clauses WHERE contract_id = ? ORDER BY position', contract.id),
    items: all('SELECT * FROM contract_items WHERE contract_id = ? ORDER BY line_no', contract.id),
    formats: all('SELECT format_id, label FROM contract_formats WHERE contract_id = ? ORDER BY id', contract.id),
    typeLabel: get('SELECT label FROM contract_types WHERE id = ?', contract.contract_type_id)?.label || contract.contract_type_id
  };
}

// Draft-only edits. The auto clause set and the PO-derived items are immutable — only the
// user's selections (extras, customs, formats) and header fields can change.
export function patchDraft(contractId, payload, _actor) {
  const contract = get('SELECT * FROM contracts WHERE id = ?', Number(contractId));
  if (!contract) fail(404, 'Contract not found');
  if (contract.status !== 'draft') fail(409, 'Contract is finalised — it can no longer be edited');

  if (payload.classification != null) {
    if (!CLASSIFICATIONS.includes(payload.classification)) fail(422, 'Invalid classification');
    run('UPDATE contracts SET classification = ? WHERE id = ?', payload.classification, contract.id);
  }
  for (const [key, col] of [['description', 'description'], ['validity', 'validity'], ['periodFrom', 'period_from'], ['periodTo', 'period_to']])
    if (payload[key] != null) run(`UPDATE contracts SET ${col} = ? WHERE id = ?`, String(payload[key]).trim() || null, contract.id);
  if (payload.smartContract != null)
    run('UPDATE contracts SET smart_contract = ? WHERE id = ?', payload.smartContract ? 1 : 0, contract.id);

  if (payload.extraClauseIds != null || payload.customClauses != null) {
    const plan = clausesForType(contract.contract_type_id);
    const autoIds = new Set(plan.auto.map((c) => c.clauseId));
    const current = all('SELECT * FROM contract_clauses WHERE contract_id = ? ORDER BY position', contract.id);
    const extraIds = payload.extraClauseIds != null
      ? validateExtras(payload.extraClauseIds, autoIds)
      : current.filter((c) => c.source === 'extra').map((c) => c.clause_id);
    const customs = payload.customClauses != null
      ? validateCustoms(payload.customClauses)
      : current.filter((c) => c.source === 'custom').map((c) => ({ title: c.title, body: c.body }));
    run('DELETE FROM contract_clauses WHERE contract_id = ?', contract.id);
    insertClauses(contract.id, plan, extraIds, customs);
  }
  if (payload.formatIds != null) {
    const formats = validateFormats(payload.formatIds);
    run('DELETE FROM contract_formats WHERE contract_id = ?', contract.id);
    for (const f of formats) run('INSERT INTO contract_formats(contract_id,format_id,label) VALUES(?,?,?)', contract.id, f.id, f.label);
  }
  return fullContract(contract.id);
}

// Canonical content — fixed key order, built only from the stored snapshot, so the hash is
// reproducible for verification and any post-finalise tampering (even via SQL) flips it.
function canonicalContent(doc) {
  const c = doc.contract;
  return JSON.stringify({
    contractNo: c.contract_no,
    type: c.contract_type_id,
    poNo: c.po_no,
    tenderNo: c.tender_no,
    classification: c.classification,
    description: c.description,
    parties: { hal: c.hal_division, vendor: c.vendor_name, vendorGstin: c.vendor_gstin },
    values: { basic: c.basic_value, tax: c.tax_total, landed: c.landed_value, currency: c.currency },
    period: { from: c.period_from, to: c.period_to, validity: c.validity },
    clauses: doc.clauses.map((cl) => ({ no: cl.clause_no, title: cl.title, body: cl.body, source: cl.source })),
    items: doc.items.map((it) => ({ line: it.line_no, part: it.part_no, hsn: it.hsn, qty: it.qty, rate: it.unit_price, tax: it.tax_amount, total: it.line_total })),
    formats: doc.formats.map((f) => f.format_id)
  });
}

export function finaliseContract(contractId, actor) {
  const doc = fullContract(contractId);
  if (!doc) fail(404, 'Contract not found');
  if (doc.contract.status !== 'draft') fail(409, 'Contract is already finalised');

  const hash = sha256(canonicalContent(doc));
  const at = nowStamp();
  const signer = [actor?.name, actor?.pb, actor?.designation].filter(Boolean).join(' / ') || 'HAL Authorised Signatory';
  const qrPayload = JSON.stringify({ v: 1, contract: doc.contract.contract_no, sha256: hash, at, signer });
  const sim = doc.contract.smart_contract
    ? JSON.stringify({
        simulated: true,
        network: 'HAL-DemoChain (SIMULATED — no real blockchain)',
        block: parseInt(hash.slice(0, 6), 16),
        txHash: sha256(hash + at),
        anchoredAt: at
      })
    : null;
  run(
    `UPDATE contracts SET status='finalised', finalised_at=?, finalised_by_name=?, finalised_by_pb=?, finalised_by_desig=?,
       content_hash=?, qr_payload=?, smart_contract_sim=? WHERE id = ?`,
    at, actor?.name || null, actor?.pb || null, actor?.designation || null, hash, qrPayload, sim, doc.contract.id
  );
  return fullContract(doc.contract.id);
}

export function verifyContract(contractId) {
  const doc = fullContract(contractId);
  if (!doc) fail(404, 'Contract not found');
  if (doc.contract.status !== 'finalised') fail(409, 'Only a finalised contract can be verified');
  const recomputed = sha256(canonicalContent(doc));
  return { match: recomputed === doc.contract.content_hash, storedHash: doc.contract.content_hash, recomputedHash: recomputed };
}
