// Formats library API, mounted gated at /api/formats (server/index.js).
//   GET  /            list (+ counts); ?annex=true|kind=|category=
//   GET  /dop         the DoP-2025 table (ai/dop2025.json) with its pending status
//   GET  /:id         the entry plus a render pre-filled from context (?contractId=&poNo=&rvNo=)
//   POST /:id/render  { fields, contractId?, poNo?, rvNo? } → rendered blocks
// Context is assembled here from the same read-only sources the modules use: the contract
// row (contracts.db), the PO fixture (pos.json + computed totals), the RV fixture, the
// vendor fixture and the signed-in user's directory identity.
import { Router } from 'express';
import { getFormat, list, summary, LIBRARY_NOTE } from '../formats/library.js';
import { render } from '../formats/render.js';
import { dopTable } from '../ai/rules.js';
import { fullContract } from '../contracts/generate.js';
import { findPoByNo } from '../contracts/poSource.js';
import { computeItems } from '../contracts/money.js';
import { contractActor } from '../contracts/identity.js';
import { rvByNo, vendorById } from '../store.js';
import { getRequisition } from '../requisitions/register.js';

const router = Router();
const bool = (v) => v === true || v === 'true' || v === '1';

export function buildCtx(req, q = {}) {
  const ctx = {};
  if (q.contractId != null && q.contractId !== '') {
    const doc = fullContract(q.contractId);
    if (doc) {
      ctx.contract = doc.contract;
      ctx.items = doc.items;
    }
  }
  if (q.requisitionId != null && q.requisitionId !== '') {
    const r = getRequisition(q.requisitionId);
    if (r) ctx.requisition = r;
  }
  const poNo = q.poNo || ctx.contract?.po_no || ctx.requisition?.po_no;
  if (poNo) {
    const po = findPoByNo(poNo);
    if (po) {
      const { totals } = computeItems(po.items);
      ctx.po = {
        ...po,
        basicValue: totals.basicValue,
        taxTotal: totals.taxTotal,
        landedValue: totals.landedValue,
        partNoQty: po.items.map((i) => `${i.partNo} / ${i.qty} ${i.uom}`).join('; ')
      };
    }
  }
  if (q.rvNo) {
    const rv = rvByNo(q.rvNo);
    if (rv) ctx.rv = rv;
  }
  const vendorId = ctx.po?.vendorId || ctx.rv?.vendorId || ctx.contract?.vendor_id;
  if (vendorId) {
    const v = vendorById(vendorId);
    if (v?.id) ctx.vendor = { ...v, namePlace: [v.name, v.city].filter(Boolean).join(', ') };
  }
  try {
    ctx.user = contractActor(req);
  } catch {
    ctx.user = req.user ? { name: req.user.name, pb: req.user.pb } : null;
  }
  return ctx;
}

router.get('/', (req, res) => {
  const q = req.query;
  res.json({
    formats: list({
      contractAnnex: q.annex != null ? bool(q.annex) : undefined,
      kind: q.kind || undefined,
      category: q.category || undefined
    }),
    summary: summary(),
    note: LIBRARY_NOTE
  });
});

// Before /:id so "dop" is never taken for a format id.
router.get('/dop', (_req, res) => res.json(dopTable()));

router.get('/:id', (req, res) => {
  const format = getFormat(req.params.id);
  if (!format) return res.status(404).json({ error: `Unknown format "${req.params.id}"` });
  try {
    res.json({ format, rendered: render(format, {}, buildCtx(req, req.query)) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/render', (req, res) => {
  try {
    const body = req.body || {};
    res.json(render(req.params.id, body.fields || {}, buildCtx(req, body)));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
