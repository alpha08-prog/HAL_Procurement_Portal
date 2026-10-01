// Imported first by the ad-hoc scripts so their POSTs land in a throwaway noting DB, never
// in server/data/noting.db. ESM evaluates imports in source order, so this runs before
// server/noting/db.js opens its file.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NOTING_DB ??= join(mkdtempSync(join(tmpdir(), 'hal-scratch-')), 'noting.db');
