// Quick LD-rule check: node server/ld.check.mjs
import assert from 'node:assert/strict';
import { computeLd } from './ld.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const due = '2026-01-01';
const geAfter = (days) => new Date(new Date(due).getTime() + days * DAY_MS).toISOString().slice(0, 10);
const rv = (daysLate, ldIc = 0, rvValue = 1000000, poValue = rvValue) =>
  computeLd({ rvValue, poValue, deliveryDueDate: due, gateEntryDate: geAfter(daysLate) }, ldIc);

const cases = [
  // [desc, actual, expected]
  ['on time -> 0 weeks, LD 0', rv(0), { ldWeeks: 0, ldAmount: 0, finalPayment: 1000000 }],
  ['early delivery -> 0 weeks', rv(-5), { ldWeeks: 0, ldAmount: 0 }],
  ['7 days -> 1 week (0.5%)', rv(7), { ldWeeks: 1, ldSupplyAmount: 5000 }],
  ['8 days -> 2 weeks (part thereof)', rv(8), { ldWeeks: 2, ldSupplyAmount: 10000 }],
  ['9 days -> 2 weeks, 1% not 1.3', rv(9), { ldWeeks: 2, ldSupplyAmount: 10000, finalPayment: 990000 }],
  ['14 days -> exactly 2 weeks', rv(14), { ldWeeks: 2, ldSupplyAmount: 10000 }],
  ['200 days -> capped at 10% of PO value', rv(200), { ldWeeks: 29, ldSupplyAmount: 145000, ldAmount: 100000, ldCapApplied: true }],
  ['manual I&C LD adds to total', rv(0, 5000), { ldAmount: 5000, finalPayment: 995000 }],
  ['a + b together hit the cap', rv(200, 50000), { ldAmount: 100000, ldCapApplied: true }],
  ['cap uses PO value, not RV value', rv(200, 0, 1000000, 4000000), { ldSupplyAmount: 145000, ldCap: 400000, ldAmount: 145000, ldCapApplied: false }]
];

let failed = 0;
for (const [desc, actual, expected] of cases) {
  try {
    for (const [k, v] of Object.entries(expected)) assert.equal(actual[k], v, `${desc}: ${k}`);
    console.log(`ok   ${desc}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${desc} — ${err.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
console.log(failed ? `${failed} case(s) failed` : 'All LD cases pass');
