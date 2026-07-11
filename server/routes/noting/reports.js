// Phase 6 — the four management reports from the email: lifecycle summary, stage & time,
// parent-child file tree, and live status. Read-only aggregates over the noting store.
// Every report is gated: rows are filtered to the files the caller may see (participant or
// supervising head), so restricted-file metadata never leaks (email points 24–27).
import { Router } from 'express';
import { all } from '../../noting/db.js';
import { currentMember } from '../../noting/identity.js';
import { visibleFileIds } from '../../noting/workflow.js';
import { stageTitle } from '../../noting/stages.js';

const router = Router();

const daysBetween = (from, to) => {
  if (!from) return null;
  const a = new Date(from);
  const b = to ? new Date(to) : new Date();
  return Math.max(0, Math.round((b - a) / 86400000));
};

// Resolve the acting member + the set of file ids they may see. 403 if unmapped.
function scope(req, res) {
  const me = currentMember(req);
  if (!me) {
    res.status(403).json({ error: 'No noting member mapped to this account' });
    return null;
  }
  return visibleFileIds(me);
}

// A — lifecycle summary (Provisioning → PO placement + amendments), one row per file.
router.get('/reports/lifecycle', (req, res) => {
  const visible = scope(req, res);
  if (!visible) return;
  const rows = all(
    `SELECT f.id, f.file_id, f.title, f.kind, f.car_no, f.standalone, f.status, f.created_at, f.closed_at,
            f.parent_file_id, f.line_no, im.name AS initiator,
            (SELECT COUNT(*) FROM notes n WHERE n.file_pk = f.id) AS notes,
            (SELECT n.stage_id FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS stage,
            (SELECT n.status FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS note_status
     FROM files f LEFT JOIN members im ON im.id = f.initiator_id ORDER BY f.id DESC`
  )
    .filter((r) => visible.has(r.id))
    .map((r) => ({ ...r, stage_title: stageTitle(r.stage), elapsed_days: daysBetween(r.created_at, r.closed_at) }));
  res.json({ rows });
});

// B — stage & time: per-note dates, per-stage duration and total elapsed since provisioning.
router.get('/reports/stage-time', (req, res) => {
  const visible = scope(req, res);
  if (!visible) return;
  const rows = all(
    `SELECT f.id AS file_pk, f.file_id, n.ref_no, n.title, n.stage_id, n.status, n.created_at, n.closed_at, im.name AS initiator
     FROM notes n JOIN files f ON f.id = n.file_pk LEFT JOIN members im ON im.id = n.initiator_id
     ORDER BY f.id, n.seq`
  )
    .filter((r) => visible.has(r.file_pk))
    .map((r) => ({ ...r, stage_title: stageTitle(r.stage_id), duration_days: daysBetween(r.created_at, r.closed_at) }));
  res.json({ rows });
});

// C — parent-child tree: one MPR/CAR/SPR can spawn many PP (line-wise L1 agencies).
router.get('/reports/tree', (req, res) => {
  const visible = scope(req, res);
  if (!visible) return;
  const files = all(
    `SELECT f.id, f.file_id, f.title, f.parent_file_id, f.line_no, f.kind, f.car_no, f.status,
            (SELECT n.txn_id FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq ASC LIMIT 1) AS first_txn
     FROM files f ORDER BY f.id`
  ).filter((f) => visible.has(f.id));
  const byId = new Map(files.map((f) => [f.id, { ...f, children: [] }]));
  const roots = [];
  for (const f of byId.values()) {
    if (f.parent_file_id && byId.has(f.parent_file_id)) byId.get(f.parent_file_id).children.push(f);
    else roots.push(f);
  }
  res.json({ tree: roots });
});

// D — live status: open files by stage, with time since provisioning / tendering start.
router.get('/reports/live-status', (req, res) => {
  const visible = scope(req, res);
  if (!visible) return;
  const rows = all(
    `SELECT f.id, f.file_id, f.title, f.provisioning_start, f.tendering_start, im.name AS initiator,
            (SELECT n.stage_id FROM notes n WHERE n.file_pk = f.id ORDER BY n.seq DESC LIMIT 1) AS stage
     FROM files f LEFT JOIN members im ON im.id = f.initiator_id
     WHERE f.status = 'open' ORDER BY f.id`
  )
    .filter((r) => visible.has(r.id))
    .map((r) => ({
      ...r,
      stage_title: stageTitle(r.stage),
      days_since_provisioning: daysBetween(r.provisioning_start),
      days_since_tendering: daysBetween(r.tendering_start)
    }));
  res.json({ rows });
});

export default router;
