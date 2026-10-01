// Claims API, mounted gated at /api/claims. In-memory store (server/claims/store.js) seeded
// from server/mock/claims.json — resets on restart like the payment advices.
//   GET  /               ?tab=status|dispatched|received|closed → { claims, summary, tabs }
//   GET  /discrepancies  RVs / PAs where a claim may be due but none is raised
//   GET  /enums          claim types, actions sought, transitions
//   POST /               raise a claim on an RV (stores, purchase maker, admin)
//   POST /transition     { claimNo, action, ...meta } (role per CLAIM_TRANSITIONS)
import { Router } from 'express';
import { requireRoles } from '../middleware/requireRoles.js';
import { ACTIONS_SOUGHT, CLAIM_STATUS, CLAIM_TRANSITIONS, CLAIM_TYPES, createClaim, discrepancies, listClaims, summary, transitionClaim } from '../claims/store.js';

const router = Router();
const boom = (res, e) => res.status(e.status || 500).json({ error: e.message });
const raiseRole = requireRoles(['stores_inspection', 'purchase_maker', 'admin'], 'Claims are raised by Stores & Inspection or the Purchase Maker');

const TABS = [
  { id: 'status', label: 'Claim status (all claims)', hub: 'CLM-02' },
  { id: 'dispatched', label: 'Units dispatched under claim', hub: 'CLM-03' },
  { id: 'received', label: 'Item received against claim', hub: 'CLM-04' },
  { id: 'closed', label: 'Claims closed', hub: 'CLM-05' }
];

router.get('/enums', (_req, res) =>
  res.json({ types: CLAIM_TYPES, actionsSought: ACTIONS_SOUGHT, statuses: CLAIM_STATUS, transitions: CLAIM_TRANSITIONS, tabs: TABS })
);

router.get('/discrepancies', (_req, res) => res.json({ rows: discrepancies(), source: 'server/mock/rvs.json + paymentAdvices.json (in-memory)' }));

router.get('/', (req, res) => {
  const tab = TABS.some((t) => t.id === req.query.tab) ? req.query.tab : 'status';
  let rows = listClaims();
  if (tab !== 'status') rows = rows.filter((c) => c.status === tab);
  res.json({ claims: rows, tab, tabs: TABS, summary: summary(), source: 'server/mock/claims.json (in-memory; resets on restart)' });
});

router.post('/', raiseRole, (req, res) => {
  try {
    res.status(201).json({ claim: createClaim(req.body || {}, req.user) });
  } catch (e) {
    boom(res, e);
  }
});

router.post('/transition', (req, res) => {
  try {
    const { claimNo, action, ...payload } = req.body || {};
    res.json({ claim: transitionClaim(claimNo, action, payload, req.user) });
  } catch (e) {
    boom(res, e);
  }
});

export default router;
