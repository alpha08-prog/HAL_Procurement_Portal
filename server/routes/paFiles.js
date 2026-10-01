// Payment-advice document uploads (Module A). Files go through server/storage.js (multer,
// SHA-256) and are recorded on the in-memory PA — so, like every other PA mutation, the
// record resets on restart while the bytes stay under STORAGE_PATH.
//   POST /attachments               multipart {paNo, key, file}  (purchase maker / admin)
//   GET  /attachments?pa=            what is on file for a PA
//   GET  /attachments/download?pa=&key=   stream one file (any signed-in user)
// `key` names the document slot: the five checklist attachments, the four securities, the
// credit note, the CA approval / vendor bank-change request and the SSL intimation letter.
import { Router } from 'express';
import fs from 'node:fs';
import { requireRoles } from '../middleware/requireRoles.js';
import { computeFileHash, upload } from '../storage.js';
import { db, paByNo, rvByNo, todayISO } from '../store.js';

export const PA_FILE_KEYS = {
  rvCopy: { label: 'RV copy', group: 'attachments' },
  invoice: { label: 'Invoice', group: 'attachments' },
  ftr: { label: 'FTR', group: 'attachments' },
  warranty: { label: 'Warranty certificate', group: 'attachments' },
  bankChange: { label: 'Revised bank details', group: 'attachments' },
  security_sd: { label: 'SD copy', group: 'securities', security: 'sd' },
  security_pbg: { label: 'PBG copy', group: 'securities', security: 'pbg' },
  security_emd: { label: 'EMD copy', group: 'securities', security: 'emd' },
  security_indemnity: { label: 'Indemnity bond copy', group: 'securities', security: 'indemnity' },
  creditNote: { label: 'Credit note', group: 'documents' },
  caApproval: { label: 'CA approval (bank change)', group: 'documents' },
  vendorRequest: { label: 'Vendor bank-change request', group: 'documents' },
  ssl: { label: 'Intimation letter (SSL / staggered delivery)', group: 'documents' }
};

const router = Router();
const makerOnly = requireRoles(['purchase_maker', 'admin'], 'Only the Purchase Maker (or admin) may upload payment-advice documents.');

// Public view of what is on file: no storage paths.
export const fileSummary = (pa) =>
  Object.fromEntries(Object.entries(pa?.files ?? {}).map(([k, f]) => [k, { name: f.name, size: f.size, mime: f.mime, sha256: f.sha256, uploadedAt: f.uploadedAt, uploadedBy: f.uploadedBy }]));

export async function recordFile(pa, key, file, user) {
  const meta = {
    name: file.originalname,
    storagePath: file.path,
    size: file.size,
    mime: file.mimetype,
    sha256: await computeFileHash(file.path),
    uploadedAt: todayISO(),
    uploadedBy: user?.name ?? null
  };
  pa.files = { ...(pa.files ?? {}), [key]: meta };
  const spec = PA_FILE_KEYS[key];
  if (spec.group === 'attachments') pa.attachments = { ...(pa.attachments ?? {}), [key]: 'Yes' };
  if (spec.group === 'securities') {
    const s = pa.securities ?? {};
    pa.securities = { ...s, [spec.security]: { ...(s[spec.security] ?? {}), copyEnclosed: 'Yes' } };
  }
  if (key === 'creditNote') {
    pa.creditNoteUploaded = true;
    pa.creditNoteFileName = meta.name;
    const rv = rvByNo(pa.rvNo);
    if (rv) {
      rv.creditNoteUploaded = true;
      rv.creditNoteFileName = meta.name;
    }
  }
  if (key === 'caApproval') {
    pa.caApprovalUploaded = true;
    pa.caApprovalFileName = meta.name;
    pa.caApprovalDate = pa.caApprovalDate ?? meta.uploadedAt;
  }
  if (key === 'vendorRequest') {
    pa.vendorRequestUploaded = true;
    pa.vendorRequestFileName = meta.name;
    pa.vendorRequestDate = pa.vendorRequestDate ?? meta.uploadedAt;
  }
  return meta;
}

router.get('/attachments', (req, res) => {
  const pa = paByNo(req.query.pa);
  if (!pa) return res.status(404).json({ error: `Unknown PA ${req.query.pa}` });
  res.json({ paNo: pa.paNo, files: fileSummary(pa), keys: PA_FILE_KEYS });
});

router.post('/attachments', makerOnly, upload.single('file'), async (req, res) => {
  const pa = paByNo(req.body?.paNo);
  if (!pa) return res.status(404).json({ error: `Unknown PA ${req.body?.paNo}` });
  const key = String(req.body?.key ?? '');
  if (!PA_FILE_KEYS[key]) return res.status(422).json({ error: `key must be one of ${Object.keys(PA_FILE_KEYS).join(', ')}` });
  if (!req.file) return res.status(422).json({ error: 'A file is required' });
  if (!['pa_created', 'rv_pending'].includes(pa.status) && req.user?.role !== 'admin' && PA_FILE_KEYS[key].group !== 'documents') {
    return res.status(409).json({ error: `Checklist attachments and securities are uploaded while the advice is with the maker (status ${pa.status})` });
  }
  try {
    const meta = await recordFile(pa, key, req.file, req.user);
    res.status(201).json({ paNo: pa.paNo, key, file: { ...meta, storagePath: undefined }, files: fileSummary(pa), attachments: pa.attachments, securities: pa.securities });
  } catch (e) {
    res.status(500).json({ error: `Upload failed: ${e.message}` });
  }
});

router.get('/attachments/download', (req, res) => {
  const pa = paByNo(req.query.pa);
  if (!pa) return res.status(404).json({ error: `Unknown PA ${req.query.pa}` });
  const f = pa.files?.[String(req.query.key ?? '')];
  if (!f) return res.status(404).json({ error: 'No file on record for that key' });
  if (!fs.existsSync(f.storagePath)) return res.status(404).json({ error: 'File is missing from storage (uploads are not persisted across restarts of the in-memory store)' });
  res.setHeader('Content-Type', f.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(f.name)}"`);
  fs.createReadStream(f.storagePath).pipe(res);
});

export { db as _db };
export default router;
