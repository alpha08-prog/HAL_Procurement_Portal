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

// Forward-migrate columns added after a DB exists on disk (schema.sql never alters tables).
function ensureColumn(table, column, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}
ensureColumn('approval_chains', 'noting_note_id', 'INTEGER');     // the noting stage file this chain decides
ensureColumn('approval_chains', 'requisition_id', 'INTEGER');
ensureColumn('checklist_submissions', 'requisition_id', 'INTEGER');
ensureColumn('approval_hops', 'rider_ref', 'INTEGER');            // discharge_rider: the hop whose rider is met
ensureColumn('approval_hops', 'acted_by_pb', 'TEXT');             // PB of the signed-in user who recorded the hop
ensureColumn('approval_hops', 'on_behalf', 'INTEGER DEFAULT 0');  // 1 when acted_by_pb is not the position holder

export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);
export const nowStamp = () => new Date().toISOString();

export default { db, all, get, run, nowStamp };
