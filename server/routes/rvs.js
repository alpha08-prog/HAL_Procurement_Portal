import { Router } from 'express';
import { db, daysSince, todayISO, vendorById } from '../store.js';

const router = Router();

router.get('/', (req, res) => {
  let rows = db.rvs.map((rv) => {
    const vendor = vendorById(rv.vendorId);
    const pa = db.paymentAdvices.find((p) => p.rvNo === rv.rvNo);
    const isRvValueLess = Number(rv.rvValue) < Number(rv.invoiceValue);
    const creditNoteWaived = Boolean(rv.creditNoteWaived);
    const creditNoteRequired = !creditNoteWaived && (rv.creditNoteRequired ?? isRvValueLess);
    return {
      ...rv,
      paNo: pa?.paNo ?? null,
      refNo: rv.refNo ?? `REF/${rv.rvNo.replaceAll('/', '-')}`,
      creditNoteRequired,
      creditNoteWaived,
      creditNoteWaiverReason: rv.creditNoteWaiverReason ?? null,
      creditNoteDecisionDate: rv.creditNoteDecisionDate ?? null,
      creditNoteDecidedBy: rv.creditNoteDecidedBy ?? null,
      vendorName: vendor.name ?? 'Unknown vendor',
      mseCategory: vendor.mseCategory ?? 'Non-MSE',
      mseWomen: vendor.mseWomen ?? 'NA',
      mseScSt: vendor.mseScSt ?? 'NA',
      pendingDaysRv: daysSince(rv.rvDate),
      pendingDaysGate: daysSince(rv.gateEntryDate)
    };
  });

  const { status } = req.query;
  if (status === 'pending') {
    rows = rows.filter((r) => r.paStatus !== 'paid');
  } else if (status) {
    rows = rows.filter((r) => r.paStatus === status);
  }

  res.json(rows);
});

// Credit note decision endpoint for RVs
router.post('/credit-note-decision', (req, res) => {
  const rv = db.rvs.find((r) => r.rvNo === req.body?.rvNo);
  if (!rv) return res.status(404).json({ error: `Unknown RV ${req.body?.rvNo}` });

  const required = req.body?.creditNoteRequired === true;
  const waiverReason = req.body?.waiverReason?.trim() || req.body?.remarks?.trim() || 'Credit note waived by Purchase Maker for minor difference.';
  const decidedBy = req.body?.decidedBy || 'purchase_maker';
  const decisionDate = req.body?.decisionDate || todayISO();

  if (!required) {
    rv.creditNoteWaived = true;
    rv.creditNoteRequired = false;
    rv.creditNoteWaiverReason = waiverReason;
    rv.creditNoteDecisionDate = decisionDate;
    rv.creditNoteDecidedBy = decidedBy;
  } else {
    rv.creditNoteWaived = false;
    rv.creditNoteRequired = true;
  }

  const pa = db.paymentAdvices.find((p) => p.rvNo === rv.rvNo);
  if (pa) {
    pa.creditNoteWaived = rv.creditNoteWaived;
    pa.creditNoteRequired = rv.creditNoteRequired;
    pa.creditNoteWaiverReason = rv.creditNoteWaiverReason;
    pa.creditNoteDecisionDate = rv.creditNoteDecisionDate;
    pa.creditNoteDecidedBy = rv.creditNoteDecidedBy;
  }

  res.json({
    rvNo: rv.rvNo,
    creditNoteWaived: rv.creditNoteWaived,
    creditNoteRequired: rv.creditNoteRequired,
    creditNoteWaiverReason: rv.creditNoteWaiverReason,
    decisionDate,
    decidedBy
  });
});

export default router;
