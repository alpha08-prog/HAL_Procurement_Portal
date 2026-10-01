// Tracker API, mounted gated at /api/trackers. GET / lists the trackers; GET /:name runs one.
// All read-only over the fixtures + contracts.db (server/trackers/trackers.js).
import { Router } from 'express';
import { TRACKERS, runTracker, SOURCE } from '../trackers/trackers.js';

const router = Router();

router.get('/', (_req, res) =>
  res.json({
    trackers: Object.entries(TRACKERS).map(([name, t]) => ({ name, hub: t.hub, title: t.title, note: t.note })),
    source: SOURCE
  })
);

router.get('/:name', (req, res) => {
  const out = runTracker(req.params.name);
  if (!out) return res.status(404).json({ error: `Unknown tracker "${req.params.name}"` });
  res.json(out);
});

export default router;
