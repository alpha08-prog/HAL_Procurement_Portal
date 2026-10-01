// Regression check for the formats library. Run: node server/formats/formats.check.mjs
//   1. every seed entry is complete, ids are unique, every {{key}} names a declared field,
//      every computed spec names a known function, every cascadeFormatId is in the AI REGISTRY
//   2. render() computes the money: PBG 10%, SD 5%, indemnity 5%, words present, blanks marked
//   3. every Portal Hub modal action maps to a library entry, a tracker, a calculator, the DoP
//      lookup, the library itself or a KPI — no card can fall through to a generic placeholder
//   4. unverified entries carry a note, verified ones a source
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
process.env.CONTRACTS_DB = path.join(mkdtempSync(path.join(tmpdir(), 'hal-formats-check-')), 'contracts.db');

const { FORMATS, getFormat, list, summary, KINDS } = await import('./library.js');
const { render, COMPUTED_FNS, BLANK } = await import('./render.js');
const { REGISTRY } = await import('../ai/formats.js');
const { TRACKERS } = await import('../trackers/trackers.js');

// --- 1. seed integrity ------------------------------------------------------------------
const ids = new Set();
for (const f of FORMATS) {
  for (const k of ['id', 'code', 'title', 'kind', 'category']) assert.ok(f[k], `${f.id}: missing ${k}`);
  assert.ok(!ids.has(f.id), `duplicate id ${f.id}`);
  ids.add(f.id);
  assert.ok(KINDS.includes(f.kind), `${f.id}: unknown kind ${f.kind}`);
  assert.equal(typeof f.verified, 'boolean', `${f.id}: verified must be boolean`);
  assert.ok(Array.isArray(f.fields) && Array.isArray(f.body) && f.body.length > 0, `${f.id}: fields/body`);
  if (f.verified) assert.ok(f.source, `${f.id}: verified entry needs a source`);
  else assert.ok(f.note, `${f.id}: unverified entry needs a note saying what HAL must supply`);
  const keys = new Set(f.fields.map((x) => x.key));
  assert.equal(keys.size, f.fields.length, `${f.id}: duplicate field keys`);
  for (const m of JSON.stringify(f.body).matchAll(/\{\{([a-z0-9_]+)\}\}/g)) assert.ok(keys.has(m[1]), `${f.id}: placeholder {{${m[1]}}} has no field`);
  for (const x of f.fields) {
    if (x.computed) assert.ok(COMPUTED_FNS.includes(String(x.computed).split(':')[0]), `${f.id}.${x.key}: unknown computed fn`);
    if (x.type === 'select') assert.ok(Array.isArray(x.options) && x.options.length > 0, `${f.id}.${x.key}: select without options`);
  }
  for (const b of f.body) {
    if (b.rowsFrom) assert.ok(keys.has(b.rowsFrom), `${f.id}: rowsFrom ${b.rowsFrom}`);
    if (b.itemsFrom) assert.ok(keys.has(b.itemsFrom), `${f.id}: itemsFrom ${b.itemsFrom}`);
    if (b.type === 'enclosures') for (const id of b.ids) assert.ok(getFormat(id), `${f.id}: enclosure ${id} not in library`);
  }
  if (f.cascadeFormatId) assert.ok(REGISTRY.includes(f.cascadeFormatId), `${f.id}: cascadeFormatId ${f.cascadeFormatId} not in ai/formats.js REGISTRY`);
}
assert.ok(FORMATS.length >= 30, `only ${FORMATS.length} formats`);
assert.ok(list({ contractAnnex: true }).length >= 5, 'contract annex formats');
const s = summary();
assert.equal(s.verified + s.pending, s.total);

