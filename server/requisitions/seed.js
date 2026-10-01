// Demo seed for the requisition register — one row per requisition the other fixtures already
// name, so the register links to what exists: the NVB CAR (ai/case_input.json → noting file
// AOD/IMM/2026/0001, tender GEM/2025/B/6638737, PO IMM/PO/25-26/0533), the pos.json CARs
// (→ POs, RVs, contracts), the seeded noting proposals, and the fabricated LED fixture.
// Estimates are computed by estimate.js at seed time (PO-backed rows from the PO's own
// lines). Force-reseed: node server/requisitions/seed.js
import { fileURLToPath } from 'node:url';
import { get, run, nowStamp } from './db.js';
import { estimate } from './estimate.js';
import { get as notingGet } from '../noting/db.js';
import { get as contractsGet, run as contractsRun } from '../contracts/db.js';
import { findPoByNo } from '../contracts/poSource.js';
import { computeItems } from '../contracts/money.js';

const IND = { id: 9, name: 'Indent Cell', pb: 'PB-51002', dept: 'Indent Cell (User Dept)', division: 'Aircraft Overhaul Division, Nashik' };
const MAKER = { id: 5, name: 'Asha Mhatre', pb: 'PB-44731', dept: 'IMM — Purchase', division: 'Aircraft Overhaul Division, Nashik' };
const OFFICER = { id: 6, name: 'R. Deshpande', pb: 'PB-44821', dept: 'IMM — Purchase', division: 'Aircraft Overhaul Division, Nashik' };

