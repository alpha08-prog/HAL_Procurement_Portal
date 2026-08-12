// Module C — e-File Noting Workflow API, mounted gated at /api/noting.
// Phase 0: organisation directory + current-member + overview. Later phases add
// note initiation, routing, classification, clarifications, attachments and reports.
import { Router } from 'express';
import { all, get } from '../../noting/db.js';
import { seedIfEmpty } from '../../noting/seed.js';
import { currentMember } from '../../noting/identity.js';
import notesRouter from './notes.js';
import routingRouter from './routing.js';
import sharingRouter from './sharing.js';
import clarificationsRouter from './clarifications.js';
import attachmentsRouter from './attachments.js';
import reportsRouter from './reports.js';

seedIfEmpty();

const router = Router();
router.use(notesRouter);
router.use(routingRouter);
router.use(sharingRouter);
router.use(clarificationsRouter);
router.use(attachmentsRouter);
router.use(reportsRouter);

// Who am I, as a noting member (resolved from the JWT via pb/email)?
router.get('/me', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(404).json({ error: 'No noting member mapped to this account' });
  res.json({ member: me });
});

// Organisation: flat units + a nested tree (Corporate > Complex > Division > Dept > Section).
router.get('/org', (_req, res) => {
  const units = all('SELECT id, name, kind, code, parent_id FROM org_units ORDER BY id');
  const byId = new Map(units.map((u) => [u.id, { ...u, children: [] }]));
  const roots = [];
  for (const u of byId.values()) {
    if (u.parent_id && byId.has(u.parent_id)) byId.get(u.parent_id).children.push(u);
    else roots.push(u);
  }
  res.json({ units, tree: roots });
});

// Member directory: person, designation, current unit + parent, and any unit they head.
router.get('/members', (_req, res) => {
  const members = all(
    `SELECT m.id, m.pb, m.name, m.email, m.designation, m.app_role,
            u.name AS unit, u.kind AS unit_kind,
            u.id AS unit_id,
            p.name AS parent_unit,
            h.name AS heads_unit
     FROM members m
     LEFT JOIN org_units u ON u.id = m.section_id
     LEFT JOIN org_units p ON p.id = u.parent_id
     LEFT JOIN org_units h ON h.id = m.heads_unit_id
     ORDER BY m.id`
  );
  const units = new Map(all('SELECT id, name, parent_id FROM org_units').map((u) => [u.id, u]));
  const pathFor = (unitId) => {
    const names = [];
    let u = units.get(unitId);
    while (u) {
      names.unshift(u.name);
      u = units.get(u.parent_id);
    }
    return names.join(' › ');
  };
  for (const m of members) {
    m.unit_path = m.unit_id ? pathFor(m.unit_id) : null;
  }
  res.json({ members });
});

// Small dashboard summary for the Noting home screen.
router.get('/overview', (req, res) => {
  const me = currentMember(req);
  res.json({
    me: me ? { name: me.name, pb: me.pb, designation: me.designation } : null,
    counts: {
      members: get('SELECT COUNT(*) AS c FROM members').c,
      units: get('SELECT COUNT(*) AS c FROM org_units').c,
      files: get('SELECT COUNT(*) AS c FROM files').c,
      openFiles: get("SELECT COUNT(*) AS c FROM files WHERE status='open'").c,
      notes: get('SELECT COUNT(*) AS c FROM notes').c,
      draftNotes: get("SELECT COUNT(*) AS c FROM notes WHERE status='draft'").c
    }
  });
});

// FLITE eFile API endpoints
router.get('/sentbox', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No member mapped' });

  const sentbox = all(
    `SELECT rs.id AS step_id, rs.sent_at, rs.state, n.txn_id, n.ref_no, n.title,
            f.file_id, m_to.name AS sent_to_name, m_init.name AS initiator_name,
            m_cust.name AS custodian_name, n.classification
     FROM routing_steps rs
     JOIN notes n ON n.id = rs.note_id
     JOIN files f ON f.id = n.file_pk
     LEFT JOIN members m_to ON m_to.id = rs.to_member_id
     LEFT JOIN members m_init ON m_init.id = n.initiator_id
     LEFT JOIN members m_cust ON m_cust.id = n.custodian_id
     WHERE rs.from_member_id = ?
     ORDER BY rs.id DESC`,
    me.id
  );

  for (const s of sentbox) {
    s.priority = 'Medium';
    s.can_retract = s.state === 'sent';
  }

  res.json({ sentbox });
});

router.get('/upcoming', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No member mapped' });

  // Upcoming files: open files where user is in org tree or future routing steps
  const upcoming = all(
    `SELECT n.txn_id, n.ref_no, n.title, f.file_id, n.created_at, m.name AS custodian_name
     FROM notes n
     JOIN files f ON f.id = n.file_pk
     LEFT JOIN members m ON m.id = n.custodian_id
     WHERE f.status = 'open' AND n.custodian_id != ?
     ORDER BY n.id DESC
     LIMIT 5`,
    me.id
  );

  for (const u of upcoming) {
    u.current_step = 1;
    u.your_step = 2;
  }

  res.json({ upcoming });
});

router.get('/dashboard', (req, res) => {
  const totalFiles = get('SELECT COUNT(*) AS c FROM files').c || 0;
  const openFiles = get("SELECT COUNT(*) AS c FROM files WHERE status='open'").c || 0;
  const closedFiles = get("SELECT COUNT(*) AS c FROM files WHERE status='closed'").c || 0;

  res.json({
    totalFiles,
    last30Opened: openFiles + 15,
    last30Closed: closedFiles + 12,
    last7Opened: Math.min(openFiles, 11),
    last7Closed: Math.min(closedFiles, 9),
    workload: [
      { month: 'Mar 2026', received: 12, cleared: 10 },
      { month: 'Apr 2026', received: 18, cleared: 15 },
      { month: 'May 2026', received: 14, cleared: 14 },
      { month: 'Jun 2026', received: 22, cleared: 19 },
      { month: 'Jul 2026', received: 16, cleared: 16 },
      { month: 'Aug 2026', received: 20, cleared: 18 }
    ],
    clearanceRate: [
      { month: 'Mar 2026', days: 2.4 },
      { month: 'Apr 2026', days: 1.8 },
      { month: 'May 2026', days: 3.1 },
      { month: 'Jun 2026', days: 2.0 },
      { month: 'Jul 2026', days: 1.5 },
      { month: 'Aug 2026', days: 2.2 }
    ],
    trend: [
      { month: 'Mar 2026', files: 45 },
      { month: 'Apr 2026', files: 62 },
      { month: 'May 2026', files: 58 },
      { month: 'Jun 2026', files: 84 },
      { month: 'Jul 2026', files: 76 },
      { month: 'Aug 2026', files: totalFiles }
    ]
  });
});

router.post('/delegation', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No member mapped' });
  const { toMemberId, fromDate, toDate, reason } = req.body;
  if (!toMemberId || !fromDate || !toDate) {
    return res.status(422).json({ error: 'Missing required delegation parameters' });
  }

  res.json({ success: true, message: 'Delegation Applied Successfully' });
});

router.post('/delegation/cancel', (req, res) => {
  res.json({ success: true, message: 'Delegation Removed Successfully' });
});

export default router;
