import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { computeLd } from '../ld.js';
import { requireRoles } from '../middleware/requireRoles.js';
import { applyTransition } from '../stateMachine.js';
import { daysBetween, daysSince, db, paByNo, rvByNo, todayISO, vendorById } from '../store.js';
import { findById } from '../auth/users.js';
import { poLinks } from '../requisitions/links.js';
import { paymentDeskKpis } from '../kpis/paymentDesk.js';
import paFilesRouter, { fileSummary, recordFile } from './paFiles.js';
import { upload } from '../storage.js';

// PA creation and draft editing are purchase_maker actions; transition enforcement
// is handled per-action inside the state machine. Admin always passes.
const makerOnly = requireRoles(['purchase_maker', 'admin'], 'Only the Purchase Maker (or admin) may perform this action.');

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
    receiptDate: rv.receiptDate,
    qcDate: rv.qcDate,
    ftrDate: rv.ftrDate,
    chargeApprovalDate: rv.chargeApprovalDate,
    waybillNo: rv.waybillNo,
    waybillDate: rv.waybillDate,
    poNo: pa.poNo,
    poDate: rv.poDate,
    poValue: rv.poValue,
    poOfficer: rv.poOfficer,
    deliveryDueDate: rv.deliveryDueDate,
    description: rv.description,
    gemContractNo: rv.gemContractNo,
    gemContractDate: rv.gemContractDate,
    mprNo: rv.mprNo,
    mprDate: rv.mprDate,
    vendorName: vendor.name ?? 'Unknown vendor',
    vendorCode: vendor.code ?? vendor.id,
    vendorCity: vendor.city ?? '—',
    vendorAddress: vendor.address ?? '—',
    vendorBank: vendor.bank ?? null,
    poBank: pa.poBank ?? vendor.bank ?? { name: 'State Bank of India', accountNo: '30912345678', ifsc: 'SBIN0004321', branch: 'HAL Old Airport Road, Bengaluru' },
    ifsBank: pa.ifsBank ?? vendor.bank ?? { name: 'State Bank of India', accountNo: '30912345678', ifsc: 'SBIN0004321', branch: 'HAL Old Airport Road, Bengaluru' },
    invoiceBank: pa.invoiceBank ?? (pa.bankMismatch ? { name: 'HDFC Bank', accountNo: '998811223344', ifsc: 'HDFC0009999', branch: 'Nariman Point, Mumbai' } : (vendor.bank ?? { name: 'State Bank of India', accountNo: '30912345678', ifsc: 'SBIN0004321', branch: 'HAL Old Airport Road, Bengaluru' })),
    bankMismatch: pa.bankMismatch ?? false,
    bankMismatchResolved: pa.bankMismatchResolved ?? false,
    caApprovalUploaded: pa.caApprovalUploaded ?? false,
    caApprovalFileName: pa.caApprovalFileName ?? null,
    caApprovalDate: pa.caApprovalDate ?? null,
    caApprovalAuthority: pa.caApprovalAuthority ?? null,
    vendorRequestUploaded: pa.vendorRequestUploaded ?? false,
    vendorRequestFileName: pa.vendorRequestFileName ?? null,
    vendorRequestDate: pa.vendorRequestDate ?? null,
    vendorRequestRef: pa.vendorRequestRef ?? null,
    selectedPaymentBank: pa.selectedPaymentBank ?? (pa.bankMismatch ? null : 'po_ifs'),
    bankFootnote: pa.bankFootnote ?? '',
    gstin: vendor.gstin ?? '—',
    mseCategory: vendor.mseCategory ?? 'Non-MSE',
    mseWomen: vendor.mseWomen ?? 'NA',
    refNo: rv.refNo ?? `REF/${rv.rvNo.replaceAll('/', '-')}`,
    ldApplicable: pa.ldApplicable ?? (pa.ldAmount > 0 ? 'Yes' : 'No'),
    ldByGateEntry: pa.ldByGateEntry ?? (pa.ldSupplyAmount > 0 ? 'Yes' : 'No'),
    ldByFtr: pa.ldByFtr ?? (pa.ldIcAmount > 0 ? 'Yes' : 'No'),
    creditNoteUploaded: pa.creditNoteUploaded ?? Boolean(rv.creditNoteUploaded),
    creditNoteNo: pa.creditNoteNo ?? rv.creditNoteNo ?? null,
    creditNoteUploadedDate: pa.creditNoteUploadedDate ?? rv.creditNoteUploadedDate ?? null,
    creditNoteFileName: pa.creditNoteFileName ?? rv.creditNoteFileName ?? null,
    creditNoteRemarks: pa.creditNoteRemarks ?? rv.creditNoteRemarks ?? null,
    creditNoteWaived: pa.creditNoteWaived ?? Boolean(rv.creditNoteWaived),
    creditNoteWaiverReason: pa.creditNoteWaiverReason ?? rv.creditNoteWaiverReason ?? null,
    creditNoteDecisionDate: pa.creditNoteDecisionDate ?? rv.creditNoteDecisionDate ?? null,
    pendingDaysGate: rv.gateEntryDate ? daysSince(rv.gateEntryDate) : null,
    pendingDaysPa: daysSince(pa.createdDate),
    files: fileSummary(pa),
    // Cross-module: the requisition and contract behind this PO (server/requisitions/links.js).
    ...poLinks(pa.poNo)
  };
}

