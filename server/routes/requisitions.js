// Requisition register API, mounted gated at /api/requisitions (server/index.js).
//   GET  /kinds                 enums for the intake form
//   GET  /estimate/bases        estimate bases
//   POST /estimate              stateless price estimate (Portal Hub PRV-06)
//   GET  /                      register (?kind=&status=), status derived per row
//   POST /                      register a requisition (indentor + purchase chain + hod + admin)
//   GET  /:id                   one requisition with resolved links + events
//   PATCH /:id                  edit while no proposal file is open on it
//   POST /:id/estimate          recompute + store the estimate
//   GET  /:id/tender-doc        the compiled tender document rendered from this requisition
// Requisition nos contain slashes, so paths use the numeric id.
import { Router } from 'express';
import { requireRoles } from '../middleware/requireRoles.js';
import { estimate, BASES } from '../requisitions/estimate.js';
import { seedIfEmpty } from '../requisitions/seed.js';
import { STATUS_LABEL, STATUS_ORDER, TERMINAL_STATUSES } from '../requisitions/status.js';
import {
  BUDGET_TYPES, KINDS, TENDERING_TYPES, createRequisition, eventsOf, getRequisition, listRequisitions, patchRequisition, setEstimate
} from '../requisitions/register.js';
import { contractActor } from '../contracts/identity.js';
import { currentMember } from '../noting/identity.js';
import { render } from '../formats/render.js';
import { buildCtx } from './formats.js';

seedIfEmpty();

const router = Router();
const boom = (res, e) => res.status(e.status || 500).json({ error: e.message });
const intakeRole = requireRoles(
  ['indentor', 'purchase_maker', 'purchase_officer', 'hod_imm', 'admin'],
  'Requisitions are registered by the indentor or the purchase chain'
);
function actorOf(req) {
  const a = contractActor(req) || {};
  const member = currentMember(req);
  return { ...a, name: a.name ?? req.user?.name ?? null, memberId: member?.id ?? null };
}

router.get('/kinds', (_req, res) =>
  res.json({
    kinds: KINDS,
    tenderingTypes: TENDERING_TYPES,
    budgetTypes: BUDGET_TYPES,
    statuses: [...STATUS_ORDER, ...TERMINAL_STATUSES].map((id) => ({ id, label: STATUS_LABEL[id] })),
    bases: BASES
  })
);
router.get('/estimate/bases', (_req, res) => res.json({ bases: BASES }));
router.post('/estimate', (req, res) => {
  try {
    res.json(estimate(req.body || {}));
  } catch (e) {
    boom(res, e);
  }
});

router.get('/', (req, res) => {
  const { kind, status } = req.query;
  res.json({
    requisitions: listRequisitions({ kind: kind || undefined, status: status || undefined }),
    statuses: [...STATUS_ORDER, ...TERMINAL_STATUSES].map((id) => ({ id, label: STATUS_LABEL[id] })),
    source: 'server/data/requisitions.db — status derived from the linked noting file, contract, RV and payment advice on every read'
  });
});

router.post('/', intakeRole, (req, res) => {
  try {
    res.status(201).json({ requisition: createRequisition(req.body || {}, actorOf(req)) });
  } catch (e) {
    boom(res, e);
  }
});

router.get('/:id', (req, res) => {
  const requisition = getRequisition(req.params.id);
  if (!requisition) return res.status(404).json({ error: 'Requisition not found' });
  res.json({ requisition, events: eventsOf(requisition.id) });
});

router.patch('/:id', intakeRole, (req, res) => {
  try {
    res.json({ requisition: patchRequisition(req.params.id, req.body || {}, actorOf(req)) });
  } catch (e) {
    boom(res, e);
  }
});

router.post('/:id/estimate', intakeRole, (req, res) => {
  try {
    res.json({ requisition: setEstimate(req.params.id, req.body || {}, actorOf(req)) });
  } catch (e) {
    boom(res, e);
  }
});

router.get('/:id/tender-doc', (req, res) => {
  const requisition = getRequisition(req.params.id);
  if (!requisition) return res.status(404).json({ error: 'Requisition not found' });
  try {
    res.json(render('tender_document', {}, buildCtx(req, { requisitionId: requisition.id })));
  } catch (e) {
    boom(res, e);
  }
});

export default router;
