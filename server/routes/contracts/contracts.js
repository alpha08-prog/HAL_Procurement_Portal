// Contract lifecycle routes: generate (draft) → patch (draft-only) → finalise → verify,
// plus the register. Money and clause snapshots come from contracts/generate.js; the
// acting user is always resolved server-side (contracts/identity.js), never from the body.
// Contract nos contain slashes, so paths use the numeric contracts.id.
import { Router } from 'express';
import { all } from '../../contracts/db.js';
import { contractActor } from '../../contracts/identity.js';
import { generateContract, patchDraft, finaliseContract, verifyContract, fullContract, CLASSIFICATIONS } from '../../contracts/generate.js';
import { requireRoles } from '../../middleware/requireRoles.js';

const router = Router();
const boom = (res, e) => res.status(e.status || 500).json({ error: e.message });
const contractWorkflowRole = requireRoles(
  ['purchase_maker', 'purchase_officer', 'hod_imm', 'admin'],
  'Contract generation and finalisation are available only to the purchase approval chain'
);

// The register: every field the client listed, denormalised — no joins needed client-side.
router.get('/', (_req, res) => {
  const contracts = all(
    `SELECT c.*, t.label AS type_label FROM contracts c
     JOIN contract_types t ON t.id = c.contract_type_id
     ORDER BY c.created_at DESC, c.id DESC`
  );
  res.json({ contracts, classifications: CLASSIFICATIONS });
});

router.post('/', contractWorkflowRole, (req, res) => {
  try {
    res.status(201).json(generateContract(req.body || {}, contractActor(req)));
  } catch (e) { boom(res, e); }
});

router.get('/:id', (req, res) => {
  const doc = fullContract(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Contract not found' });
  res.json(doc);
});

router.patch('/:id', contractWorkflowRole, (req, res) => {
  try {
    res.json(patchDraft(req.params.id, req.body || {}, contractActor(req)));
  } catch (e) { boom(res, e); }
});

router.post('/:id/finalise', contractWorkflowRole, (req, res) => {
  try {
    res.json(finaliseContract(req.params.id, contractActor(req)));
  } catch (e) { boom(res, e); }
});

router.get('/:id/verify', (req, res) => {
  try {
    res.json(verifyContract(req.params.id));
  } catch (e) { boom(res, e); }
});

export default router;
