// Module E store. Same node:sqlite pattern as server/noting/db.js and
// server/contracts/db.js, in its own DB file so live approval chains survive a restart
// independently of the noting and contract stores.
//
// Reset it with:  rm server/data/approvals.db   (it rebuilds on next boot)
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.APPROVALS_DB || join(dataDir, 'approvals.db');
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');
db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));

export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);
export const nowStamp = () => new Date().toISOString();

export default { db, all, get, run, nowStamp };
