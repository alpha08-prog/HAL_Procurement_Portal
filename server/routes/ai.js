// Read-only views of the AI pipeline outputs (ai/outputs/) for the frontend.
// The pipeline (ai/) is never modified here — this route only consumes what it wrote.
import { Router } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const router = Router();

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'ai', 'outputs');
const CASE_FULL = path.join(OUT, 'case_full.json');
const PDF_NAME = /^\d{2}_[A-Za-z_]+\.pdf$/;

// Mirror of ai/stages.py (STAGES + REF) — note title / sequence / annexure-format ids
// per stage. The server can't import the Python module; ai/ is frozen, so drift risk is low.
const STAGE_META = {
  provisioning: { seq: 0, title: 'Provisioning Note', ref: 'Provisioning_Note', formats: ['mpr_car'] },
  tender_doc: { seq: 1, title: 'Tender Document', ref: 'Tender_Document', formats: ['sd_format', 'pbg_format'] },
  emd: { seq: 2, title: 'EMD Stage Acceptance Note', ref: 'EMD_Stage_Acceptance', formats: [] },
  tec_req: { seq: 3, title: 'TEC Request Note', ref: 'TEC_Req', formats: [] },
  tec_report: { seq: 4, title: 'TEC Report Note', ref: 'TEC_Report', formats: ['tec_statement'] },
  pbo: { seq: 5, title: 'Price Bid Opening Note', ref: 'PBO_Req', formats: ['tec_statement'] },
  pnc_req: { seq: 6, title: 'PNC Request Note', ref: 'PNC_Req', formats: ['commercial_eval', 'comparative_statement', 'price_justification', 'pnc_agenda'] },
  pnc_rec: { seq: 7, title: 'PNC Recommendation Note', ref: 'PNC_Recc', formats: ['pnc_recommendation'] },
  pp: { seq: 8, title: 'Purchase Proposal Note', ref: 'Purchase_Proposal', formats: ['purchase_proposal'] },
  po: { seq: 9, title: 'Purchase Order + HAL Contract', ref: 'PO_HAL_Contract', formats: ['purchase_order', 'hal_contract'] }
};

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

  const notes = (data.path || [])
    .map((sid) => {
      const sm = STAGE_META[sid];
      if (!sm) return null;
      const full = fullOutput(cf, gen, sid);
      if (!full) return null;
      return {
        stageId: sid,
        seq: sm.seq,
        title: sm.title,
        pdf: `${String(sm.seq).padStart(2, '0')}_${sm.ref}.pdf`,
        meta,
        fullOutput: full,
        newSection: (gen[sid] || '').trim(),
        annexures: annexuresOf(data.formats || {}, sm.formats)
      };
    })
    .filter(Boolean);

  res.json({ exists: true, item: data.data?.item_description ?? null, notes, skipped: data.skipped || [] });
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
