// Views of the AI pipeline for the frontend.
//
// Two halves:
//   * read-only — what the Python CLI wrote into ai/outputs/ (notes, PDFs)
//   * interactive — aiCases.js, where signed-in positions walk the cascade in the browser
//     and notes are generated live. Mounted here so everything stays under /api/ai/*.
//
// The cascade graph and stage metadata used to be duplicated in this file; they now come
// from server/ai/cascadeGraph.js so the route that publishes the graph and the walker that
// executes it cannot drift apart.
import { Router } from 'express';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENCIES, CASCADE_NODES, POST_TENDER_FORMATS, SHORT_CLOSURE_MESSAGE, START, STAGE_META
} from '../ai/cascadeGraph.js';
import aiCasesRouter from './aiCases.js';

const router = Router();
router.use(aiCasesRouter);

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'ai', 'outputs');
const CASE_FULL = path.join(OUT, 'case_full.json');
const PDF_DIR = path.join(OUT, 'pdf');
const PDF_NAME = /^\d{2}_[A-Za-z_]+\.pdf$/;

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

// GET /api/ai/cascade — the responsibility graph and stage metadata, straight from
// server/ai/cascadeGraph.js (one copy, shared with the interactive walker).
router.get('/cascade', (req, res) => {
  res.json({
    start: START,
    agencies: AGENCIES,
    stages: STAGE_META,
    nodes: CASCADE_NODES,
    postTenderFormats: POST_TENDER_FORMATS,
    shortClosureMessage: SHORT_CLOSURE_MESSAGE
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
