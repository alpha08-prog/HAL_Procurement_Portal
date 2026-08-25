// Module F store. Same node:sqlite pattern as server/noting/db.js, in its own file so
// AI cases survive a restart independently of the other stores.
//
// Reset with:  rm server/data/ai_cases.db   (it rebuilds on next boot)
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.AI_CASES_DB || join(dataDir, 'ai_cases.db');
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');
db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));

export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const get = (sql, ...p) => db.prepare(sql).get(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);
export const nowStamp = () => new Date().toISOString();

export default { db, all, get, run, nowStamp };
