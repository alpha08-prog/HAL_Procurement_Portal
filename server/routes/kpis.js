// Computed procurement KPIs, mounted gated at /api/kpis.
//   GET /            ?months=6 → { asOf, months, window, metrics[16], counts }
//   GET /:code       one metric (KPI-02 …)
import { Router } from 'express';
import { computeAll } from '../kpis/metrics.js';

const router = Router();

router.get('/', (req, res) => res.json(computeAll({ months: req.query.months })));

router.get('/:code', (req, res) => {
  const out = computeAll({ months: req.query.months });
  const m = out.metrics.find((x) => x.code.toLowerCase() === String(req.params.code).toLowerCase() || x.id === req.params.code);
  if (!m) return res.status(404).json({ error: `Unknown KPI "${req.params.code}"` });
  res.json({ asOf: out.asOf, months: out.months, window: out.window, metric: m });
});

export default router;