export const ROWS = [
  {
    req_no: 'CAR/25/229', kind: 'CAR', req_date: '2025-07-17', reference_no: 'KS/1060/NVB/2025/124',
    title: 'Procurement of Night Vision Binocular (NVB)', item_description: 'NIGHT VISION BINOCULAR (passive, Gen-III image intensifier)',
    part_no: 'PEPL-PNVB-01', quantity: 5, uom: 'Nos', delivery_period: '120 days from date of Purchase Order', tendering_type: 'Open (GeM)',
    budget_year: '2025-26', budget_type: 'Capital Budget', budget_head: 'Security & Fire — surveillance equipment', budget_sl: '5843',
    indentor: IND, dop_clause: 'Annexure III B, Sl No 1a', dop_level: '(ANNEXURE 3)(B)(2)', dop_level_source: 'checklist',
    source_case: 'nvb', tender_no: 'GEM/2025/B/6638737', po_no: 'IMM/PO/25-26/0533', noting_file_id: 'AOD/IMM/2026/0001'
  },
  {
    req_no: 'CAR/25/188', kind: 'CAR', req_date: '2025-06-12', reference_no: 'UC/JIG/2025/188',
    title: 'Forged steel brackets & clamp forgings — undercarriage assembly jigs', item_description: 'Forged steel brackets (machined) and clamp forgings, EN-24',
    part_no: 'UC-BRKT-114 / UC-CLMP-118', quantity: 750, uom: 'Nos', delivery_period: '90 days from date of Purchase Order', tendering_type: 'Open (GeM)',
    budget_year: '2025-26', budget_type: 'Revenue Budget', budget_head: 'Jigs & fixtures — undercarriage shop', budget_sl: null,
    indentor: OFFICER, dop_clause: 'Annexure III A, Sl No 1', dop_level: 'Level I', dop_level_source: 'checklist',
    source_case: null, tender_no: 'GEM/2025/B/7104412', po_no: 'IMM/PO/25-26/0512', noting_file_id: null
  },
  {
    req_no: 'CAR/25/144', kind: 'CAR', req_date: '2025-05-20', reference_no: 'ADM/SEAT/2025/144',
    title: 'Ergonomic office seating — assembly shop & design office', item_description: 'Ergonomic task chairs and design-office seating',
    part_no: null, quantity: null, uom: 'Nos', delivery_period: '150 days from date of Purchase Order, phased in two lots', tendering_type: 'Open (GeM)',
    budget_year: '2025-26', budget_type: 'Revenue Budget', budget_head: 'Welfare — furniture', budget_sl: null,
    indentor: MAKER, dop_clause: 'Annexure III B, Sl No 1a', dop_level: 'Level II', dop_level_source: 'checklist',
    source_case: null, tender_no: 'GEM/2025/B/6811205', po_no: 'IMM/PO/25-26/0457', noting_file_id: null
  },
  {
    req_no: 'CAR/25/097', kind: 'CAR', req_date: '2025-04-03', reference_no: 'RM/AL/2025/097',
    title: 'Aluminium alloy raw material — machine shop', item_description: 'Aluminium alloy sheet and bar stock',
    part_no: null, quantity: null, uom: 'kg', delivery_period: '60 days from date of Purchase Order', tendering_type: 'Limited',
    budget_year: '2025-26', budget_type: 'Revenue Budget', budget_head: 'Raw material — machine shop', budget_sl: null,
    indentor: OFFICER, dop_clause: 'Annexure III B, Sl No 1a', dop_level: 'Level II', dop_level_source: 'checklist',
    source_case: null, tender_no: 'IFS/AOD/25-26/RM-044', po_no: 'IMM/PO/25-26/0341', noting_file_id: null
  },
  {
    req_no: 'MPR/26/0412', kind: 'MPR', req_date: '2026-08-14', reference_no: 'HYD/TR/2026/0412',
    title: 'Procurement of hydraulic test rig spares', item_description: 'Hydraulic test rig spares — seals, pressure transducers, hoses',
    part_no: 'HTR-SP-KIT', quantity: 12, uom: 'Sets', delivery_period: '90 days from date of Purchase Order', tendering_type: 'Limited',
    budget_year: '2026-27', budget_type: 'Revenue Budget', budget_head: 'Test facilities — hydraulic', budget_sl: null,
    indentor: IND, dop_clause: 'Annexure III B, Sl No 1a', dop_level: null, dop_level_source: 'pending_bands',
    source_case: null, tender_no: null, po_no: null, noting_file_id: 'AOD/USR/2026/0001',
    estimate: { basis: 'BQ', qty: 12, unitRate: 38500, escalationPct: 0, gstPct: 18, freight: 4500 }
  },
  {
    req_no: 'CAR/26/104', kind: 'CAR', req_date: '2026-06-18', reference_no: 'SEC/COM/2026/104',
    title: 'Procurement of secure communication modules', item_description: 'Secure communication modules for the overhaul hangar network',
    part_no: null, quantity: 4, uom: 'Nos', delivery_period: '120 days from date of Purchase Order', tendering_type: 'Limited',
    budget_year: '2026-27', budget_type: 'Capital Budget', budget_head: 'Security — communications', budget_sl: null,
    indentor: MAKER, dop_clause: 'Annexure III B, Sl No 1a', dop_level: null, dop_level_source: 'pending_bands',
    source_case: null, tender_no: null, po_no: null, noting_file_id: 'AOD/IMM/2026/0005',
    estimate: { basis: 'GEM', qty: 4, unitRate: 415000, escalationPct: 0, gstPct: 18, freight: 0 }
  },
  {
    req_no: 'SPR/26/017', kind: 'SPR', req_date: '2026-06-30', reference_no: 'PRJ/SP/2026/017',
    title: 'Special project procurement (restricted)', item_description: 'Special project equipment — restricted',
    part_no: null, quantity: 1, uom: 'Lot', delivery_period: '180 days from date of Purchase Order', tendering_type: 'Single',
    budget_year: '2026-27', budget_type: 'Capital Budget', budget_head: 'Special projects', budget_sl: null,
    indentor: MAKER, dop_clause: 'Annexure III B, Sl No 3', dop_level: null, dop_level_source: 'pending_bands', single_tender: 1,
    source_case: null, tender_no: null, po_no: null, noting_file_id: 'AOD/IMM/2026/0006',
    estimate: { basis: 'INHOUSE', qty: 1, unitRate: 2450000, escalationPct: 0, gstPct: 18, freight: 0 }
  },
  {
    req_no: 'CAR/26/077', kind: 'CAR', req_date: '2026-05-18', reference_no: 'TLS/KIT/2026/077',
    title: 'Procurement of tool kits — budget review', item_description: 'Aircraft technician tool kits',
    part_no: 'TK-AV-30', quantity: 30, uom: 'Sets', delivery_period: '60 days from date of Purchase Order', tendering_type: 'Open (GeM)',
    budget_year: '2026-27', budget_type: 'Revenue Budget', budget_head: 'Tools — overhaul shops', budget_sl: null,
    indentor: MAKER, dop_clause: 'Annexure III B, Sl No 1a', dop_level: null, dop_level_source: 'pending_bands',
    source_case: null, tender_no: null, po_no: null, noting_file_id: 'AOD/IMM/2026/0007',
    estimate: { basis: 'LPP', qty: 30, unitRate: 18200, escalationPct: 5, gstPct: 18, freight: 2500 }
  },
  {
    req_no: 'CAR/25/301', kind: 'CAR', req_date: '2026-02-24', reference_no: 'HYD/SEAL/2026/301',
    title: 'Procurement of hydraulic seals', item_description: 'Hydraulic seal kits — landing gear actuators',
    part_no: 'HS-LG-200', quantity: 200, uom: 'Nos', delivery_period: '45 days from date of Purchase Order', tendering_type: 'Open (GeM)',
    budget_year: '2025-26', budget_type: 'Revenue Budget', budget_head: 'Consumables — hydraulics', budget_sl: null,
    indentor: MAKER, dop_clause: 'Annexure III B, Sl No 1a', dop_level: 'Level II', dop_level_source: 'checklist',
    source_case: null, tender_no: null, po_no: null, noting_file_id: 'AOD/IMM/2026/0008',
    estimate: { basis: 'LPP', qty: 200, unitRate: 640, escalationPct: 0, gstPct: 18, freight: 0 }
  },
  {
    req_no: 'CAR/26/118', kind: 'CAR', req_date: '2026-05-11', reference_no: 'PM/1989/LED/2026/044',
    title: '250W High Bay LED light fittings (fabricated fixture case E-33046)', item_description: '250W HIGH BAY LED LIGHT FITTING',
    part_no: null, quantity: 2150, uom: 'Nos', delivery_period: '90 days from date of Purchase Order', tendering_type: 'Open (GeM)',
    budget_year: '2026-27', budget_type: 'Revenue Budget', budget_head: 'Plant maintenance — lighting', budget_sl: null,
    indentor: IND, dop_clause: 'Annexure III B, Sl No 1a', dop_level: null, dop_level_source: 'pending_bands',
    source_case: 'led', tender_no: 'GEM/2026/B/7729104', po_no: null, noting_file_id: null,
    estimate: { basis: 'BQ', qty: 2150, unitRate: 4200, escalationPct: 0, gstPct: 18, freight: 0 }
  }
];

