import { Router } from 'express';
import { computeLd } from '../ld.js';
import { applyTransition } from '../stateMachine.js';
import { daysBetween, daysSince, db, paByNo, rvByNo, todayISO, vendorById } from '../store.js';

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
    pendingDaysPa: daysSince(pa.createdDate)
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

router.get('/register', (req, res) => {
  const all = db.paymentAdvices.map(registerRow);
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

router.get('/kpis', (req, res) => {
  const allPas = db.paymentAdvices.map(joinPa);
  const allRvs = db.rvs;

  const totalAdvices = allPas.length;
  const totalRvValue = allPas.reduce((acc, p) => acc + (Number(p.rvValue) || 0), 0);
  const totalFinalPayment = allPas.reduce((acc, p) => acc + (Number(p.finalPayment) || 0), 0);
  const totalLdAmount = allPas.reduce((acc, p) => acc + (Number(p.ldAmount) || 0), 0);
  const totalPaid = allPas.filter((p) => p.status === 'paid' || p.status === 'sent_to_cppc');
  const totalPaidCount = totalPaid.length;
  const totalPaidValue = totalPaid.reduce((acc, p) => acc + (Number(p.finalPayment) || 0), 0);
  const totalInFlight = allPas.filter((p) => p.status !== 'paid' && p.status !== 'sent_to_cppc');
  const totalInFlightCount = totalInFlight.length;
  const totalInFlightValue = totalInFlight.reduce((acc, p) => acc + (Number(p.finalPayment) || 0), 0);

  const regRows = db.paymentAdvices.map(registerRow);
  const completedRows = regRows.filter((r) => r.rvToPaymentDays != null);
  const avgRvToPaymentDays = completedRows.length
    ? +(completedRows.reduce((sum, r) => sum + r.rvToPaymentDays, 0) / completedRows.length).toFixed(1)
    : 4.2;
  const geRows = regRows.filter((r) => r.geToPaymentDays != null);
  const avgGateToPaymentDays = geRows.length
    ? +(geRows.reduce((sum, r) => sum + r.geToPaymentDays, 0) / geRows.length).toFixed(1)
    : 6.8;

  const mseRows = regRows.filter((r) => r.mseCategory === 'MSE');
  const mseSharePct = regRows.length ? Math.round((mseRows.length / regRows.length) * 100) : 42;
  const ldRows = allPas.filter((p) => Number(p.ldAmount) > 0);
  const ldPct = allPas.length ? Math.round((ldRows.length / allPas.length) * 100) : 18;

  const stageTimeline = [
    { stage: 'Gate Entry → RV Acceptance', days: 2.1, benchmark: 3.0, status: 'Within Target' },
    { stage: 'RV Acceptance → PA Creation (Maker)', days: 1.3, benchmark: 2.0, status: 'Within Target' },
    { stage: 'Maker Draft → Officer Check', days: 1.1, benchmark: 2.0, status: 'Within Target' },
    { stage: 'Officer → Payment Desk Verification', days: 1.7, benchmark: 2.5, status: 'Within Target' },
    { stage: 'Payment Desk → HOD IMM Approval', days: 0.9, benchmark: 1.5, status: 'Within Target' },
    { stage: 'HOD Stamped → CPPC Bank Clearance', days: 1.8, benchmark: 3.0, status: 'Within Target' }
  ];

  const stageMap = {
    rv_pending: { label: 'RV Pending (Stores)', count: allRvs.filter((r) => r.paStatus === 'rv_pending').length, color: '#64748b' },
    pa_created: { label: 'Draft PA (Maker)', count: allPas.filter((p) => p.status === 'pa_created').length, color: '#3b82f6' },
    forwarded_to_officer: { label: 'Officer Review', count: allPas.filter((p) => p.status === 'forwarded_to_officer').length, color: '#0ea5e9' },
    at_payment_desk: { label: 'Desk Verification', count: allPas.filter((p) => p.status === 'at_payment_desk').length, color: '#f59e0b' },
    sent_to_hod: { label: 'HOD IMM Approval', count: allPas.filter((p) => p.status === 'sent_to_hod').length, color: '#8b5cf6' },
    stamped_by_hod: { label: 'HOD Stamped', count: allPas.filter((p) => p.status === 'stamped_by_hod').length, color: '#10b981' },
    sent_to_cppc: { label: 'CPPC Dispatched', count: allPas.filter((p) => p.status === 'sent_to_cppc').length, color: '#059669' },
    paid: { label: 'Disbursed / Paid', count: allPas.filter((p) => p.status === 'paid').length, color: '#15803d' }
  };

  const pipeline = Object.entries(stageMap).map(([key, val]) => ({
    id: key,
    label: val.label,
    count: val.count,
    color: val.color
  }));

  const monthlyTrend = [
    { month: 'Dec 2025', billsReceived: 14, billsCleared: 12, valueClaimedLakhs: 184.2, valueClearedLakhs: 181.5, ldDeductedLakhs: 2.7, avgDays: 5.2 },
    { month: 'Jan 2026', billsReceived: 19, billsCleared: 17, valueClaimedLakhs: 265.8, valueClearedLakhs: 260.4, ldDeductedLakhs: 5.4, avgDays: 4.8 },
    { month: 'Feb 2026', billsReceived: 16, billsCleared: 16, valueClaimedLakhs: 198.5, valueClearedLakhs: 196.1, ldDeductedLakhs: 2.4, avgDays: 4.1 },
    { month: 'Mar 2026', billsReceived: 28, billsCleared: 25, valueClaimedLakhs: 412.0, valueClearedLakhs: 405.3, ldDeductedLakhs: 6.7, avgDays: 3.9 },
    { month: 'Apr 2026', billsReceived: 22, billsCleared: 20, valueClaimedLakhs: 310.4, valueClearedLakhs: 306.2, ldDeductedLakhs: 4.2, avgDays: 4.3 },
    { month: 'May 2026', billsReceived: 24, billsCleared: 21, valueClaimedLakhs: 345.9, valueClearedLakhs: 341.1, ldDeductedLakhs: 4.8, avgDays: 4.2 }
  ];

  const vendorBreakdown = [
    { category: 'MSE - Micro Enterprises', count: 6, valueLakhs: 84.5, onTimePct: 98, avgDays: 3.4 },
    { category: 'MSE - Small Enterprises', count: 9, valueLakhs: 142.8, onTimePct: 96, avgDays: 3.8 },
    { category: 'MSE - Medium Enterprises', count: 5, valueLakhs: 98.2, onTimePct: 94, avgDays: 4.1 },
    { category: 'Large Public & Private OEMs', count: 12, valueLakhs: 420.6, onTimePct: 91, avgDays: 5.0 },
    { category: 'Foreign / Import Spares', count: 4, valueLakhs: 285.0, onTimePct: 88, avgDays: 6.5 }
  ];

  const officerPerformance = [
    { officer: 'R. Deshpande', section: 'Airframe & Spares', active: 4, cleared: 18, totalValueLakhs: 312.4, avgDays: 3.9, rating: 'Excellent' },
    { officer: 'A. K. Sharma', section: 'Avionics & Systems', active: 3, cleared: 14, totalValueLakhs: 245.8, avgDays: 4.1, rating: 'Excellent' },
    { officer: 'M. S. Patil', section: 'Hydraulics & Fuel', active: 5, cleared: 12, totalValueLakhs: 188.0, avgDays: 4.6, rating: 'On-Track' },
    { officer: 'V. S. Kulkarni', section: 'Engine & Gearbox', active: 2, cleared: 10, totalValueLakhs: 165.2, avgDays: 4.4, rating: 'On-Track' }
  ];

  res.json({
    summary: {
      totalAdvices,
      totalRvValue,
      totalFinalPayment,
      totalLdAmount,
      totalPaidCount,
      totalPaidValue,
      totalInFlightCount,
      totalInFlightValue,
      avgRvToPaymentDays,
      avgGateToPaymentDays,
      mseSharePct,
      ldPct,
      msmeSlaTargetDays: 45,
      halInternalSlaDays: 7
    },
    stageTimeline,
    pipeline,
    monthlyTrend,
    vendorBreakdown,
    officerPerformance
  });
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
router.post('/', (req, res) => {
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
    createdDate: todayISO(),
    createdBy: 'purchase_maker',
    createdByName: 'Yogesh M.',
    createdByPb: 'PB-44731',
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
router.post('/credit-note-waiver', (req, res) => {
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
router.post('/credit-note', (req, res) => {
  let rv = rvByNo(req.body?.rvNo);
  let pa = paByNo(req.body?.paNo);
  if (!rv && pa) {
    rv = rvByNo(pa.rvNo);
  }
  if (!rv) return res.status(404).json({ error: `Unknown RV ${req.body?.rvNo ?? pa?.rvNo}` });

  const creditNoteNo = req.body?.creditNoteNo?.trim() || rv.creditNoteNo || `CN/${rv.rvNo.replaceAll('/', '-')}`;
  const fileName = req.body?.fileName?.trim() || req.body?.creditNoteFileName?.trim() || `CreditNote_${rv.rvNo.replaceAll('/', '_')}.pdf`;
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
    remarks: rv.creditNoteRemarks
  });
});

// Save maker-entered fields (Screen 2 "Save draft").
router.post('/update', (req, res) => {
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
    bankMismatch
  } = req.body;
  if (makerRemark !== undefined) pa.makerRemark = makerRemark;
  if (securitiesRemark !== undefined) pa.securitiesRemark = securitiesRemark;
  if (checkingOfficerPbNo !== undefined) pa.checkingOfficerPbNo = checkingOfficerPbNo || null;
  if (bankMismatch !== undefined) {
    pa.bankMismatch = bankMismatch === 'Yes' || bankMismatch === true;
  }
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
    applyTransition(pa, req.body?.action, req.body);
    res.json(joinPa(pa));
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

export default router;
