import { Router } from 'express';
import { computeLd } from '../ld.js';
import { applyTransition } from '../stateMachine.js';
import { daysSince, db, paByNo, rvByNo, todayISO, vendorById } from '../store.js';

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
    mseCategory: vendor.mseCategory ?? 'Non-MSE',
    pendingDaysGate: rv.gateEntryDate ? daysSince(rv.gateEntryDate) : null,
    pendingDaysPa: daysSince(pa.createdDate)
  };
}

const router = Router();

// List / filter. ?state= (alias ?status=) filters by lifecycle state; ?pa=<paNo>
// fetches one (as a single-element array — paNo contains slashes, so it travels
// as a query param).
router.get('/', (req, res) => {
  let rows = db.paymentAdvices;
  if (req.query.pa) rows = rows.filter((p) => p.paNo === req.query.pa);
  const state = req.query.state ?? req.query.status;
  if (state) rows = rows.filter((p) => p.status === state);
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
    pprNo: null,
    pprDate: null,
    history: [
      {
        action: 'pa_created',
        from: 'rv_pending',
        to: 'pa_created',
        by: 'purchase_maker',
        date: todayISO(),
        remark: 'Payment advice generated from RV.'
      }
    ]
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

// All lifecycle moves go through the state machine: {paNo, action, remark?, pprNo?, pprDate?}.
router.post('/transition', (req, res) => {
  const pa = paByNo(req.body?.paNo);
  if (!pa) return res.status(404).json({ error: `Unknown PA ${req.body?.paNo}` });
  try {
    applyTransition(pa, req.body?.action, req.body);
    res.json(joinPa(pa));
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

export default router;
