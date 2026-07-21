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
const { deptCodeFor, nextFileId, nextTxnId } = await import('./refs.js');
const {
  addNote, canSupervise, canView, decide, forward, isDirectHead, normComment,
  priorHolders, retrieve, sendBack, visibleFileIds
} = await import('./workflow.js');

const m = (id) => get('SELECT * FROM members WHERE id = ?', id);
const f = (id) => get('SELECT * FROM files WHERE id = ?', id);
const n = (id) => get('SELECT * FROM notes WHERE id = ?', id);
const cabinetOf = (filePk) =>
  new Set(
    (get(`SELECT GROUP_CONCAT(member_id) AS ids FROM cabinet WHERE file_pk = ?`, filePk).ids || '')
      .split(',').filter(Boolean).map(Number)
  );

// --- Seed sanity ---
assert.equal(get('SELECT COUNT(*) AS c FROM members').c, 12, 'members seeded');
assert.equal(get('SELECT COUNT(*) AS c FROM files').c, 10, 'files seeded');
assert.equal(get('SELECT COUNT(*) AS c FROM notes').c, 12, 'notes seeded');
assert.equal(get('SELECT COUNT(*) AS c FROM org_units').c, 16, 'org units seeded');

// --- Connected id generators (MAX-based, not COUNT) + dept resolution ---
assert.equal(deptCodeFor(9), 'IMM', 'section resolves to its department');
assert.equal(deptCodeFor(16), 'SYS', 'a department resolves to itself');
assert.equal(deptCodeFor(3), 'AOD', 'a division falls back to its own code (not its parent complex)');
assert.ok(nextFileId('IMM').endsWith('/0009'), 'file id = max existing suffix + 1');
assert.ok(nextTxnId().endsWith('-000012'), 'txn id = max existing suffix + 1');

// --- Comment normalisation (email: "." "," "*" count as no comment) ---
assert.equal(normComment(' . ', 'Concurred & Forwarded'), 'Concurred & Forwarded', 'symbols-only comment auto-fills');
assert.equal(normComment('', 'Concurred & Forwarded'), 'Concurred & Forwarded', 'empty comment auto-fills');
assert.equal(normComment('Noted, pl. expedite.', 'X'), 'Noted, pl. expedite.', 'a real comment stands');

// --- Tenure-aware supervision (email 19/20/21) ---
const rao = m(2);      // current HOD(IMM), heads unit 4
const former = m(12);  // predecessor HOD, headed unit 4 during 2021–2024
const stores = m(8);   // heads unit 14 (Stores) — unrelated to IMM
const gm = m(1);       // GM(AOD), heads unit 3 (division, ancestor of IMM)
assert.equal(canSupervise(rao, f(1)), true, 'current HOD sees a subtree file (2026)');
assert.equal(canSupervise(rao, f(4)), true, 'current HOD sees a predecessor-era file (2023)');
assert.equal(canSupervise(former, f(4)), true, 'former HOD sees a file from his tenure');
assert.equal(canSupervise(former, f(1)), false, 'former HOD does NOT see a post-tenure file');
assert.equal(canSupervise(stores, f(1)), false, 'an unrelated head does not supervise');

// --- Graded classification (email 3), on file 3's note (participants = maker+officer) ---
const base = n(4);
assert.equal(canView({ ...base, classification: 'normal' }, stores), true, 'normal → anyone');
assert.equal(canView({ ...base, classification: 'confidential' }, gm), true, 'confidential → ancestor head (GM)');
assert.equal(canView({ ...base, classification: 'confidential' }, rao), true, 'confidential → dept head');
assert.equal(canView({ ...base, classification: 'secret' }, gm), false, 'secret → distant GM blocked');
assert.equal(canView({ ...base, classification: 'secret' }, rao), true, 'secret → direct dept head');
assert.equal(isDirectHead(rao, f(3).initiator_unit_id), true, 'dept head is a direct head of the section');
assert.equal(canView({ ...base, classification: 'top_secret' }, rao), false, 'top_secret → no head bypass');
assert.equal(canView({ ...base, classification: 'top_secret' }, m(5)), true, 'top_secret → participant passes');
assert.equal(canView(n(8), rao), false, 'seeded top_secret file hidden even from HOD');
assert.equal(canView(n(8), m(4)), true, 'seeded top_secret file visible to routed CM');

