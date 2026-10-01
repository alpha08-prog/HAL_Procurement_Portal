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

// Forward-migrate columns added after a DB exists on disk (schema.sql never alters tables).
function ensureColumn(table, column, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}
ensureColumn('ai_case_notes', 'case_object_before', 'TEXT');   // snapshot for rollbackNote
ensureColumn('ai_case_notes', 'voided_at', 'TEXT');            // set when a note is rolled back
ensureColumn('ai_cases', 'noting_file_pk', 'INTEGER');         // the noting proposal this case belongs to
ensureColumn('ai_cases', 'requisition_id', 'INTEGER');

export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const get = (sql, ...p) => db.prepare(sql).get(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);
export const nowStamp = () => new Date().toISOString();

export default { db, all, get, run, nowStamp };
