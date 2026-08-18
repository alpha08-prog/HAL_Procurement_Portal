// Module C store. Uses Node 24's built-in node:sqlite (no native build — runs on
// Windows dev and the on-prem GB10 ARM box alike). The DB is a single file under
// server/data/ so routing, drafts and cabinets survive a server restart.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.NOTING_DB || join(dataDir, 'noting.db');
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');
db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));

// Forward-migrate columns added after a DB already exists on disk. schema.sql is
// CREATE ... IF NOT EXISTS, so it never alters an existing table — add new columns here.
function ensureColumn(table, column, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}
ensureColumn('files', 'line_no', 'TEXT');
ensureColumn('members', 'grade', 'TEXT');
ensureColumn('attachments', 'storage_path', 'TEXT');
ensureColumn('attachments', 'file_size_bytes', 'INTEGER');
ensureColumn('attachments', 'mime_type', 'TEXT');
ensureColumn('attachments', 'sha256_hash', 'TEXT');

// Thin helpers. Params are positional `?` bound via spread (node:sqlite anonymous params).
export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const get = (sql, ...p) => db.prepare(sql).get(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);

export const nowISO = () => new Date().toISOString().slice(0, 10);
