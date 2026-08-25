// Read-only lookups behind the Contract Generation window: tender datalist, the PO
// dropdown for a tender, the full PO preview (with server-computed money), the clause
// plan for a contract type, and the pickable annexure formats. All fixture/library-backed.
import { Router } from 'express';
import { allTenders, findTender, findPo } from '../../contracts/poSource.js';
import { computeItems } from '../../contracts/money.js';
import { clausesForType } from '../../contracts/matrix.js';
import { get } from '../../contracts/db.js';
import { getFormats } from '../../contracts/generate.js';
import { requireRoles } from '../../middleware/requireRoles.js';

const router = Router();
const contractWorkflowRole = requireRoles(
  ['purchase_maker', 'purchase_officer', 'hod_imm', 'admin'],
  'Contract generation lookups are available only to the purchase approval chain'
);

router.get('/tenders', contractWorkflowRole, (_req, res) => res.json({ tenders: allTenders() }));

router.get('/lookup', contractWorkflowRole, (req, res) => {
  const tender = findTender(req.query.tender);
  if (!tender) return res.status(404).json({ error: 'No tender found for that Requisition/HAL IFS tender no' });
  res.json({
    tender: { tenderNo: tender.tenderNo, tenderDate: tender.tenderDate, carNo: tender.carNo, cfaDopRef: tender.cfaDopRef, modeOfTendering: tender.modeOfTendering },
    pos: tender.pos.map((p) => ({ poNo: p.poNo, poDate: p.poDate, description: p.description, itemCount: p.items.length }))
  });
});

router.get('/lookup/po', contractWorkflowRole, (req, res) => {
  const src = findPo(req.query.tender, req.query.po);
  if (!src) return res.status(404).json({ error: 'No PO found for that tender/PO combination' });
  const { tender, po, vendor } = src;
  const { lines, totals } = computeItems(po.items);
  res.json({
    tender: { tenderNo: tender.tenderNo, tenderDate: tender.tenderDate, carNo: tender.carNo, cfaDopRef: tender.cfaDopRef, modeOfTendering: tender.modeOfTendering },
    po: { poNo: po.poNo, poDate: po.poDate, description: po.description, suggestedType: po.suggestedType, scopeOfWork: po.scopeOfWork, techSpecs: po.techSpecs, deliveryPeriod: po.deliveryPeriod },
    vendor,
    items: lines,
    totals
  });
});

router.get('/clause-plan', contractWorkflowRole, (req, res) => {
  const typeId = req.query.type;
  if (!get('SELECT id FROM contract_types WHERE id = ?', typeId)) return res.status(422).json({ error: 'Unknown contract type' });
  res.json({ typeId, ...clausesForType(typeId) });
});

router.get('/formats', contractWorkflowRole, (_req, res) => res.json({ formats: getFormats() }));

export default router;
