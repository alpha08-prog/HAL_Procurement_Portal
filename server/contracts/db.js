// Module D store. Same node:sqlite pattern as server/noting/db.js but its own DB file,
// so the contract register + versioned clause library survive restarts independently of
// the noting store. Reseed with: node server/contracts/seed.js
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.CONTRACTS_DB || join(dataDir, 'contracts.db');
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');
db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));

// Forward-migrate columns added after a DB already exists on disk. schema.sql is
// CREATE ... IF NOT EXISTS, so it never alters an existing table — add new columns here.
function ensureColumn(table, column, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}

export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const get = (sql, ...p) => db.prepare(sql).get(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);

export const nowISO = () => new Date().toISOString().slice(0, 10);
export const nowStamp = () => new Date().toISOString();
