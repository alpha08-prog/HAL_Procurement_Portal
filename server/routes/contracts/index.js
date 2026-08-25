// Module D — Contract Generation API, mounted gated at /api/contracts (server/index.js).
// Sub-routers: lookup (tender/PO/clause-plan/formats), library (STC + admin amendments),
// contracts (register + lifecycle). Order matters: lookup/library paths must be matched
// before the register's parameterised /:id routes.
import { Router } from 'express';
import { seedIfEmpty } from '../../contracts/seed.js';
import lookupRouter from './lookup.js';
import libraryRouter from './library.js';
import contractsRouter from './contracts.js';

seedIfEmpty();

const router = Router();
router.use(lookupRouter);
router.use(libraryRouter);
router.use(contractsRouter);

export default router;