// PO-backed rows take their estimate from the PO's own lines (the LPP basis); the rest from
// the inputs above. Either way the figures are estimate.js output, never typed in.
function estimateOf(row) {
  if (row.po_no) {
    const po = findPoByNo(row.po_no);
    if (po) {
      const single = po.items.length === 1 ? po.items[0] : null;
      return estimate(single ? { basis: 'LPP', qty: single.qty, unitRate: single.unitPrice, gstPct: single.gstPct } : { basis: 'LPP', qty: 1, unitRate: computeItems(po.items).totals.basicValue, gstPct: 18 });
    }
  }
  return row.estimate ? estimate(row.estimate) : null;
}

function insertAll() {
  const stamp = nowStamp();
  for (const r of ROWS) {
    const e = estimateOf(r);
    const notingFile = r.noting_file_id ? notingGet('SELECT id, ai_case_id FROM files WHERE file_id = ?', r.noting_file_id) : null;
    const contract = r.po_no ? contractsGet('SELECT id FROM contracts WHERE po_no = ? ORDER BY id LIMIT 1', r.po_no) : null;
    const res = run(
      `INSERT INTO requisitions(req_no, kind, req_date, reference_no, title, item_description, part_no, quantity, uom, delivery_period, tendering_type,
         budget_year, budget_type, budget_head, budget_sl, indentor_member_id, indentor_name, indentor_pb, indentor_dept, indentor_division,
         tech_specs, scope_of_work, proprietary, single_tender, brand_specific,
         estimate_basis, estimate_inputs, estimate_basic, estimate_gst, estimate_total, estimate_words,
         dop_clause, dop_level, dop_level_source, source_case, noting_file_pk, ai_case_id, contract_id, tender_no, po_no, created_by, created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?,?,?)`,
      r.req_no, r.kind, r.req_date, r.reference_no, r.title, r.item_description, r.part_no, r.quantity ?? (r.po_no ? findPoByNo(r.po_no)?.items.reduce((s, i) => s + i.qty, 0) ?? null : null), r.uom,
      r.delivery_period, r.tendering_type,
      r.budget_year, r.budget_type, r.budget_head, r.budget_sl, r.indentor.id, r.indentor.name, r.indentor.pb, r.indentor.dept, r.indentor.division,
      r.po_no ? findPoByNo(r.po_no)?.techSpecs ?? null : null, r.po_no ? findPoByNo(r.po_no)?.scopeOfWork ?? null : null,
      r.proprietary ? 1 : 0, r.single_tender ? 1 : 0, r.brand_specific ? 1 : 0,
      e?.basis ?? null, e ? JSON.stringify({ ...e.inputs, basis: e.basis }) : null, e?.totals.basic ?? null, e?.totals.gst ?? null, e?.totals.total ?? null, e?.totalWords ?? null,
      r.dop_clause, r.dop_level, r.dop_level_source, r.source_case, notingFile?.id ?? null, notingFile?.ai_case_id ?? null, contract?.id ?? null, r.tender_no, r.po_no,
      'seed', stamp
    );
    const id = Number(res.lastInsertRowid);
    // The contracts seed runs before this one, so the contract→requisition pointer is set here.
    if (contract) contractsRun('UPDATE contracts SET requisition_id = ?, noting_file_pk = ?, ai_case_id = ? WHERE id = ?', id, notingFile?.id ?? null, notingFile?.ai_case_id ?? null, contract.id);
    run('INSERT INTO requisition_events(requisition_id, kind, detail, actor, created_at) VALUES(?, ?, ?, ?, ?)', id, 'registered', `${r.kind} ${r.req_no} registered (seed)`, 'seed', r.req_date);
    const linked = [notingFile && `noting_file_pk=${notingFile.id}`, contract && `contract_id=${contract.id}`, r.tender_no && `tender_no=${r.tender_no}`, r.po_no && `po_no=${r.po_no}`].filter(Boolean);
    if (linked.length) run('INSERT INTO requisition_events(requisition_id, kind, detail, actor, created_at) VALUES(?, ?, ?, ?, ?)', id, 'linked', linked.join(', '), 'seed', stamp);
  }
}

export function seedIfEmpty() {
  if (get('SELECT COUNT(*) AS c FROM requisitions').c) return false;
  insertAll();
  return true;
}

export function reseed() {
  run('DELETE FROM requisition_events');
  run('DELETE FROM requisitions');
  insertAll();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  reseed();
  console.log(`Requisition register reseeded: ${get('SELECT COUNT(*) AS c FROM requisitions').c} requisitions.`);
}
