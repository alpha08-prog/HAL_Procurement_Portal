// Contract lifecycle core — generate (draft), patch (draft-only), finalise, verify.
// Routes, the seed and the check script all call these; nothing here reads req/res.
// Doctrine: clause bodies + item money are SNAPSHOTTED at generation; the actor is
// always stamped server-side; hashing happens over a canonical stable-key JSON so a
// finalised contract's SHA-256 can be recomputed (and tampering detected) later.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { all, get, run, nowISO, nowStamp } from './db.js';
import { get as reqGet } from '../requisitions/db.js';
import { link as linkRequisition, requisitionByPo } from '../requisitions/links.js';
import { computeItems } from './money.js';
import { clausesForType } from './matrix.js';
import { nextContractNo } from './refs.js';
import { findPo } from './poSource.js';
import { getFormat, list as listFormats } from '../formats/library.js';
import { render as renderFormat } from '../formats/render.js';

// Annexable proformas come from the shared formats library (server/formats/seed/formats.json,
// entries flagged contractAnnex). The {id,label} shape is what the picker and the check use.
export function getFormats() {
  return listFormats({ contractAnnex: true }).map((f) => ({ id: f.id, label: f.title, code: f.code, verified: f.verified }));
}
export const FORMATS = getFormats();
export const CLASSIFICATIONS = ['normal', 'restricted', 'confidential', 'secret', 'top_secret'];
export const STATUSES = ['draft', 'finalised', 'released'];

function logEvent(contractId, kind, actor, detail = null) {
  run('INSERT INTO contract_events(contract_id, kind, detail, actor_name, actor_pb, created_at) VALUES(?,?,?,?,?,?)', contractId, kind, detail, actor?.name ?? null, actor?.pb ?? null, nowStamp());
}
export const keySource = () => (process.env.CONTRACT_ENCRYPTION_KEY ? 'env' : 'demo');

const HAL_PARTY = {
  division: 'Hindustan Aeronautics Limited — Aircraft Overhaul Division, Nashik',
  address: 'HAL Nashik Division, Ojhar, Nashik 422207, Maharashtra, India'
};

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function encryptionKey() {
  const configured = process.env.CONTRACT_ENCRYPTION_KEY;
  if (configured) {
    const raw = Buffer.from(configured, /^[0-9a-f]{64}$/i.test(configured) ? 'hex' : 'base64');
    if (raw.length !== 32) fail(500, 'CONTRACT_ENCRYPTION_KEY must decode to 32 bytes');
    return raw;
  }
  return createHash('sha256').update('hal-contract-demo-encryption-key-change-me').digest();
}

