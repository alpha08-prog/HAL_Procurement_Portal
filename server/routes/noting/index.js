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
            p.name AS parent_unit,
            h.name AS heads_unit
     FROM members m
     LEFT JOIN org_units u ON u.id = m.section_id
     LEFT JOIN org_units p ON p.id = u.parent_id
     LEFT JOIN org_units h ON h.id = m.heads_unit_id
     ORDER BY m.id`
  );
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

export default router;
