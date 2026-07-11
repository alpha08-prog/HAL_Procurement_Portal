// Smoke test for the Module C noting workflow — the noting counterpart to server/ld.check.mjs.
// Runs against a throwaway DB (NOTING_DB env), so it never touches the dev store.
//   node server/noting/noting.check.mjs
import assert from 'node:assert';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NOTING_DB = join(mkdtempSync(join(tmpdir(), 'noting-')), 'test.db');

// Importing the router tree first proves every noting route module loads (import/syntax check).
await import('../routes/noting/index.js');
const { reseed } = await import('./seed.js');
reseed();
const { get } = await import('./db.js');
const {
  addNote, canSupervise, canView, decide, forward, isDirectHead, priorHolders, sendBack, visibleFileIds
} = await import('./workflow.js');

const m = (id) => get('SELECT * FROM members WHERE id = ?', id);
const f = (id) => get('SELECT * FROM files WHERE id = ?', id);
const n = (id) => get('SELECT * FROM notes WHERE id = ?', id);

// --- Seed sanity ---
assert.equal(get('SELECT COUNT(*) AS c FROM members').c, 12, 'members seeded');
assert.equal(get('SELECT COUNT(*) AS c FROM files').c, 5, 'files seeded');
assert.equal(get('SELECT COUNT(*) AS c FROM org_units').c, 16, 'org units seeded');

// --- Tenure-aware supervision (email 19/20) ---
const rao = m(2);      // current HOD(IMM), heads unit 4
const former = m(12);  // predecessor HOD, headed unit 4 during 2021–2024
const stores = m(8);   // heads unit 14 (Stores) — unrelated to IMM
const gm = m(1);       // GM(AOD), heads unit 3 (division, ancestor of IMM)
assert.equal(canSupervise(rao, f(1)), true, 'current HOD sees a subtree file (2026)');
assert.equal(canSupervise(rao, f(4)), true, 'current HOD sees a predecessor-era file (2023)');
assert.equal(canSupervise(former, f(4)), true, 'former HOD sees a file from his tenure');
assert.equal(canSupervise(former, f(1)), false, 'former HOD does NOT see a post-tenure file');
assert.equal(canSupervise(stores, f(1)), false, 'an unrelated head does not supervise');

// --- Graded classification (email 3), on file 1 (unit 9), before any routing ---
const base = n(1); // normal, initiator 5, participants = {5}
assert.equal(canView({ ...base, classification: 'normal' }, stores), true, 'normal → anyone');
assert.equal(canView({ ...base, classification: 'confidential' }, gm), true, 'confidential → ancestor head (GM)');
assert.equal(canView({ ...base, classification: 'confidential' }, rao), true, 'confidential → dept head');
assert.equal(canView({ ...base, classification: 'secret' }, gm), false, 'secret → distant GM blocked');
assert.equal(canView({ ...base, classification: 'secret' }, rao), true, 'secret → direct dept head');
assert.equal(isDirectHead(rao, f(1).initiator_unit_id), true, 'dept head is a direct head of the section');
assert.equal(canView({ ...base, classification: 'top_secret' }, rao), false, 'top_secret → no head bypass');
assert.equal(canView({ ...base, classification: 'top_secret' }, m(5)), true, 'top_secret → participant passes');

// --- Report visibility set (email 24–27) ---
assert.equal(visibleFileIds(rao).size, 5, 'dept head sees the whole IMM subtree');
assert.equal(visibleFileIds(stores).size, 0, 'uninvolved member sees nothing in reports');
const mine = visibleFileIds(m(5));
assert.ok(mine.has(1) && mine.has(3) && !mine.has(2), 'a plain user sees only files he is in');

// --- Routing: forward, send-back-to-previous-only, reopen draft ---
forward(n(1), m(5), 6, ''); // initiator 5 -> officer 6
assert.ok(priorHolders(1).has(5), 'send-back targets include a prior holder');
assert.throws(() => sendBack(n(1), m(6), 8, ''), /previous member/, 'send-back to a non-prior member is rejected');
sendBack(n(1), m(6), 5, ''); // back to the initiator (a prior holder)
assert.equal(n(1).custodian_id, 5, 'send-back moves custody');
assert.equal(n(1).status, 'draft', 'send-back to the initiator reopens the draft');

// --- Multi-note lifecycle (email 13, 21, 23) ---
forward(n(1), m(5), 6, '');
decide(n(1), m(6), 'approve'); // provisioning approved — NOT final
assert.equal(f(1).status, 'open', 'intermediate approval keeps the file open');
assert.ok(get('SELECT COUNT(*) AS c FROM cabinet WHERE file_pk = 1').c > 0, 'closure fills the cabinet');

const n2 = addNote(f(1), m(5), { stageId: 'tender_doc', title: 'Tender Document' });
assert.equal(n2.seq, 2, 'next note is N2');
assert.ok(n2.ref_no.endsWith('/N2'), 'connected reference continues the File ID');
assert.ok(f(1).tendering_start, 'reaching tendering stamps tendering_start');
assert.equal(get('SELECT COUNT(*) AS c FROM cabinet WHERE file_pk = 1').c, 0, 'creating the next note clears the prompt');

const n3 = addNote(f(1), m(5), { stageId: 'po', title: 'Purchase Order' });
decide(n(n3.id), m(5), 'approve'); // final stage (po → no next stage)
assert.equal(f(1).status, 'closed', 'final-stage approval closes the file');

console.log('noting.check: all assertions passed ✓');
