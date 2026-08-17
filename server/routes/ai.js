// Read-only views of the AI pipeline outputs (ai/outputs/) for the frontend.
// The pipeline (ai/) is never modified here — this route only consumes what it wrote.
import { Router } from 'express';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const router = Router();

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'ai', 'outputs');
const CASE_FULL = path.join(OUT, 'case_full.json');
const PDF_DIR = path.join(OUT, 'pdf');
const PDF_NAME = /^\d{2}_[A-Za-z_]+\.pdf$/;

// Mirror of ai/stages.py (ALL_STAGES + REF) — note title / sequence / annexure-format ids
// per stage. The server can't import the Python module directly.
// Tender Document is prepared directly from Provisioning Checklist + 72 STC clauses without separate note generation.
const STAGE_META = {
  provisioning: { seq: 1, phase: 'PROVISIONING', agency: 'Indenting', title: 'Provisioning Note (N1)', ref: 'Provisioning_Note', formats: ['mpr_car'] },
  emd: { seq: 2, phase: 'TENDERING', agency: 'Tendering', title: 'EMD Stage Acceptance Note (N2)', ref: 'EMD_Stage_Acceptance', formats: [] },
  tec_req: { seq: 3, phase: 'TECHNICAL', agency: 'Tendering', title: 'TEC Request Note', ref: 'TEC_Req', formats: [] },
  tec_report: { seq: 4, phase: 'TECHNICAL', agency: 'Indenting', title: 'TEC Report Note', ref: 'TEC_Report', formats: ['tec_statement'] },
  pbo: { seq: 5, phase: 'COMMERCIAL', agency: 'Tendering', title: 'Price Bid Opening Note', ref: 'PBO_Req', formats: ['tec_statement'] },
  pnc_req: { seq: 6, phase: 'COMMERCIAL', agency: 'Tendering', title: 'PNC Request Note', ref: 'PNC_Req', formats: ['commercial_eval', 'comparative_statement', 'price_justification', 'pnc_agenda'] },
  pnc_rec: { seq: 7, phase: 'COMMERCIAL', agency: 'Tendering', title: 'PNC Recommendation Note', ref: 'PNC_Recc', formats: ['pnc_recommendation'] },
  pp: { seq: 8, phase: 'COMMERCIAL', agency: 'Tendering', title: 'Purchase Proposal Note', ref: 'Purchase_Proposal', formats: ['purchase_proposal'] },
  po: { seq: 9, phase: 'COMMERCIAL', agency: 'Tendering', title: 'Purchase Order + HAL Contract', ref: 'PO_HAL_Contract', formats: ['purchase_order', 'hal_contract'] },
  retender: { seq: 10, phase: 'TENDERING', agency: 'Tendering', title: 'Retender Note', ref: 'Retender_Note', formats: [], needBased: true },
  short_closure: { seq: 11, phase: 'ANY', agency: 'Tendering', title: 'Short Closure Note', ref: 'Short_Closure_Note', formats: [], needBased: true, terminal: true },
  tec_query: { seq: 12, phase: 'TECHNICAL', agency: 'Indenting', title: 'TEC Query Note', ref: 'TEC_Query_Note', formats: [], needBased: true },
  advance_payment: { seq: 13, phase: 'COMMERCIAL', agency: 'Tendering', title: 'Advance Payment Note', ref: 'Advance_Payment_Note', formats: ['advance_payment'], needBased: true },
  po_amendment: { seq: 14, phase: 'COMMERCIAL', agency: 'Tendering', title: 'PO Amendment Note', ref: 'PO_Amendment_Note', formats: [], needBased: true }
};

