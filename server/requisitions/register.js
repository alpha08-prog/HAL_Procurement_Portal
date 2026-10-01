// Requisition register core: create / patch / list / get, with the estimate computed by
// estimate.js and the status derived by status.js on every read. Routes, the seed and the
// check script all call these; nothing here reads req/res.
import { all, get, run, nowISO, nowStamp } from './db.js';
import { nextReqNo } from './refs.js';
import { estimate as computeEstimate, BASES } from './estimate.js';
import { deriveStatus } from './status.js';
import { get as notingGet } from '../noting/db.js';
import { get as contractsGet } from '../contracts/db.js';
import { get as aiGet } from '../ai/db.js';
import { findPoByNo } from '../contracts/poSource.js';
import { computeItems } from '../contracts/money.js';

export const KINDS = ['MPR', 'CAR', 'CPR', 'SPR'];
export const TENDERING_TYPES = ['Open (GeM)', 'Limited', 'Single', 'Proprietary', 'Rate contract'];
export const BUDGET_TYPES = ['Capital Budget', 'Revenue Budget'];

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const str = (v) => (v == null ? null : String(v).trim() || null);
const flag = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);
const EDITABLE = [
  'title', 'reference_no', 'req_date', 'item_description', 'part_no', 'quantity', 'uom', 'delivery_period', 'tendering_type',
  'budget_year', 'budget_type', 'budget_head', 'budget_sl', 'tech_specs', 'scope_of_work',
  'proprietary', 'single_tender', 'brand_specific', 'dop_clause', 'dop_level', 'dop_level_source'
];

function event(id, kind, detail, actor) {
  run('INSERT INTO requisition_events(requisition_id, kind, detail, actor, created_at) VALUES(?, ?, ?, ?, ?)', id, kind, detail, actor ?? null, nowStamp());
}

// Estimate inputs → the stored columns. Money is only ever written through estimate.js.
export function estimateColumns(inputs) {
  if (!inputs || inputs.qty == null || inputs.unitRate == null) return null;
  const e = computeEstimate(inputs);
  return {
    estimate_basis: e.basis,
    estimate_inputs: JSON.stringify({ ...e.inputs, basis: e.basis, reference: e.reference }),
    estimate_basic: e.totals.basic,
    estimate_gst: e.totals.gst,
    estimate_total: e.totals.total,
    estimate_words: e.totalWords
  };
}