function financialYear(iso) {
  if (!iso) return null;
  const [y, m] = iso.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

const dateReached = (pa, toState) => pa.history?.find((h) => h.to === toState)?.date ?? null;
const TERMINAL_STATES = new Set(['sent_to_cppc', 'paid']);
const between = (from, to) => (from && to ? daysBetween(from, to) : null);
const lastRemark = (pa) => [...(pa.history ?? [])].reverse().find((h) => h.remark)?.remark ?? '';

function registerRow(pa) {
  const rv = rvByNo(pa.rvNo) ?? {};
  const vendor = vendorById(pa.vendorId);
  const forwardedDate = dateReached(pa, 'forwarded_to_officer');
  const clearedDate = dateReached(pa, 'stamped_by_hod');
  const sentDate = dateReached(pa, 'sent_to_cppc');
  const fwdStep = pa.history?.find((h) => h.action === 'officer_forward' || h.action === 'forward_to_officer');
  const forwardedBy = fwdStep?.by ?? (forwardedDate ? 'purchase_officer' : null);
  const forwardedByName = fwdStep?.byName ?? (forwardedDate ? 'R. Deshpande' : null);
  const forwardedByPb = fwdStep?.byPb ?? (forwardedDate ? 'PB-44821' : null);

  return {
    paNo: pa.paNo,
    status: pa.status,
    fy: financialYear(pa.createdDate),
    officer: pa.officer ?? '—',
    vendorCode: vendor.code ?? vendor.id ?? '—',
    vendorName: vendor.name ?? 'Unknown vendor',
    vendorAddress: vendor.address ?? '—',
    mseCategory: vendor.mseCategory ?? 'Non-MSE',
    mseWomen: vendor.mseWomen ?? 'NA',
    mseScSt: vendor.mseScSt ?? 'NA',
    gateEntryNo: rv.gateEntryNo ?? null,
    gateEntryDate: rv.gateEntryDate ?? null,
    waybillNo: rv.waybillNo ?? null,
    waybillDate: rv.waybillDate ?? null,
    receiptDate: rv.receiptDate ?? null,
    ftrDate: rv.ftrDate ?? null,
    qcDate: rv.qcDate ?? null,
    chargeApprovalDate: rv.chargeApprovalDate ?? null,
    rvNo: pa.rvNo,
    rvDate: rv.rvDate ?? null,
    rvValue: pa.rvValue,
    poNo: pa.poNo,
    poDate: rv.poDate ?? null,
    poDescription: rv.description ?? '—',
    poValue: rv.poValue ?? null,
    deliveryDueDate: rv.deliveryDueDate ?? null,
    gemContractNo: rv.gemContractNo ?? null,
    gemContractDate: rv.gemContractDate ?? null,
    mprNo: rv.mprNo ?? null,
    mprDate: rv.mprDate ?? null,
    invoiceNo: pa.invoiceNo ?? null,
    invoiceDate: pa.invoiceDate ?? null,
    invoiceValue: pa.invoiceValue ?? null,
    ldApplicable: pa.ldApplicable ?? (pa.ldAmount > 0 ? 'Yes' : 'No'),
    ldAmount: pa.ldAmount,
    finalPayment: pa.finalPayment,
    createdDate: pa.createdDate,
    forwardedDate,
    pprNo: pa.pprNo ?? null,
    pprDate: pa.pprDate ?? null,
    createdBy: pa.createdBy ?? null,
    createdByName: pa.createdByName ?? null,
    createdByPb: pa.createdByPb ?? null,
    forwardedBy,
    forwardedByName,
    forwardedByPb,
    advisedBy: pa.history?.find((h) => h.action === 'hod_stamp')?.by ?? null,
    remarks: lastRemark(pa),
    advisedFromRvDays: between(rv.rvDate, pa.createdDate),
    processedFromForwardingDays: between(forwardedDate, sentDate),
    rvToPaymentDays: between(rv.rvDate, sentDate),
    geToPaymentDays: between(rv.gateEntryDate, sentDate),
    geToClearedDays: between(rv.gateEntryDate, clearedDate),
    pendingDays: TERMINAL_STATES.has(pa.status) ? null : daysSince(pa.createdDate)
  };
}

function summarise(rows) {
  const withCycle = rows.filter((r) => r.rvToPaymentDays != null);
  const mseCount = rows.filter((r) => r.mseCategory === 'MSE').length;
  return {
    processed: rows.filter((r) => TERMINAL_STATES.has(r.status)).length,
    avgRvToPaymentDays: withCycle.length
      ? Math.round(withCycle.reduce((sum, r) => sum + r.rvToPaymentDays, 0) / withCycle.length)
      : null,
    mseSharePct: rows.length ? Math.round((mseCount / rows.length) * 100) : 0,
    atCppc: rows.filter((r) => r.status === 'sent_to_cppc').length
  };
}

const router = Router();
// Document uploads (real files) — must be mounted before the parameter-less GET '/'.
router.use(paFilesRouter);

router.get('/register', (req, res) => {
  const all = db.paymentAdvices.map((pa) => ({ ...registerRow(pa), ...poLinks(pa.poNo) }));
  const options = {
    fys: [...new Set(all.map((r) => r.fy).filter(Boolean))].sort().reverse(),
    statuses: [...new Set(all.map((r) => r.status))],
    officers: [...new Set(all.map((r) => r.officer).filter((o) => o && o !== '—'))].sort()
  };

  const { fy, status, officer, q } = req.query;
  let rows = all;
  if (fy) rows = rows.filter((r) => r.fy === fy);
  if (status) rows = rows.filter((r) => r.status === status);
  if (officer) rows = rows.filter((r) => r.officer === officer);
  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter((r) =>
      [r.paNo, r.poNo, r.rvNo, r.vendorName].some((v) => String(v).toLowerCase().includes(needle))
    );
  }
  rows = rows.map((r, i) => ({ sl: i + 1, ...r }));

  res.json({ rows, summary: summarise(rows), options });
});

