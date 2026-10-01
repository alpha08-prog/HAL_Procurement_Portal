// Regression check for the in-memory claims store. Run: node server/claims/claims.check.mjs
import assert from 'node:assert/strict';
const { claims, createClaim, transitionClaim, discrepancies, summary, nextClaimNo, financialYear, listClaims, CLAIM_TRANSITIONS } = await import('./store.js');
const { db } = await import('../store.js');

assert.equal(claims.length, 4, 'four seeded claims');
assert.ok(claims.every((c) => db.rvs.some((r) => r.rvNo === c.rvNo)), 'every seeded claim hangs off a fixture RV');
assert.equal(financialYear('2026-05-02'), '26-27');
assert.equal(financialYear('2026-03-31'), '25-26');
assert.equal(nextClaimNo('2026-05-10'), 'CLM/26-27/003', 'MAX+1 within the financial year');
assert.equal(nextClaimNo('2026-02-10'), 'CLM/25-26/003');

const joined = listClaims();
assert.ok(joined.every((c) => c.vendorName && c.item && Array.isArray(c.availableActions)), 'joined rows carry RV/vendor facts');
assert.deepEqual(joined.find((c) => c.claimNo === 'CLM/26-27/002').availableActions.map((a) => a.id), ['receive']);
assert.deepEqual(joined.find((c) => c.claimNo === 'CLM/26-27/001').availableActions.map((a) => a.id), ['dispatch', 'close']);
assert.equal(joined.find((c) => c.claimNo === 'CLM/25-26/001').availableActions.length, 0, 'a closed claim has no actions');

const stores = { name: 'S. Kulkarni', role: 'stores_inspection' };
const maker = { name: 'Asha Mhatre', role: 'purchase_maker' };
const desk = { name: 'M. Iyer', role: 'payment_desk' };

assert.throws(() => createClaim({ rvNo: 'NOPE/1', type: 'shortage', qty: 1, reason: 'x' }, stores), /Unknown RV/);
assert.throws(() => createClaim({ rvNo: 'COM/26/148', type: 'weird', qty: 1, reason: 'x' }, stores), /type must be/);
assert.throws(() => createClaim({ rvNo: 'COM/26/148', type: 'shortage', qty: 0, reason: 'x' }, stores), /qty/);
const c = createClaim({ rvNo: 'COM/26/148', type: 'rejection', qty: 3, reason: 'Armrest castings cracked', actionSought: 'Replacement' }, stores);
assert.match(c.claimNo, /^CLM\/\d{2}-\d{2}\/\d{3}$/);
assert.equal(c.poNo, 'IMM/PO/25-26/0457', 'PO taken from the RV, never from the caller');
assert.equal(c.status, 'raised');
assert.equal(claims.length, 5);

assert.throws(() => transitionClaim(c.claimNo, 'receive', {}, stores), /is raised/, 'order enforced');
assert.throws(() => transitionClaim(c.claimNo, 'dispatch', { gatePassNo: 'RMGP/26/090' }, maker), /Only stores_inspection/, 'role enforced');
assert.throws(() => transitionClaim(c.claimNo, 'dispatch', {}, stores), /gatePassNo is required/, 'gate pass required');
const d = transitionClaim(c.claimNo, 'dispatch', { gatePassNo: 'RMGP/26/090' }, stores);
assert.equal(d.status, 'dispatched');
assert.equal(d.gatePassNo, 'RMGP/26/090');
const r = transitionClaim(c.claimNo, 'receive', { remark: 'Replacements received' }, stores);
assert.equal(r.status, 'received');
assert.throws(() => transitionClaim(c.claimNo, 'close', { settlement: 'ok' }, desk), /Only/, 'payment desk cannot close');
const z = transitionClaim(c.claimNo, 'close', { settlement: 'Replacement accepted', creditNoteNo: '' }, maker);
assert.equal(z.status, 'closed');
assert.equal(z.history.length, 4);
assert.equal(z.creditNoteNo, null);
assert.ok(Object.keys(CLAIM_TRANSITIONS).every((k) => CLAIM_TRANSITIONS[k].by.includes('admin')), 'admin may drive every transition');

const disc = discrepancies();
assert.ok(disc.some((x) => x.rvNo === 'COM/26/148' && x.kind === 'value_shortfall'), 'RV accepted below invoice is a discrepancy');
assert.equal(disc.find((x) => x.rvNo === 'COM/26/148').claimNo, c.claimNo, 'the discrepancy names its claim');
const s = summary();
assert.equal(s.total, 5);
assert.equal(s.byStatus.closed, 2);

console.log(`claims.check: ${claims.length} claims, transitions/roles/discrepancies OK`);
