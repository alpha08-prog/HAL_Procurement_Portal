// Requisition register store. Same node:sqlite pattern as server/noting/db.js with its own file
// (server/data/requisitions.db, override with REQUISITIONS_DB), so the register survives
// restarts independently of the other modules. Reseed with: node server/requisitions/seed.js
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.REQUISITIONS_DB || join(dataDir, 'requisitions.db');
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');
db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));

// Forward-migrate columns added after a DB already exists on disk (schema.sql never alters).
function ensureColumn(table, column, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}
ensureColumn('requisitions', 'source_case', 'TEXT');

export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const get = (sql, ...p) => db.prepare(sql).get(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);

export const nowISO = () => new Date().toISOString().slice(0, 10);
export const nowStamp = () => new Date().toISOString();