// Mirror of ai/cascade.py in API-friendly form. This lets the backend expose the new
// responsibility cascade without executing the interactive Python CLI.
const AGENCIES = ['Indenting', 'Tendering'];
const CASCADE_NODES = {
  provisioning: {
    stageNo: 1, owner: 'Indenting', checklist: true, title: 'Provisioning -- raise the indent (N1)',
    description: 'Tender Document is prepared directly from the Provisioning Checklist and Standard Terms & Conditions (72 STC clauses) without separate note generation.',
    options: [{ noteId: 'provisioning', label: 'PROVISIONING NOTE (N1)', next: 'tender_opened' }]
  },
  tender_opened: {
    stageNo: 2, owner: 'Tendering', title: 'Tender floated & opened -- post tender opening scenario (N2)',
    options: [
      { noteId: 'emd', label: 'EMD STAGE ACCEPTANCE NOTE (N2)', next: 'post_emd' },
      { noteId: 'tec_req', label: 'TEC REQ NOTE (N2)', next: 'tec_stage' },
      { noteId: 'retender', label: 'RETENDER NOTE', next: 'post_retender', recommend: 'retender_required' }
    ]
  },
  post_emd: {
    stageNo: 3, owner: 'Tendering', title: 'After EMD stage acceptance',
    options: [
      { noteId: 'tec_req', label: 'TEC REQ NOTE', next: 'tec_stage' },
      { noteId: 'retender', label: 'RETENDER NOTE', next: 'post_retender', recommend: 'retender_required' },
      { noteId: 'short_closure', label: 'SHORT CLOSURE NOTE', next: null }
    ]
  },
  post_retender: {
    stageNo: 2, owner: 'Tendering', title: 'After retender',
    options: [
      { noteId: 'tec_req', label: 'TEC REQ NOTE', next: 'tec_stage' },
      { noteId: 'short_closure', label: 'SHORT CLOSURE NOTE', next: null }
    ]
  },
  tec_stage: {
    stageNo: 3, owner: 'Indenting', title: 'Technical evaluation -- with the TEC / indenting agency',
    options: [
      { noteId: 'tec_query', label: 'TEC QUERY NOTE', next: 'tec_stage' },
      { noteId: 'tec_report', label: 'TEC REPORT NOTE', next: 'post_tec_report' }
    ]
  },
  post_tec_report: {
    stageNo: 4, owner: 'Tendering', title: 'TEC report received -- back with the tendering agency',
    options: [
      { noteId: 'pbo', label: 'PRICE BID OPENING NOTE', next: 'post_pbo' },
      { noteId: 'retender', label: 'RETENDER NOTE', next: 'post_retender', recommend: 'retender_required' },
      { noteId: 'short_closure', label: 'SHORT CLOSURE NOTE', next: null }
    ]
  },
  post_pbo: {
    stageNo: 4, owner: 'Tendering', title: 'Price bids opened -- L1 established',
    options: [
      { noteId: 'pnc_req', label: 'PNC REQ NOTE', next: 'pnc_stage', recommend: 'pnc_required' },
      { noteId: 'pp', label: 'PP NOTE (straight to proposal, no negotiation)', next: 'post_pp' },
      { noteId: 'retender', label: 'RETENDER NOTE', next: 'post_retender', recommend: 'retender_required' },
      { noteId: 'short_closure', label: 'SHORT CLOSURE NOTE', next: null }
    ]
  },
  pnc_stage: {
    stageNo: 5, owner: 'Tendering', title: 'PNC approved -- negotiation held',
    options: [
      { noteId: 'pnc_rec', label: 'PNC RECOMMENDATION', next: 'post_pnc_rec' },
      { noteId: 'retender', label: 'RETENDER NOTE', next: 'post_retender', recommend: 'retender_required' },
      { noteId: 'short_closure', label: 'SHORT CLOSURE NOTE', next: null }
    ]
  },
  post_pnc_rec: {
    stageNo: 6, owner: 'Tendering', title: 'PNC recommendation on file',
    options: [
      { noteId: 'pp', label: 'PP NOTE', next: 'post_pp' },
      { noteId: 'advance_payment', label: 'ADVANCE PAYMENT NOTE', next: 'post_pnc_rec' },
      { noteId: 'short_closure', label: 'SHORT CLOSURE NOTE', next: null }
    ]
  },
  post_pp: {
    stageNo: 7, owner: 'Tendering', title: 'Purchase proposal approved by CFA',
    options: [{ noteId: 'po', label: 'PO + HAL CONTRACT', next: 'post_po' }]
  },
  post_po: {
    stageNo: 8, owner: 'Tendering', title: 'PO / contract placed',
    options: [
      { noteId: 'po_amendment', label: 'PO AMENDMENT NOTE', next: 'post_po' },
      { noteId: 'short_closure', label: 'SHORT CLOSURE NOTE', next: null }
    ]
  }
};

const POST_TENDER_FORMATS = [
  { id: 'tec_statement', title: 'TEC Report', owner: 'Indenting', requiredFor: 'Price Bid Opening, PNC & Purchase Proposal' },
  { id: 'commercial_eval', title: 'Commercial Evaluation Report', owner: 'Tendering', requiredFor: 'PNC & Purchase Proposal' },
  { id: 'comparative_statement', title: 'Comparative Statement', owner: 'Tendering', requiredFor: 'PNC & Purchase Proposal' },
  { id: 'price_justification', title: 'Price Justification Statement', owner: 'Tendering', requiredFor: 'PNC & Purchase Proposal' },
  { id: 'pnc_agenda', title: 'Agenda of Negotiation', owner: 'Tendering', requiredFor: 'PNC Approval & PNC Recommendation' },
  { id: 'pnc_recommendation', title: 'PNC Recommendation', owner: 'Tendering', requiredFor: 'Purchase Proposal' },
  { id: 'purchase_proposal', title: 'Purchase Proposal', owner: 'Tendering', requiredFor: 'Purchase Order / Contract' },
  { id: 'purchase_order', title: 'Purchase Order', owner: 'Tendering', requiredFor: 'Contract / PO Amendment' },
  { id: 'hal_contract', title: 'Contract', owner: 'Tendering', requiredFor: 'PO Amendment' },
  { id: 'advance_payment', title: 'Advance Payment Format', owner: 'Tendering', requiredFor: 'Advance Payment Note / Purchase Proposal' }
];