function safe(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

export function hydrate(r) {
  if (!r) return null;
  const st = deriveStatus(r);
  const notingFile = r.noting_file_pk
    ? safe(() =>
        notingGet(
          `SELECT f.id, f.file_id, f.title, f.status, f.ai_case_id, f.tender_initiator_id,
                  (SELECT txn_id FROM notes WHERE file_pk = f.id ORDER BY seq ASC LIMIT 1) AS first_txn,
                  (SELECT txn_id FROM notes WHERE file_pk = f.id ORDER BY seq DESC LIMIT 1) AS last_txn,
                  (SELECT stage_id FROM notes WHERE file_pk = f.id ORDER BY seq DESC LIMIT 1) AS last_stage,
                  (SELECT status FROM notes WHERE file_pk = f.id ORDER BY seq DESC LIMIT 1) AS last_status,
                  (SELECT COUNT(*) FROM notes WHERE file_pk = f.id) AS note_count
           FROM files f WHERE f.id = ?`,
          r.noting_file_pk
        )
      )
    : null;
  const contract = r.contract_id
    ? safe(() => contractsGet('SELECT id, contract_no, status, landed_value, finalised_at FROM contracts WHERE id = ?', r.contract_id))
    : r.po_no
      ? safe(() => contractsGet('SELECT id, contract_no, status, landed_value, finalised_at FROM contracts WHERE po_no = ? ORDER BY id DESC LIMIT 1', r.po_no))
      : null;
  const po = r.po_no ? findPoByNo(r.po_no) : null;
  const aiCase = r.ai_case_id ? safe(() => aiGet('SELECT id, case_ref, node_id, holding_agency, status FROM ai_cases WHERE id = ?', r.ai_case_id)) : null;
  let estimateInputs = null;
  try {
    estimateInputs = r.estimate_inputs ? JSON.parse(r.estimate_inputs) : null;
  } catch {
    estimateInputs = null;
  }
  return {
    ...r,
    proprietary: Boolean(r.proprietary),
    single_tender: Boolean(r.single_tender),
    brand_specific: Boolean(r.brand_specific),
    estimate_inputs: estimateInputs,
    estimate_basis_label: BASES[r.estimate_basis] ?? r.estimate_basis ?? null,
    quantity_uom: r.quantity != null ? `${r.quantity} ${r.uom ?? ''}`.trim() : null,
    part_no_qty: [r.part_no, r.quantity != null ? `${r.quantity} ${r.uom ?? ''}`.trim() : null].filter(Boolean).join(' / ') || null,
    budget_ref: [r.budget_year, r.budget_type, r.budget_head, r.budget_sl ? `Sl ${r.budget_sl}` : null].filter(Boolean).join(' — ') || null,
    fixture: r.source_case === 'led',
    status: st.status,
    status_label: st.label,
    status_evidence: st.evidence,
    links: {
      notingFile,
      contract,
      po: po ? { poNo: po.poNo, poDate: po.poDate, vendorId: po.vendorId, tenderNo: po.tenderNo, landedValue: computeItems(po.items).totals.landedValue } : null,
      aiCase
    }
  };
}

export const getRequisition = (id) => hydrate(get('SELECT * FROM requisitions WHERE id = ?', Number(id)));

export function listRequisitions({ kind, status } = {}) {
  const rows = kind ? all('SELECT * FROM requisitions WHERE kind = ? ORDER BY req_date DESC, id DESC', String(kind).toUpperCase()) : all('SELECT * FROM requisitions ORDER BY req_date DESC, id DESC');
  const out = rows.map(hydrate);
  return status ? out.filter((r) => r.status === status) : out;
}

export const eventsOf = (id) => all('SELECT * FROM requisition_events WHERE requisition_id = ? ORDER BY id', Number(id));

// The Contract Generator's queue: PP approved (or PO already placed) and no contract on file.
export const ppApprovedForContract = () =>
  listRequisitions().filter((r) => ['pp_approved', 'po_placed'].includes(r.status) && !r.links.contract);

export function createRequisition(input = {}, actor = null) {
  const kind = String(input.kind ?? 'MPR').toUpperCase();
  if (!KINDS.includes(kind)) fail(422, `kind must be one of ${KINDS.join(', ')}`);
  const title = str(input.title);
  if (!title) fail(422, 'title is required');
  if (input.tendering_type != null && input.tendering_type !== '' && !TENDERING_TYPES.includes(input.tendering_type)) fail(422, `tendering_type must be one of ${TENDERING_TYPES.join(', ')}`);
  const reqNo = str(input.req_no) ?? nextReqNo(kind);
  if (get('SELECT id FROM requisitions WHERE req_no = ?', reqNo)) fail(409, `${reqNo} is already registered`);
  const est = estimateColumns(input.estimate) ?? {};
  const today = nowISO();
  const quantity = input.quantity == null || input.quantity === '' ? null : Number(input.quantity);
  if (quantity != null && !(quantity > 0)) fail(422, 'quantity must be a positive number');
  const r = run(
    `INSERT INTO requisitions(req_no, kind, req_date, reference_no, title, item_description, part_no, quantity, uom, delivery_period, tendering_type,
       budget_year, budget_type, budget_head, budget_sl, indentor_member_id, indentor_name, indentor_pb, indentor_dept, indentor_division,
       tech_specs, scope_of_work, proprietary, single_tender, brand_specific,
       estimate_basis, estimate_inputs, estimate_basic, estimate_gst, estimate_total, estimate_words,
       dop_clause, dop_level, dop_level_source, source_case, tender_no, po_no, created_by, created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?,?,?,?)`,
    reqNo, kind, str(input.req_date) ?? today, str(input.reference_no), title, str(input.item_description), str(input.part_no), quantity, str(input.uom),
    str(input.delivery_period), str(input.tendering_type),
    str(input.budget_year), str(input.budget_type), str(input.budget_head), str(input.budget_sl),
    input.indentor_member_id ?? actor?.memberId ?? null, str(input.indentor_name) ?? actor?.name ?? null, str(input.indentor_pb) ?? actor?.pb ?? null,
    str(input.indentor_dept) ?? actor?.dept ?? null, str(input.indentor_division) ?? actor?.division ?? 'Aircraft Overhaul Division, Nashik',
    str(input.tech_specs), str(input.scope_of_work), flag(input.proprietary), flag(input.single_tender), flag(input.brand_specific),
    est.estimate_basis ?? null, est.estimate_inputs ?? null, est.estimate_basic ?? null, est.estimate_gst ?? null, est.estimate_total ?? null, est.estimate_words ?? null,
    str(input.dop_clause), str(input.dop_level), str(input.dop_level_source) ?? (input.dop_level ? 'checklist' : null), str(input.source_case),
    str(input.tender_no), str(input.po_no), actor?.name ?? null, today
  );
  const id = Number(r.lastInsertRowid);
  event(id, 'registered', `${kind} ${reqNo} registered`, actor?.name);
  if (est.estimate_total != null) event(id, 'estimated', `Estimate ₹${est.estimate_total} (${est.estimate_basis})`, actor?.name);
  return getRequisition(id);
}

export function patchRequisition(id, input = {}, actor = null) {
  const row = get('SELECT * FROM requisitions WHERE id = ?', Number(id));
  if (!row) fail(404, 'Requisition not found');
  if (row.noting_file_pk) fail(409, `${row.req_no} already has a proposal file on the noting system — changes now go on the note, not the register`);
  if (input.tendering_type != null && input.tendering_type !== '' && !TENDERING_TYPES.includes(input.tendering_type)) fail(422, `tendering_type must be one of ${TENDERING_TYPES.join(', ')}`);
  const sets = [];
  const vals = [];
  for (const col of EDITABLE) {
    if (!(col in input)) continue;
    let v = input[col];
    if (['proprietary', 'single_tender', 'brand_specific'].includes(col)) v = flag(v);
    else if (col === 'quantity') {
      v = v == null || v === '' ? null : Number(v);
      if (v != null && !(v > 0)) fail(422, 'quantity must be a positive number');
    } else v = str(v);
    if (col === 'title' && !v) fail(422, 'title cannot be empty');
    sets.push(`${col} = ?`);
    vals.push(v);
  }
  const est = estimateColumns(input.estimate);
  if (est) for (const [k, v] of Object.entries(est)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (!sets.length) return getRequisition(row.id);
  run(`UPDATE requisitions SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, ...vals, nowStamp(), row.id);
  event(row.id, est ? 'estimated' : 'updated', est ? `Estimate ₹${est.estimate_total} (${est.estimate_basis})` : `Fields updated: ${sets.map((s) => s.split(' =')[0]).join(', ')}`, actor?.name);
  return getRequisition(row.id);
}

export function setEstimate(id, inputs, actor = null) {
  const row = get('SELECT * FROM requisitions WHERE id = ?', Number(id));
  if (!row) fail(404, 'Requisition not found');
  const est = estimateColumns(inputs);
  if (!est) fail(422, 'qty and unitRate are required');
  run(
    'UPDATE requisitions SET estimate_basis = ?, estimate_inputs = ?, estimate_basic = ?, estimate_gst = ?, estimate_total = ?, estimate_words = ?, updated_at = ? WHERE id = ?',
    est.estimate_basis, est.estimate_inputs, est.estimate_basic, est.estimate_gst, est.estimate_total, est.estimate_words, nowStamp(), row.id
  );
  event(row.id, 'estimated', `Estimate ₹${est.estimate_total} (${est.estimate_basis})`, actor?.name);
  return getRequisition(row.id);
}