// Payment-desk analytics: every number is computed from the in-memory advices, their history
// dates and the RV/vendor fixtures (server/kpis/paymentDesk.js). ?months= sets the window.
router.get('/kpis', (req, res) => {
  res.json(paymentDeskKpis({ months: req.query.months }));
});

router.get('/history', (req, res) => {
  const pa = paByNo(req.query.pa);
  if (!pa) return res.status(404).json({ error: `Unknown PA ${req.query.pa}` });
  res.json(pa.history ?? []);
});

// List / filter. ?state= (alias ?status=) filters by lifecycle state — accepts a
// single value or a comma-separated set (e.g. the payment desk watches
// at_payment_desk,sent_to_hod,stamped_by_hod,sent_to_cppc,paid in one queue).
// ?pa=<paNo> fetches one
// (as a single-element array — paNo contains slashes, so it travels as a query param).
router.get('/', (req, res) => {
  let rows = db.paymentAdvices;
  if (req.query.pa) rows = rows.filter((p) => p.paNo === req.query.pa);
  const state = req.query.state ?? req.query.status;
  if (state) {
    const wanted = new Set(String(state).split(',').map((s) => s.trim()).filter(Boolean));
    rows = rows.filter((p) => wanted.has(p.status));
  }
  res.json(rows.map(joinPa));
});

