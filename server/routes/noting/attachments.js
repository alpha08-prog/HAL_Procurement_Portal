// Phase 5 — typed attachments with per-type permissions and real binary file uploads:
//   doc      reference/supporting files  — user + all routing members
//   stamping stamping documents          — initiator only
//   dop      Delegation of Power ref      — initiator (or automatic)
//   pm       Purchase Manual ref          — automatic only (auto-added at initiation)
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { all, get, nowISO, run } from '../../noting/db.js';
import { currentMember } from '../../noting/identity.js';
import { noteByTxn, participants } from '../../noting/workflow.js';
import { requireNoteAccess } from './access.js';
import { upload, computeFileHash } from '../../storage.js';

const router = Router();
const KINDS = ['doc', 'stamping', 'dop', 'pm'];

// List attachments for a note
router.get('/notes/:txnId/attachments', (req, res) => {
  const note = noteByTxn(req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!requireNoteAccess(req, res, note)) return;
  const attachments = all(
    `SELECT a.id, a.kind, a.name, a.ref, a.file_size_bytes, a.mime_type, a.created_at, m.name AS uploaded_by,
            CASE WHEN a.storage_path IS NOT NULL THEN 1 ELSE 0 END AS has_file
     FROM attachments a LEFT JOIN members m ON m.id = a.uploaded_by_id
     WHERE a.note_id = ? ORDER BY a.id ASC`,
    note.id
  );
  res.json({ attachments });
});

// Upload attachment (supports multipart/form-data with actual file or JSON metadata)
router.post('/notes/:txnId/attachments', upload.single('file'), async (req, res) => {
  try {
    const me = currentMember(req);
    const note = noteByTxn(req.params.txnId);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (!me || !participants(note.id).has(me.id)) {
      return res.status(403).json({ error: 'Only a routed member can attach files' });
    }

    const { kind, name, ref } = req.body || {};
    if (!KINDS.includes(kind)) return res.status(422).json({ error: `kind must be one of ${KINDS.join(', ')}` });
    if (kind === 'pm') return res.status(403).json({ error: 'PM reference is added automatically' });
    if ((kind === 'stamping' || kind === 'dop') && me.id !== note.initiator_id) {
      return res.status(403).json({ error: `Only the initiator can add ${kind === 'dop' ? 'a DoP reference' : 'stamping documents'}` });
    }

    const file = req.file;
    const displayName = (name && String(name).trim()) || (file ? file.originalname : '');
    if (!displayName) return res.status(422).json({ error: 'A name or file is required' });

    let storagePath = null;
    let fileSizeBytes = null;
    let mimeType = null;
    let sha256Hash = null;

    if (file) {
      storagePath = file.path;
      fileSizeBytes = file.size;
      mimeType = file.mimetype;
      sha256Hash = await computeFileHash(file.path);
    }

    run(
      `INSERT INTO attachments(note_id, kind, name, ref, storage_path, file_size_bytes, mime_type, sha256_hash, uploaded_by_id, created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      note.id,
      kind,
      displayName,
      (ref || '').trim() || null,
      storagePath,
      fileSizeBytes,
      mimeType,
      sha256Hash,
      me.id,
      nowISO()
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Attachment upload error:', err);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

// Download / stream an attached file
router.get('/notes/:txnId/attachments/:attachmentId/download', (req, res) => {
  const note = noteByTxn(req.params.txnId);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!requireNoteAccess(req, res, note)) return;

  const attachment = get(
    `SELECT * FROM attachments WHERE id = ? AND note_id = ?`,
    req.params.attachmentId,
    note.id
  );

  if (!attachment || !attachment.storage_path) {
    return res.status(404).json({ error: 'File content not found' });
  }

  if (!fs.existsSync(attachment.storage_path)) {
    return res.status(404).json({ error: 'File is missing from storage' });
  }

  res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.name)}"`);
  fs.createReadStream(attachment.storage_path).pipe(res);
});

export default router;