// --- 2. render math ---------------------------------------------------------------------
const pbg = render('pbg_bg', { basic_value: 1350900, bank_name: 'State Bank of India' }, {});
assert.equal(pbg.values.pbg_amount, 135090, 'PBG = 10% of basic');
assert.match(pbg.values.pbg_amount_words, /^One Lakh Thirty-Five Thousand Ninety Only$/);
assert.ok(pbg.blocks.some((b) => b.type === 'para' && b.text.includes('₹ 1,35,090.00')), 'money formatted en-IN in prose');
assert.ok(pbg.missing.includes('validity_date') && !pbg.missing.includes('bank_name'));
assert.ok(pbg.blocks.some((b) => b.type === 'para' && b.text.includes(BLANK)), 'blank fields print as a rule line');
assert.equal(render('sd_bg', { basic_value: 1350900 }).values.sd_amount, 67545, 'SD = 5% of basic');
assert.equal(render('indemnity_bond', { basic_value: 1350900 }).values.indemnity_amount, 67545, 'Indemnity = 5% excl. GST');
assert.equal(render('pbg_bg', { basic_value: 1000, pbg_amount: 5 }).values.pbg_amount, 100, 'computed money cannot be overridden by input');
// context resolution: contract row wins, then po, then vendor
const ctx = { contract: { contract_no: 'HAL/AOD/CTR/25-26/0533/01', vendor_name: 'Bharat Avionics', basic_value: 1350900 }, po: { poNo: 'X' } };
const fromCtx = render('pbg_bg', {}, ctx);
assert.equal(fromCtx.values.contract_ref, 'HAL/AOD/CTR/25-26/0533/01');
assert.equal(fromCtx.fields.find((f) => f.key === 'contract_ref').source, 'context');
assert.equal(fromCtx.values.hal_division, 'Aircraft Overhaul');
// rowsFrom tables split lines and pipes; a compiled tender document lists real enclosures
const tec = render('tec_statement', { spec_rows: '1 | Magnification 4x | 4x | 3x | | | V2 fails' });
const tbl = tec.blocks.find((b) => b.type === 'table');
assert.deepEqual(tbl.rows[0], ['1', 'Magnification 4x', '4x', '3x', '', '', 'V2 fails']);
const tender = render('tender_document', {});
const encl = tender.blocks.filter((b) => b.type === 'list' && b.items.some((i) => i.includes('PM4-23C')));
assert.equal(encl.length, 1, 'tender document enclosures resolve to library entries');
assert.equal(tender.verified, false);
// unverified entries still render and carry the note
const adq = render('adequacy_statement', {});
assert.equal(adq.verified, false);
assert.ok(adq.note && adq.blocks.length > 0);
assert.throws(() => render('nope'), /Unknown format/);

// --- 3. Portal Hub coverage -------------------------------------------------------------
const portal = readFileSync(path.join(root, 'client/src/config/portalStructure.js'), 'utf8');
const actions = [...portal.matchAll(/\baction:\s*'([^']+)'/g)].map((m) => m[1]);
assert.ok(actions.length >= 30, 'hub modal actions not found');
const mapSrc = portal.slice(portal.indexOf('export const MODAL_ACTIONS'));
const entries = [...mapSrc.matchAll(/^\s{2}([a-z0-9_]+):\s*\{\s*kind:\s*'([a-z]+)'(?:,\s*(id|name):\s*'([a-z0-9_-]+)')?/gm)];
const modalMap = new Map(entries.map((m) => [m[1], { kind: m[2], ref: m[4] ?? null }]));
assert.ok(modalMap.size >= 30, `MODAL_ACTIONS parsed ${modalMap.size} entries`);
for (const a of new Set(actions)) {
  const spec = modalMap.get(a);
  assert.ok(spec, `hub action "${a}" has no MODAL_ACTIONS entry`);
  if (spec.kind === 'format') assert.ok(getFormat(spec.ref), `hub action "${a}" → format "${spec.ref}" not in library`);
  else if (spec.kind === 'tracker') assert.ok(TRACKERS[spec.ref], `hub action "${a}" → tracker "${spec.ref}" unknown`);
  else if (spec.kind === 'calculator') assert.ok(['ld', 'estimate'].includes(spec.ref), `hub action "${a}" → calculator "${spec.ref}" unknown`);
  else assert.ok(['dop', 'library', 'kpi'].includes(spec.kind), `hub action "${a}" has unknown kind ${spec.kind}`);
}
assert.ok(!/STANDARD_FORMATS_26/.test(portal), 'the client-side 26-format list is gone');

console.log(`formats.check: ${FORMATS.length} formats (${s.verified} verified, ${s.pending} pending HAL), ${new Set(actions).size} hub actions mapped, money OK`);