// Generate a payment advice from a pending RV (Screen 1 action).
router.post('/', makerOnly, (req, res) => {
  const rv = rvByNo(req.body?.rvNo);
  if (!rv) return res.status(404).json({ error: `Unknown RV ${req.body?.rvNo}` });
  if (rv.paStatus !== 'rv_pending') {
    return res.status(409).json({ error: `${rv.rvNo} already has a payment advice (${rv.paStatus})` });
  }
  // If the accepted RV value is lower than the invoice claim, the credit note is a
  // mandatory supporting document UNLESS explicitly waived by the Purchase Maker.
  const requiresCn = Number(rv.rvValue) < Number(rv.invoiceValue) && !rv.creditNoteWaived && rv.creditNoteRequired !== false;
  if (requiresCn && !rv.creditNoteUploaded) {
    return res.status(422).json({
      error: 'Generate and upload the credit note (or confirm waiver) before creating a payment advice.'
    });
  }

  const pa = {
    paNo: nextPaNo(),
    rvNo: rv.rvNo,
    poNo: rv.poNo,
    vendorId: rv.vendorId,
    status: 'pa_created',
    // A credit note uploaded against the RV before the advice existed travels with it.
    files: rv.files?.creditNote ? { creditNote: rv.files.creditNote } : {},
    createdDate: todayISO(),
    createdBy: req.user?.role ?? 'purchase_maker',
    createdByName: req.user?.name ?? '—',
    createdByPb: findById(req.user?.id)?.pb ?? null,
    officer: rv.poOfficer ? rv.poOfficer.split(' / ')[0] : '—',
    rvValue: rv.rvValue,
    ...computeLd(rv),
    invoiceNo: rv.invoiceNo ?? null,
    invoiceDate: rv.invoiceDate ?? null,
    invoiceValue: rv.invoiceValue ?? null,
    checkingOfficerPbNo: '',
    makerRemark: '',
    securitiesRemark: '',
    pprNo: null,
    pprDate: null,
    creditNoteUploaded: Boolean(rv.creditNoteUploaded),
    creditNoteNo: rv.creditNoteNo ?? null,
    creditNoteWaived: Boolean(rv.creditNoteWaived),
    creditNoteWaiverReason: rv.creditNoteWaiverReason ?? null,
    creditNoteDecisionDate: rv.creditNoteDecisionDate ?? null,
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

// Credit note waiver decision (when purchase maker decides credit note is not required)
router.post('/credit-note-waiver', makerOnly, (req, res) => {
  let rv = rvByNo(req.body?.rvNo);
  let pa = paByNo(req.body?.paNo);
  if (!rv && pa) {
    rv = rvByNo(pa.rvNo);
  }
  if (!rv) return res.status(404).json({ error: `Unknown RV ${req.body?.rvNo ?? pa?.rvNo}` });

  const waiverReason = req.body?.waiverReason?.trim() || req.body?.remarks?.trim() || 'Credit note waived by Purchase Maker for minor difference.';
  const decidedBy = req.body?.decidedBy || 'purchase_maker';
  const decisionDate = req.body?.decisionDate || todayISO();

  rv.creditNoteWaived = true;
  rv.creditNoteRequired = false;
  rv.creditNoteWaiverReason = waiverReason;
  rv.creditNoteDecisionDate = decisionDate;
  rv.creditNoteDecidedBy = decidedBy;

  if (pa) {
    pa.creditNoteWaived = true;
    pa.creditNoteRequired = false;
    pa.creditNoteWaiverReason = waiverReason;
    pa.creditNoteDecisionDate = decisionDate;
    pa.creditNoteDecidedBy = decidedBy;
  }

  res.json({
    rvNo: rv.rvNo,
    paNo: pa?.paNo ?? null,
    creditNoteWaived: true,
    creditNoteRequired: false,
    creditNoteWaiverReason: waiverReason,
    decisionDate,
    decidedBy
  });
});

// Credit note generation/upload gate for an RV whose accepted value is below its
// invoice value. Document storage is represented by the retained document number
// and timestamp in this prototype; the PA route enforces that it exists.
// Credit note: JSON (number + remarks) or multipart with the document itself. With a file the
// bytes are stored (server/storage.js) on the PA when one exists, else on the RV until the
// advice is generated; the name on record is the uploaded file's.
router.post('/credit-note', makerOnly, upload.single('file'), async (req, res) => {
  let rv = rvByNo(req.body?.rvNo);
  let pa = paByNo(req.body?.paNo);
  if (!rv && pa) {
    rv = rvByNo(pa.rvNo);
  }
  if (!rv) return res.status(404).json({ error: `Unknown RV ${req.body?.rvNo ?? pa?.rvNo}` });

  let uploaded = null;
  if (req.file) {
    try {
      uploaded = await recordFile(pa ?? rv, 'creditNote', req.file, req.user);
      if (!pa) rv.files = { ...(rv.files ?? {}), creditNote: uploaded };
    } catch (e) {
      return res.status(500).json({ error: `Upload failed: ${e.message}` });
    }
  }
  const creditNoteNo = req.body?.creditNoteNo?.trim() || rv.creditNoteNo || `CN/${rv.rvNo.replaceAll('/', '-')}`;
  const fileName = uploaded?.name || req.body?.fileName?.trim() || req.body?.creditNoteFileName?.trim() || rv.creditNoteFileName || null;
  const remarks = req.body?.remarks?.trim() || req.body?.creditNoteRemarks?.trim() || 'Credit note uploaded successfully.';
  const uploadedDate = req.body?.uploadedDate || todayISO();

  rv.creditNoteUploaded = true;
  rv.creditNoteWaived = false;
  rv.creditNoteRequired = true;
  rv.creditNoteNo = creditNoteNo;
  rv.creditNoteUploadedDate = uploadedDate;
  rv.creditNoteFileName = fileName;
  rv.creditNoteRemarks = remarks;

  if (pa) {
    pa.creditNoteUploaded = true;
    pa.creditNoteWaived = false;
    pa.creditNoteRequired = true;
    pa.creditNoteNo = creditNoteNo;
    pa.creditNoteUploadedDate = uploadedDate;
    pa.creditNoteFileName = fileName;
    pa.creditNoteRemarks = remarks;
  }

  res.json({
    rvNo: rv.rvNo,
    creditNoteNo: rv.creditNoteNo,
    uploadedDate: rv.creditNoteUploadedDate,
    fileName: rv.creditNoteFileName,
    remarks: rv.creditNoteRemarks,
    fileStored: Boolean(uploaded),
    sha256: uploaded?.sha256 ?? null
  });
});

// Save maker-entered fields (Screen 2 "Save draft").
router.post('/update', makerOnly, (req, res) => {
  const pa = paByNo(req.body?.paNo);
  if (!pa) return res.status(404).json({ error: `Unknown PA ${req.body?.paNo}` });
  if (pa.status !== 'pa_created') {
    return res.status(409).json({ error: `${pa.paNo} is ${pa.status} — maker fields are locked` });
  }

  const {
    makerRemark,
    securitiesRemark,
    ldApplicable,
    ldByGateEntry,
    ldByFtr,
    ldIcAmount,
    checkingOfficerPbNo,
    bankMismatch,
    bankMismatchResolved,
    poBank,
    ifsBank,
    invoiceBank,
    caApprovalUploaded,
    caApprovalFileName,
    caApprovalDate,
    caApprovalAuthority,
    vendorRequestUploaded,
    vendorRequestFileName,
    vendorRequestDate,
    vendorRequestRef,
    selectedPaymentBank,
    bankFootnote
  } = req.body;
  if (makerRemark !== undefined) pa.makerRemark = makerRemark;
  if (securitiesRemark !== undefined) pa.securitiesRemark = securitiesRemark;
  if (checkingOfficerPbNo !== undefined) pa.checkingOfficerPbNo = checkingOfficerPbNo || null;
  if (bankMismatch !== undefined) {
    pa.bankMismatch = bankMismatch === 'Yes' || bankMismatch === true;
  }
  if (bankMismatchResolved !== undefined) {
    pa.bankMismatchResolved = bankMismatchResolved === 'Yes' || bankMismatchResolved === true;
  }
  if (poBank !== undefined) pa.poBank = poBank;
  if (ifsBank !== undefined) pa.ifsBank = ifsBank;
  if (invoiceBank !== undefined) pa.invoiceBank = invoiceBank;
  if (caApprovalUploaded !== undefined) pa.caApprovalUploaded = Boolean(caApprovalUploaded);
  if (caApprovalFileName !== undefined) pa.caApprovalFileName = caApprovalFileName;
  if (caApprovalDate !== undefined) pa.caApprovalDate = caApprovalDate;
  if (caApprovalAuthority !== undefined) pa.caApprovalAuthority = caApprovalAuthority;
  if (vendorRequestUploaded !== undefined) pa.vendorRequestUploaded = Boolean(vendorRequestUploaded);
  if (vendorRequestFileName !== undefined) pa.vendorRequestFileName = vendorRequestFileName;
  if (vendorRequestDate !== undefined) pa.vendorRequestDate = vendorRequestDate;
  if (vendorRequestRef !== undefined) pa.vendorRequestRef = vendorRequestRef;
  if (selectedPaymentBank !== undefined) pa.selectedPaymentBank = selectedPaymentBank;
  if (bankFootnote !== undefined) pa.bankFootnote = bankFootnote;
  if (ldApplicable !== undefined) pa.ldApplicable = ldApplicable === 'Yes' ? 'Yes' : 'No';
  if (ldByGateEntry !== undefined) pa.ldByGateEntry = ldByGateEntry === 'Yes' ? 'Yes' : 'No';
  if (ldByFtr !== undefined) pa.ldByFtr = ldByFtr === 'Yes' ? 'Yes' : 'No';
  if (ldIcAmount !== undefined) {
    const ic = Number(ldIcAmount === '' ? 0 : ldIcAmount);
    if (!Number.isFinite(ic) || ic < 0) {
      return res.status(422).json({ error: 'LD (installation & commissioning) must be a non-negative amount' });
    }
    pa.ldIcAmount = ic;
  }

  // Re-derive LD totals and final payment so the client never does money math.
  const rv = rvByNo(pa.rvNo);
  if (rv)
    Object.assign(
      pa,
      computeLd(rv, {
        ldApplicable: pa.ldApplicable,
        ldByGateEntry: pa.ldByGateEntry,
        ldByFtr: pa.ldByFtr,
        ldIcAmount: pa.ldIcAmount ?? 0
      })
    );
  res.json(joinPa(pa));
});

// All lifecycle moves go through the state machine: {paNo, action, remark?, pprNo?, pprDate?}.
router.post('/transition', (req, res) => {
  const pa = paByNo(req.body?.paNo);
  if (!pa) return res.status(404).json({ error: `Unknown PA ${req.body?.paNo}` });
  try {
    // Pass req.user so the state machine can enforce the per-transition `by` role.
    applyTransition(pa, req.body?.action, { ...req.body, user: req.user });
    res.json(joinPa(pa));
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// PAY-03 LD calculator: the same computeLd() the payment advice uses, on caller-supplied
// inputs. Either dates (delivery due + gate entry) or a bare delay in weeks; the 10% ceiling
// base comes from server/config/ldPolicy.json (capBase 'po' until HAL confirms).
const LD_POLICY = JSON.parse(readFileSync(new URL('../config/ldPolicy.json', import.meta.url), 'utf8'));
router.post('/ld-calc', (req, res) => {
  const b = req.body || {};
  const num = (v) => (v == null || v === '' ? null : Number(v));
  const poValue = num(b.poValue);
  const rvValue = num(b.rvValue) ?? poValue;
  if (!Number.isFinite(poValue ?? rvValue) || (poValue ?? rvValue) <= 0) return res.status(422).json({ error: 'poValue (or rvValue) must be a positive number' });
  let { deliveryDueDate, gateEntryDate } = b;
  const delayWeeks = num(b.delayWeeks);
  if (!deliveryDueDate && delayWeeks != null) {
    if (!Number.isFinite(delayWeeks) || delayWeeks < 0) return res.status(422).json({ error: 'delayWeeks must be >= 0' });
    gateEntryDate = todayISO();
    const d = new Date(`${gateEntryDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - Math.round(delayWeeks * 7));
    deliveryDueDate = d.toISOString().slice(0, 10);
  }
  if (!deliveryDueDate || !gateEntryDate) return res.status(422).json({ error: 'Give deliveryDueDate + gateEntryDate, or delayWeeks' });
  const rv = { deliveryDueDate, gateEntryDate, rvValue: rvValue ?? poValue, poValue: LD_POLICY.capBase === 'rv' ? (rvValue ?? poValue) : (poValue ?? rvValue) };
  const opts = {
    ldIcAmount: num(b.ldIcAmount) ?? 0,
    ldApplicable: b.ldApplicable ?? 'Yes',
    ldByGateEntry: b.ldByGateEntry ?? 'Yes',
    ldByFtr: b.ldByFtr ?? (num(b.ldIcAmount) ? 'Yes' : 'No')
  };
  res.json({
    inputs: { ...rv, ...opts },
    daysLate: Math.max(0, daysBetween(deliveryDueDate, gateEntryDate)),
    policy: { capBase: LD_POLICY.capBase, status: LD_POLICY._status, ratePerWeek: LD_POLICY.ratePerWeek, capPct: LD_POLICY.capPct, reference: LD_POLICY.reference },
    result: computeLd(rv, opts),
    source: 'server/ld.js computeLd() — identical to the payment advice'
  });
});

export default router;
