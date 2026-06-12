import { Router } from 'express';
import { computeLd } from '../ld.js';
import { db, paByNo, rvByNo, todayISO, vendorById } from '../store.js';

function nextPaNo() {
  const max = db.paymentAdvices
    .map((p) => Number(p.paNo.match(/(\d+)$/)?.[1] ?? 0))
    .reduce((a, b) => Math.max(a, b), 0);
  return `PA/26/${String(max + 1).padStart(3, '0')}`;
}

// Joined view served to the client: PA + the IFS-fetched RV/PO/vendor fields the
// maker form shows read-only.
function joinPa(pa) {
  const rv = rvByNo(pa.rvNo) ?? {};
  const vendor = vendorById(pa.vendorId);
  return {
    ...pa,
    rvDate: rv.rvDate,
    gateEntryNo: rv.gateEntryNo,
    gateEntryDate: rv.gateEntryDate,
    qcDate: rv.qcDate,
    ftrDate: rv.ftrDate,
    poDate: rv.poDate,
    poValue: rv.poValue,
    deliveryDueDate: rv.deliveryDueDate,
    description: rv.description,
    vendorName: vendor.name ?? 'Unknown vendor',
    gstin: vendor.gstin ?? '—',
    mseCategory: vendor.mseCategory ?? 'Non-MSE'
  };
}

const router = Router();

// List / filter. ?status=pa_created filters by state; ?pa=<paNo> fetches one (as a
// single-element array — paNo contains slashes, so it travels as a query param).
router.get('/', (req, res) => {
  let rows = db.paymentAdvices;
  if (req.query.pa) rows = rows.filter((p) => p.paNo === req.query.pa);
  if (req.query.status) rows = rows.filter((p) => p.status === req.query.status);
  res.json(rows.map(joinPa));
});

// Generate a payment advice from a pending RV (Screen 1 action).
router.post('/', (req, res) => {
  const rv = rvByNo(req.body?.rvNo);
  if (!rv) return res.status(404).json({ error: `Unknown RV ${req.body?.rvNo}` });
  if (rv.paStatus !== 'rv_pending') {
    return res.status(409).json({ error: `${rv.rvNo} already has a payment advice (${rv.paStatus})` });
  }

  const pa = {
    paNo: nextPaNo(),
    rvNo: rv.rvNo,
    poNo: rv.poNo,
    vendorId: rv.vendorId,
    status: 'pa_created',
    createdDate: todayISO(),
    createdBy: 'purchase_maker',
    rvValue: rv.rvValue,
    ...computeLd(rv),
    invoiceNo: null,
    invoiceDate: null,
    makerRemark: '',
    remarks: [],
    pprNo: null,
    pprDate: null
  };
  db.paymentAdvices.push(pa);
  rv.paStatus = 'pa_created';
  res.status(201).json(joinPa(pa));
});

// Save maker-entered fields (Screen 2 "Save draft").
router.post('/update', (req, res) => {
  const pa = paByNo(req.body?.paNo);
  if (!pa) return res.status(404).json({ error: `Unknown PA ${req.body?.paNo}` });
  if (pa.status !== 'pa_created') {
    return res.status(409).json({ error: `${pa.paNo} is ${pa.status} — maker fields are locked` });
  }

  const { invoiceNo, invoiceDate, makerRemark, ldIcAmount } = req.body;
  if (invoiceNo !== undefined) pa.invoiceNo = invoiceNo || null;
  if (invoiceDate !== undefined) pa.invoiceDate = invoiceDate || null;
  if (makerRemark !== undefined) pa.makerRemark = makerRemark;
  if (ldIcAmount !== undefined) {
    const ic = Number(ldIcAmount === '' ? 0 : ldIcAmount);
    if (!Number.isFinite(ic) || ic < 0) {
      return res.status(422).json({ error: 'LD (installation & commissioning) must be a non-negative amount' });
    }
    pa.ldIcAmount = ic;
  }

  // Re-derive LD totals and final payment so the client never does money math.
  const rv = rvByNo(pa.rvNo);
  if (rv) Object.assign(pa, computeLd(rv, pa.ldIcAmount ?? 0));
  res.json(joinPa(pa));
});

// Maker forwards to purchase officer: pa_created -> forwarded_to_officer.
router.post('/forward', (req, res) => {
  const pa = paByNo(req.body?.paNo);
  if (!pa) return res.status(404).json({ error: `Unknown PA ${req.body?.paNo}` });
  if (pa.status !== 'pa_created') {
    return res.status(409).json({ error: `${pa.paNo} is ${pa.status} — cannot forward` });
  }
  if (!pa.invoiceNo || !pa.invoiceDate) {
    return res.status(422).json({ error: 'Invoice no and invoice date are required before forwarding' });
  }

  pa.status = 'forwarded_to_officer';
  pa.remarks.push({
    by: 'purchase_maker',
    date: todayISO(),
    text: pa.makerRemark || 'Verified and forwarded to purchase officer.'
  });
  const rv = rvByNo(pa.rvNo);
  if (rv) rv.paStatus = 'forwarded_to_officer';
  res.json(joinPa(pa));
});

export default router;