// full_output parity with ai/case_object.py: carry-forward prose + the stage's new section.
function fullOutput(cf, gen, sid) {
  const carry = cf[sid] || '';
  const section = gen[sid] || '';
  return carry ? `${carry}\n\n${section}`.trim() : section.trim();
}

// Header meta block, mirroring ai/tools/pdf_writer.py:_meta (falsy fields dropped).
function metaOf(d) {
  const m = {
    Item: d.item_description,
    'CAR No.': d.car_no,
    Date: d.car_date,
    'MPR Estimate (INR)': d.mpr_estimate ?? d.budget_estimate ?? d.amount_figures,
    'Tender No.': d.tender_no
  };
  return Object.fromEntries(Object.entries(m).filter(([, v]) => v != null && v !== ''));
}

// Strip the `format` label key out of an annexure dict; keep the rest as fields.
// `formats` is the top-level case_full.json.formats map (NOT case.data).
function annexuresOf(formats, formatIds) {
  return formatIds
    .filter((id) => formats[id])
    .map((id) => {
      const { format, ...fields } = formats[id];
      return { id, format: format || id, fields };
    });
}

function pdfMapByRef() {
  if (!existsSync(PDF_DIR)) return new Map();
  return new Map(
    readdirSync(PDF_DIR)
      .filter((name) => PDF_NAME.test(name))
      .sort()
      .map((name) => [name.replace(/^\d{2}_/, '').replace(/\.pdf$/, ''), name])
  );
}

// GET /api/ai/notes — normalized list of executed notes. Degrades to {exists:false}
// when the pipeline hasn't been run (ai/outputs is gitignored / absent).
router.get('/notes', (req, res) => {
  let data;
  try {
    data = JSON.parse(readFileSync(CASE_FULL, 'utf8'));
  } catch {
    return res.json({ exists: false, item: null, notes: [], skipped: [] });
  }

  const gen = data.generated || {};
  const cf = data.carry_forward || {};
  const meta = metaOf(data.data || {});
  const pdfs = pdfMapByRef();
  const pathWalked = data.path || [];
  const raisedCounts = pathWalked.reduce((acc, sid) => ({ ...acc, [sid]: (acc[sid] || 0) + 1 }), {});
  const uniquePath = [...new Set(pathWalked)];

  const notes = uniquePath
    .map((sid, index) => {
      const sm = STAGE_META[sid];
      if (!sm) return null;
      const full = fullOutput(cf, gen, sid);
      if (!full) return null;
      const pdf = pdfs.get(sm.ref) || `${String(sm.seq).padStart(2, '0')}_${sm.ref}.pdf`;
      return {
        stageId: sid,
        seq: index,
        canonicalSeq: sm.seq,
        title: sm.title,
        phase: sm.phase,
        agency: sm.agency,
        needBased: Boolean(sm.needBased),
        terminal: Boolean(sm.terminal),
        raisedCount: raisedCounts[sid] || 1,
        pdf,
        pdfExists: existsSync(path.join(PDF_DIR, pdf)),
        meta,
        fullOutput: full,
        newSection: (gen[sid] || '').trim(),
        annexures: annexuresOf(data.formats || {}, sm.formats)
      };
    })
    .filter(Boolean);

  res.json({ exists: true, item: data.data?.item_description ?? null, notes, skipped: data.skipped || [] });
});

// GET /api/ai/cascade — responsibility graph and stage metadata from the new AI folder.
router.get('/cascade', (req, res) => {
  res.json({
    start: 'provisioning',
    agencies: AGENCIES,
    stages: STAGE_META,
    nodes: CASCADE_NODES,
    postTenderFormats: POST_TENDER_FORMATS,
    shortClosureMessage: 'Requirement is closed and no more further action on this requisition no.'
  });
});

// GET /api/ai/pdf/:name — stream the original reportlab PDF (pipes shown as plain text there).
router.get('/pdf/:name', (req, res) => {
  const name = path.basename(req.params.name);
  if (!PDF_NAME.test(name)) return res.status(400).json({ error: 'Invalid PDF name' });
  const file = path.join(OUT, 'pdf', name);
  if (!existsSync(file)) return res.status(404).json({ error: 'PDF not found' });
  res.sendFile(file);
});

export default router;
