// Module F regression check — the deterministic path of the live cascade.
//   node server/ai/ai.check.mjs
// Throwaway AI_CASES_DB; Ollama pointed at a closed port so the language model is "down"
// and every note still comes out with its section marked.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'ai-cases-'));
for (const k of ['AI_CASES_DB', 'NOTING_DB', 'APPROVALS_DB', 'REQUISITIONS_DB', 'CONTRACTS_DB']) process.env[k] = join(tmpDir, `${k.toLowerCase()}.db`);
process.env.OLLAMA_URL = 'http://127.0.0.1:9';

const rules = await import('./rules.js');
const graph = await import('./cascadeGraph.js');
const store = await import('./caseStore.js');

// --- rules: money and branches, never the model ---
assert.equal(rules.sd(1350900), 67545, 'SD is 5% of basic');
assert.equal(rules.pbg(1350900), 135090, 'PBG is 10% of basic');
assert.equal(rules.indemnity(1594065), 79703.25, 'indemnity is 5% of the PO value');
assert.equal(rules.ld(1000000, 2.2, 1000000), 15000, 'LD is 0.5% per week or part thereof (3 weeks)');
assert.equal(rules.ld(1000000, 30, 1000000), 100000, 'LD is capped at 10% of the PO value');
assert.equal(rules.variance(2000000, 1594065), 25.47, 'L1 variance vs estimate');
assert.deepEqual(rules.savings(2000000, 1594065), [405935, 20.3], 'savings amount and percent');
const dop = rules.dopCfaLevel({ validOffers: 2, value: 1594065 });
assert.equal(dop.pending, true, 'the CFA level is pending until the DOP bands are supplied');
assert.equal(dop.level, null, 'no level is invented');
assert.equal(dop.status, 'bands_pending_client', 'the pending status comes from ai/dop2025.json');
assert.match(dop.clause, /Annex-3-B-2/, 'the clause is still derivable from the offer count');
assert.equal(graph.CASCADE_NODES.provisioning.stageNo, null, 'provisioning is pre-tender (stage null), as in ai/cascade.py');
assert.equal(graph.CASCADE_NODES.tender_opened.stageNo, 1, 'tender opened is stage 1');
assert.equal(graph.CASCADE_NODES.post_emd.stageNo, 2, 'after EMD is stage 2');

// --- walk the NVB case with the model down ---
const indentor = { id: 'U001', name: 'Indent Cell', role: 'indentor' };
const maker = { id: 'U002', name: 'Maker', role: 'purchase_maker' };
const kase = store.createCase({ caseRef: 'CAR/25/229', title: 'NVB', sourceCase: 'nvb', user: indentor });
assert.equal(kase.nodeId, 'provisioning', 'a new case starts at provisioning');

let out = await store.raiseNote(kase.id, 'emd', { user: maker });
assert.equal(out.ok, false, 'a note the sheet does not allow here is refused');
out = await store.raiseNote(kase.id, 'provisioning', { user: maker });
assert.equal(out.code, 403, 'the Tendering agency cannot raise the indent');
out = await store.raiseNote(kase.id, 'provisioning', { user: indentor });
assert.ok(out.ok && !out.skipped, 'the indentor raises the provisioning note');
assert.equal(out.result.slm.ok, false, 'the model was down…');
assert.match(out.result.newSection, /SLM_UNAVAILABLE|SLM_ERROR/, '…and the section says so instead of failing');
assert.equal(out.kase.nodeId, 'tender_opened', 'the case advances to tender opened');
assert.equal(out.handoverNeeded, 'Tendering', 'the next stage belongs to Tendering');

let h = store.handOver(kase.id, { user: maker });
assert.ok(h.ok && h.kase.holdingAgency === 'Tendering', 'the maker takes the file over');
out = await store.raiseNote(kase.id, 'emd', { user: maker }); assert.ok(out.ok, `EMD note: ${out.error ?? 'ok'}`);
out = await store.raiseNote(kase.id, 'tec_req', { user: maker }); assert.ok(out.ok, `TEC request: ${out.error ?? 'ok'}`);
assert.equal(out.handoverNeeded, 'Indenting', 'the TEC stage belongs to Indenting');
h = store.handOver(kase.id, { user: indentor }); assert.ok(h.ok, 'the indentor takes it back');
out = await store.raiseNote(kase.id, 'tec_report', { user: indentor }); assert.ok(out.ok, `TEC report: ${out.error ?? 'ok'}`);
h = store.handOver(kase.id, { user: maker }); assert.ok(h.ok, 'back to the maker');
out = await store.raiseNote(kase.id, 'pbo', { user: maker }); assert.ok(out.ok, `price bids opened: ${out.error ?? 'ok'}`);

out = await store.raiseNote(kase.id, 'pp', { user: maker });
assert.equal(out.code, 428, 'PNC is advised (L1 above estimate), so a straight PP needs an override');
out = await store.raiseNote(kase.id, 'pp', { user: maker, override: true });
assert.ok(out.ok && out.result.overridden, `the override is recorded on the note: ${out.error ?? 'ok'}`);
assert.equal(out.kase.nodeId, 'post_pp', 'the case is at post_pp');

// post_pp gate (server/ai/gates.js): with no noting proposal linked there is no approved PP on
// record, so the PO needs an explicit override — which is then recorded on the note.
out = await store.raiseNote(kase.id, 'po', { user: maker });
assert.equal(out.code, 428, 'a PO without an approved Purchase Proposal on the noting side is gated');
assert.equal(out.gate, 'post_pp');
out = await store.raiseNote(kase.id, 'po', { user: maker, override: true, fields: { po_no: 'IMM/PO/99-99/0000' } });
assert.equal(out.code, 422, 'a PO number that is not in the register is refused');
out = await store.raiseNote(kase.id, 'po', { user: maker, override: true });
assert.ok(out.ok, `the seeded PO number for the NVB tender passes: ${out.error ?? 'ok'}`);
assert.match(out.result.overridden, /gate post_pp/, 'the gate override is recorded on the note');
assert.equal(out.kase.data.po_no, 'IMM/PO/25-26/0533', 'the PO number comes from the register, not a placeholder');
assert.equal(out.kase.nodeId, 'post_po', 'the case is at post_po');

const before = store.loadCase(kase.id).notes.length;
const rb = store.rollbackNote(kase.id, 'po', maker);
assert.ok(rb.ok, `the PO note rolls back: ${rb.error ?? 'ok'}`);
assert.equal(rb.kase.nodeId, 'post_pp', 'the case returns to the node before the note');
assert.equal(rb.kase.notes.length, before - 1, 'the voided note disappears from the file');
assert.equal(rb.kase.path.at(-1), 'pp', 'the case object is the one before the PO note');
assert.ok(rb.kase.events.some((e) => e.kind === 'rolled_back'), 'the rollback is on the custody trail');
const again = store.rollbackNote(kase.id, 'po', maker);
assert.equal(again.ok, false, 'nothing is left to roll back');

const orphan = store.createCase({ caseRef: 'X', title: 'orphan', sourceCase: 'nvb', user: indentor });
assert.ok(store.deleteCase(orphan.id).ok, 'a case with no notes can be removed');
assert.equal(store.deleteCase(kase.id).ok, false, 'a case with notes is never deleted');

console.log('ai.check: all assertions passed ✓');
