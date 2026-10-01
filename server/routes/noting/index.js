// Module C — e-File Noting Workflow API, mounted gated at /api/noting.
// Directory + current member + overview, the FLITE-style sentbox / upcoming / dashboard,
// and delegation. Notes, routing, sharing, clarifications, attachments and reports are
// sub-routers.
import { Router } from 'express';
import { all, get } from '../../noting/db.js';
import { seedIfEmpty } from '../../noting/seed.js';
import { currentMember } from '../../noting/identity.js';
import { dashboardFor, upcomingFor } from '../../noting/dashboard.js';
import { cancelDelegation, createDelegation, listDelegations } from '../../noting/delegation.js';
import { NEEDBASED, STAGE_ORDER, stageTitle } from '../../noting/stages.js';
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
// The stage vocabulary for the Initiate screen's deep links: cascade stages are generated from
// a proposal's cabinet, need-based ones may open a file of their own.
router.get('/stages', (_req, res) =>
  res.json({
    order: STAGE_ORDER.map((id) => ({ id, title: stageTitle(id) })),
    needBased: Object.entries(NEEDBASED).map(([id, v]) => ({ id, title: v.title }))
  })
);

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
    `SELECT m.id, m.pb, m.name, m.email, m.designation, m.grade, m.app_role,
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

// Everything I have sent, with the receiver's state (delivered / read / actioned).
router.get('/sentbox', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No member mapped' });

  const sentbox = all(
    `SELECT rs.id AS step_id, rs.sent_at, rs.state, rs.on_behalf_of_id, n.txn_id, n.ref_no, n.title,
            COALESCE(n.priority, 'Medium') AS priority,
            f.file_id, m_to.name AS sent_to_name, m_init.name AS initiator_name,
            m_cust.name AS custodian_name, n.classification, n.status AS note_status
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
    s.status = s.state === 'sent' ? 'Delivered' : s.state === 'opened' ? 'Read' : s.state === 'actioned' ? 'Actioned' : s.state;
    s.can_retract = s.state === 'sent';
    s.delegated = Boolean(s.on_behalf_of_id);
  }

  res.json({ sentbox });
});

// Open notes whose planned routing still has me ahead of the current holder.
router.get('/upcoming', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No member mapped' });
  res.json({ upcoming: upcomingFor(me) });
});

// Personal workload + application-wide counts, computed from routing_steps and files.
router.get('/dashboard', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No member mapped' });
  res.json(dashboardFor(me));
});

// Delegation of authority: list mine (given and received), create one, cancel one.
router.get('/delegation', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No member mapped' });
  res.json(listDelegations(me));
});

router.post('/delegation', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No member mapped' });
  try {
    const delegation = createDelegation(me, req.body || {});
    res.status(201).json({ success: true, delegation, ...listDelegations(me) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/delegation/cancel', (req, res) => {
  const me = currentMember(req);
  if (!me) return res.status(403).json({ error: 'No member mapped' });
  try {
    const delegation = cancelDelegation(me, req.body?.id);
    res.json({ success: true, delegation, ...listDelegations(me) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
