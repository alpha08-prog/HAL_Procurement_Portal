import { Router } from 'express';
import { db, daysSince, vendorById } from '../store.js';

const router = Router();

router.get('/', (req, res) => {
  let rows = db.rvs.map((rv) => {
    const vendor = vendorById(rv.vendorId);
    return {
      ...rv,
      creditNoteRequired: Number(rv.rvValue) < Number(rv.invoiceValue),
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

export default router;