// --- Report visibility set, graded per note (email 24–27) ---
assert.equal(visibleFileIds(rao).size, 8, 'HOD sees the IMM subtree except the top_secret case');
assert.equal(visibleFileIds(gm).size, 9, 'GM sees the whole division except the top_secret case');
assert.equal(visibleFileIds(stores).size, 0, 'uninvolved member sees nothing in reports');
assert.equal(visibleFileIds(former).size, 1, 'former HOD sees only his tenure');
const mine = visibleFileIds(m(5));
assert.ok(mine.has(1) && mine.has(3) && mine.has(7) && !mine.has(2), 'a plain user sees exactly his own cases');
const admins = visibleFileIds(m(10));
assert.ok(admins.size === 1 && admins.has(8), 'SYS head sees only the SYS-dept file');

// --- Routing: forward (symbols-only comment), send-back-to-previous-only, reopen draft ---
forward(n(6), m(6), 5, ' . '); // officer's draft (file 5) -> maker, symbols-only comment
const lastStep = get('SELECT * FROM routing_steps WHERE note_id = 6 ORDER BY seq DESC LIMIT 1');
assert.equal(lastStep.comment, 'Concurred & Forwarded', 'symbols-only forward comment auto-fills');
assert.ok(priorHolders(6).has(6), 'send-back targets include a prior holder');
assert.throws(() => sendBack(n(6), m(5), 8, ''), /previous member/, 'send-back to a non-prior member is rejected');
sendBack(n(6), m(5), 6, ''); // back to the initiator (a prior holder)
assert.equal(n(6).custodian_id, 6, 'send-back moves custody');
assert.equal(n(6).status, 'draft', 'send-back to the initiator reopens the draft');

// --- Decision guard: an unrouted draft cannot be decided ---
assert.throws(() => decide(n(6), m(6), 'approve'), /draft/, 'self-approval of an unrouted draft is blocked');

// --- Stage validation ---
assert.throws(() => addNote(f(3), m(5), { stageId: 'bogus_stage' }), /Unknown stage/, 'unknown stage id is rejected');

// --- Multi-note lifecycle + cabinet union (email 13, 16, 17, 21, 23) ---
assert.equal(cabinetOf(1).size, 3, 'seeded cabinet rows for the open NVB case');
const n3 = addNote(f(1), m(5), { stageId: 'emd', title: 'EMD Stage Acceptance' });
assert.equal(n3.seq, 3, 'next note is N3');
assert.ok(n3.ref_no.endsWith('/N3'), 'connected reference continues the File ID');
assert.equal(cabinetOf(1).size, 0, 'creating the next note clears the cabinet prompt');
forward(n(n3.id), m(5), 2, '');
decide(n(n3.id), m(2), 'approve'); // emd approved — NOT final
assert.equal(f(1).status, 'open', 'intermediate approval keeps the file open');
assert.ok(cabinetOf(1).has(6), 'cabinet keeps earlier-note routers (union across notes)');

// --- Retrieve: only the latest note of the file ---
assert.throws(() => retrieve(n(11), m(2)), /later note/, 'retrieving a superseded note is blocked');

// --- PO amendment: the one note addable to a CLOSED file, reopening it ---
assert.throws(() => addNote(f(10), m(5), { stageId: 'emd' }), /closed/, 'a closed file takes no ordinary note');
const amd = addNote(f(10), m(5), { stageId: 'po_amendment', title: 'PO Amendment 1' });
assert.equal(f(10).status, 'open', 'PO amendment reopens the closed case');
forward(n(amd.id), m(5), 2, '');
decide(n(amd.id), m(2), 'approve'); // po_amendment has no next stage
assert.equal(f(10).status, 'closed', 'approving the amendment closes the file again');
assert.ok(cabinetOf(10).has(6), 'final cabinet still includes the N1/N2-only router');

console.log('noting.check: all assertions passed ✓');
