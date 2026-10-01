// Cross-cutting regression check for the server shell and the client's routing config.
// Run: node server/server.check.mjs  (part of `npm run check`)
//
// 1. Every router module loads (catches missing imports and node:sqlite failures) against
//    throwaway SQLite files, so the real server/data/*.db are never touched.
// 2. Nothing under server/ imports `pg` — Postgres is not a runtime store.
// 3. client/src/config/roles.js: every SCREENS entry has a `group` that exists in GROUPS.
// 4. client/src/config/portalStructure.js: every item route resolves to a SCREENS path or a
//    DETAIL_ROUTES prefix, so no Portal Hub card can dead-end on the catch-all redirect.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

// --- 1. routers load against throwaway DBs -------------------------------------------
const tmp = mkdtempSync(path.join(tmpdir(), 'hal-server-check-'));
for (const k of ['NOTING_DB', 'CONTRACTS_DB', 'APPROVALS_DB', 'AI_CASES_DB', 'REQUISITIONS_DB']) {
  process.env[k] = path.join(tmp, `${k.toLowerCase()}.db`);
}
for (const m of [
  './routes/auth.js', './routes/rvs.js', './routes/paymentAdvices.js', './routes/ai.js',
  './routes/noting/index.js', './routes/contracts/index.js', './routes/approvals/index.js',
  './routes/formats.js', './routes/trackers.js', './routes/requisitions.js', './routes/claims.js', './routes/kpis.js'
]) {
  const mod = await import(m);
  assert.ok(mod.default, `${m} has no default export (router)`);
}

// --- 2. no pg anywhere in server/ ----------------------------------------------------
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'data', 'uploads'].includes(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?js|json)$/.test(name)) out.push(p);
  }
  return out;
}
for (const f of walk(here)) {
  const src = readFileSync(f, 'utf8');
  assert.ok(!/from\s+['"]pg['"]/.test(src) && !/require\(\s*['"]pg['"]\s*\)/.test(src), `${f} imports pg`);
}
const serverPkg = JSON.parse(read('server/package.json'));
assert.ok(!serverPkg.dependencies?.pg, 'server/package.json still depends on pg');

// --- 3. roles.js: SCREENS groups -----------------------------------------------------
const roles = read('client/src/config/roles.js');
const groupsSrc = roles.slice(roles.indexOf('export const GROUPS'), roles.indexOf('export const groupById'));
const groupIds = new Set([...groupsSrc.matchAll(/\{\s*id:\s*'([^']+)'/g)].map((m) => m[1]));
assert.ok(groupIds.size >= 5, 'GROUPS not found in roles.js');

const screensSrc = roles.slice(roles.indexOf('export const SCREENS'), roles.indexOf('export const DETAIL_ROUTES'));
const screens = [...screensSrc.matchAll(/\{\s*path:\s*'([^']+)'([^}]*)\}/g)].map((m) => ({ path: m[1], body: m[2] }));
assert.ok(screens.length >= 30, `only ${screens.length} SCREENS parsed`);
for (const s of screens) {
  const g = s.body.match(/group:\s*'([^']+)'/)?.[1];
  assert.ok(g, `SCREENS entry ${s.path} has no group`);
  assert.ok(groupIds.has(g), `SCREENS entry ${s.path} has unknown group "${g}"`);
  assert.ok(/visibleTo:/.test(s.body), `SCREENS entry ${s.path} has no visibleTo`);
}
const detailSrc = roles.slice(roles.indexOf('export const DETAIL_ROUTES'), roles.indexOf('const detailRouteFor'));
const prefixes = [...detailSrc.matchAll(/prefix:\s*'([^']+)'/g)].map((m) => m[1]);
assert.ok(prefixes.length >= 4, 'DETAIL_ROUTES not found');

// --- 4. portalStructure.js routes all exist ------------------------------------------
const portal = read('client/src/config/portalStructure.js');
const screenPaths = new Set(screens.map((s) => s.path));
const routes = [...portal.matchAll(/\broute:\s*'([^']+)'/g)].map((m) => m[1]);
assert.ok(routes.length >= 20, 'portalStructure routes not found');
for (const r of routes) {
  const pathname = r.split('?')[0];
  const ok = screenPaths.has(pathname) || prefixes.some((p) => pathname.startsWith(p));
  assert.ok(ok, `portalStructure route ${r} matches no SCREENS path or DETAIL_ROUTES prefix`);
}

// --- 5. screens never define grid columns inline or ship MOCK_ literals -----------------
function walkClient(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walkClient(p, out);
    else if (/\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}
for (const f of walkClient(path.join(root, 'client/src/screens'))) {
  const src = readFileSync(f, 'utf8');
  assert.ok(!/\bcolumns\s*=\s*\[/.test(src), `${path.relative(root, f)} defines grid columns inline — move them to client/src/config/*.jsx`);
  assert.ok(!/\bMOCK_[A-Z_]+/.test(src), `${path.relative(root, f)} ships a MOCK_ literal — screens render server data only`);
}

console.log(`server.check: ${screens.length} screens in ${groupIds.size} groups, ${routes.length} hub routes resolve, routers load, no pg, no inline columns/MOCK_. OK`);