function encryptContent(plainText) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return {
    alg: 'AES-256-GCM',
    payload: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64')
  };
}

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
  const formats = getFormats();
  const known = new Map(formats.map((f) => [f.id, f.label]));
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

  // Cross-module pointers: the requisition this PO answers (given, or found by PO no) and,
  // through it, the noting proposal and AI case. The register gets the contract id back.
  const requisition = payload.requisitionId != null && payload.requisitionId !== ''
    ? reqGet('SELECT * FROM requisitions WHERE id = ?', Number(payload.requisitionId))
    : requisitionByPo(po.poNo);
  if (payload.requisitionId != null && payload.requisitionId !== '' && !requisition) fail(422, 'Unknown requisition');
  if (requisition) {
    run('UPDATE contracts SET requisition_id = ?, noting_file_pk = ?, ai_case_id = ? WHERE id = ?', requisition.id, requisition.noting_file_pk ?? null, requisition.ai_case_id ?? null, contractId);
    linkRequisition(requisition.id, { contract_id: Number(contractId), tender_no: tender.tenderNo, po_no: po.poNo }, { actor: actor?.name ?? null });
  }
  logEvent(contractId, 'generated', actor, `${contractNo} generated from PO ${po.poNo} (${contractTypeId}); ${plan.auto.length} auto + ${extraIds.length} extra + ${customs.length} custom clauses, ${formats.length} annex proformas`);

  insertClauses(contractId, plan, extraIds, customs);
  for (const l of lines)
    run(
      `INSERT INTO contract_items(contract_id,line_no,part_no,description,hsn,qty,uom,unit_price,gst_type,gst_pct,tax_amount,line_total)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      contractId, l.lineNo, l.partNo, l.description, l.hsn, l.qty, l.uom, l.unitPrice, l.gstType, l.gstPct, l.taxAmount, l.lineTotal
    );
  snapshotFormats(contractId, formats);

  return fullContract(contractId);
}

// The annex text is SNAPSHOTTED like clause bodies: each chosen proforma is rendered from the
// contract row + PO/vendor fixture at generation/patch time and stored as JSON blocks, so a
// later library edit never rewrites an existing contract's annexures.
function formatCtx(contractId) {
  const contract = get('SELECT * FROM contracts WHERE id = ?', contractId);
  const src = contract && findPo(contract.tender_no, contract.po_no);
  return {
    contract,
    po: src?.po ? { ...src.po, basicValue: contract.basic_value, landedValue: contract.landed_value } : null,
    vendor: src?.vendor ?? null,
    tender: src?.tender ?? null
  };
}

function snapshotFormats(contractId, formats) {
  const ctx = formatCtx(contractId);
  for (const f of formats)
    run('INSERT INTO contract_formats(contract_id,format_id,label,payload) VALUES(?,?,?,?)', contractId, f.id, f.label, JSON.stringify(renderFormat(f.id, {}, ctx)));
}

// Contracts written before payloads existed get their annex rendered on first read and stored.
function parseOrBackfill(row, contractId) {
  if (row.payload) {
    try {
      return JSON.parse(row.payload);
    } catch {
      /* re-render below */
    }
  }
  if (!getFormat(row.format_id)) return null;
  const payload = renderFormat(row.format_id, {}, formatCtx(contractId));
  run('UPDATE contract_formats SET payload = ? WHERE id = ?', JSON.stringify(payload), row.id);
  return payload;
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
    formats: all('SELECT id, format_id, label, payload FROM contract_formats WHERE contract_id = ? ORDER BY id', contract.id).map((f) => ({
      format_id: f.format_id,
      label: f.label,
      payload: parseOrBackfill(f, contract.id)
    })),
    events: all('SELECT id, kind, detail, actor_name, actor_pb, created_at FROM contract_events WHERE contract_id = ? ORDER BY id', contract.id),
    keySource: contract.smart_contract ? keySource() : null,
    typeLabel: get('SELECT label FROM contract_types WHERE id = ?', contract.contract_type_id)?.label || contract.contract_type_id
  };
}

// Draft-only edits. The auto clause set and the PO-derived items are immutable — only the
// user's selections (extras, customs, formats) and header fields can change.
export function patchDraft(contractId, payload, actor) {
  const contract = get('SELECT * FROM contracts WHERE id = ?', Number(contractId));
  if (!contract) fail(404, 'Contract not found');
  if (contract.status !== 'draft') fail(409, 'Contract is finalised — it can no longer be edited');
  const touched = ['classification', 'description', 'validity', 'periodFrom', 'periodTo', 'smartContract', 'extraClauseIds', 'customClauses', 'formatIds'].filter((k) => payload[k] != null);

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
    snapshotFormats(contract.id, formats);
  }
  if (touched.length) logEvent(contract.id, 'patched', actor, `Draft edited: ${touched.join(', ')}`);
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

  const canonical = canonicalContent(doc);
  const hash = sha256(canonical);
  const at = nowStamp();
  const signer = [actor?.name, actor?.pb, actor?.designation].filter(Boolean).join(' / ') || 'HAL Authorised Signatory';
  const encrypted = doc.contract.smart_contract ? encryptContent(canonical) : null;
  const qrPayload = JSON.stringify({
    v: 1,
    contract: doc.contract.contract_no,
    sha256: hash,
    at,
    signer,
    encrypted: !!encrypted,
    alg: encrypted?.alg || null
  });
  const sim = doc.contract.smart_contract
    ? JSON.stringify({
        simulated: true,
        network: 'HAL-DemoChain (SIMULATED — no real blockchain)',
        block: parseInt(hash.slice(0, 6), 16),
        txHash: sha256(hash + at),
        anchoredAt: at,
        encrypted: true,
        encryptionAlg: encrypted.alg
      })
    : null;
  run(
    `UPDATE contracts SET status='finalised', finalised_at=?, finalised_by_name=?, finalised_by_pb=?, finalised_by_desig=?,
       content_hash=?, qr_payload=?, encrypted_payload=?, encryption_iv=?, encryption_tag=?, encryption_alg=?, smart_contract_sim=? WHERE id = ?`,
    at, actor?.name || null, actor?.pb || null, actor?.designation || null, hash, qrPayload,
    encrypted?.payload || null, encrypted?.iv || null, encrypted?.tag || null, encrypted?.alg || null, sim, doc.contract.id
  );
  logEvent(doc.contract.id, 'finalised', actor, `SHA-256 ${hash.slice(0, 16)}… stamped${encrypted ? `; content encrypted (${encrypted.alg}, key: ${keySource()})` : ''}`);
  return fullContract(doc.contract.id);
}

// e-Release of the PO/contract (Portal Hub CON-02). There is no IFS/GeM connector in the
// prototype: release is a recorded, audited state on the finalised contract, optionally with
// the GeM contract number the desk received.
export function releaseContract(contractId, actor, { gemContractNo = null } = {}) {
  const contract = get('SELECT * FROM contracts WHERE id = ?', Number(contractId));
  if (!contract) fail(404, 'Contract not found');
  if (contract.status === 'draft') fail(409, 'Finalise the contract before releasing it');
  if (contract.status === 'released') fail(409, `Already released on ${contract.released_at}`);
  const at = nowStamp();
  run(
    `UPDATE contracts SET status = 'released', released_at = ?, released_by_name = ?, released_by_pb = ?, gem_contract_no = ? WHERE id = ?`,
    at, actor?.name || null, actor?.pb || null, String(gemContractNo || '').trim() || null, contract.id
  );
  logEvent(contract.id, 'released', actor, `Released to IFS (recorded)${gemContractNo ? `; GeM contract ${gemContractNo}` : ''}`);
  return fullContract(contract.id);
}

// Integrity: the canonical content re-hashed and compared, and — when the smart-contract
// simulation is on — the simulated anchor re-derived from that hash. keySource says whether
// the encryption key came from CONTRACT_ENCRYPTION_KEY or the built-in demo key.
export function verifyContract(contractId, actor = null) {
  const doc = fullContract(contractId);
  if (!doc) fail(404, 'Contract not found');
  if (doc.contract.status === 'draft') fail(409, 'Only a finalised contract can be verified');
  const recomputed = sha256(canonicalContent(doc));
  const match = recomputed === doc.contract.content_hash;
  const sim = doc.contract.smart_contract_sim;
  const anchorMatch = sim ? sha256(doc.contract.content_hash + doc.contract.finalised_at) === sim.txHash : null;
  if (actor) logEvent(doc.contract.id, 'verified', actor, match ? 'Integrity verified' : 'INTEGRITY FAILURE — stored content differs from the finalisation hash');
  return {
    match,
    storedHash: doc.contract.content_hash,
    recomputedHash: recomputed,
    anchorMatch,
    simulated: sim ? true : null,
    encrypted: Boolean(doc.contract.encrypted_payload),
    keySource: doc.contract.encrypted_payload ? keySource() : null,
    status: doc.contract.status
  };
}

// Decrypt the stored canonical content (admin-only route) — proves the AES-256-GCM round
// trip and lets an auditor read exactly what was hashed. Never returns the key.
export function decryptContent(contractId) {
  const c = get('SELECT * FROM contracts WHERE id = ?', Number(contractId));
  if (!c) fail(404, 'Contract not found');
  if (!c.encrypted_payload) fail(409, 'This contract was not finalised in smart-contract mode — nothing is encrypted');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(c.encryption_iv, 'base64'));
  decipher.setAuthTag(Buffer.from(c.encryption_tag, 'base64'));
  let plain;
  try {
    plain = Buffer.concat([decipher.update(Buffer.from(c.encrypted_payload, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    fail(409, 'Decryption failed — the stored ciphertext or the configured key has changed since finalisation');
  }
  return { alg: c.encryption_alg, keySource: keySource(), sha256: sha256(plain), matchesStoredHash: sha256(plain) === c.content_hash, canonical: JSON.parse(plain) };
}
