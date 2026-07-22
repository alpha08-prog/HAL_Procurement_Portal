// Seeds the STC library (72 clauses + the 71×8 Contract Clauses Matrix, both converted
// from the client's attachments into seed/*.json) and a small demo storyline:
//   - clause "Liquidated Damages" already amended to v2 (history drawer has content)
//   - one FINALISED contract (register + QR + verify demo) — NVB case, classification 'restricted'
//   - one DRAFT contract (edit → finalise demo) — ergonomic seating case
// seedIfEmpty() runs on boot; running this file directly (node server/contracts/seed.js)
// force-reseeds. Contract fixtures come from server/mock/pos.json + vendors.json.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, get, run, nowISO } from './db.js';
import { generateContract, finaliseContract } from './generate.js';

const here = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(here, 'seed', f), 'utf8'));

// Demo actors mirror server/noting/seed.js MEMBERS (identity.js resolves live requests
// from the same directory; seeds just stamp the equivalent literal).
const CM = { name: 'Gaurav Yadav', pb: 'PB-41060', designation: 'Chief Manager (Purchase)', dept: 'Integrated Material Management', division: 'Aircraft Overhaul Division' };
const MAKER = { name: 'Asha Mhatre', pb: 'PB-44731', designation: 'Purchase Maker', dept: 'Integrated Material Management', division: 'Aircraft Overhaul Division' };

function insertAll() {
  const matrix = load('matrix.json');
  const clauses = load('clauses.json');

  for (const t of matrix.contractTypes) run('INSERT INTO contract_types(id,label,sort) VALUES(?,?,?)', t.id, t.label, t.sort);
  for (const c of clauses)
    run(
      `INSERT INTO clauses(id,matrix_no,docx_no,title,body,boilerplate,guideline,optional_extra) VALUES(?,?,?,?,?,?,?,?)`,
      c.docxNo, c.matrixNo, c.docxNo, c.title, c.body, c.boilerplate ? 1 : 0, c.guideline, c.optionalExtra ? 1 : 0
    );
  for (const [matrixNo, cells] of Object.entries(matrix.cells)) {
    const clause = get('SELECT id FROM clauses WHERE matrix_no = ?', Number(matrixNo));
    for (const [typeId, value] of Object.entries(cells))
      run('INSERT INTO clause_matrix(clause_id,contract_type_id,value) VALUES(?,?,?)', clause.id, typeId, value);
  }

  // Amendment history demo: LD clause revised after legal vetting → v2, prior text preserved.
  const ld = get('SELECT * FROM clauses WHERE matrix_no = 12');
  run(
    `INSERT INTO clause_versions(clause_id,version,prior_body,changed_by_name,changed_by_pb,changed_at,change_note,reference_doc)
     VALUES(?,?,?,?,?,?,?,?)`,
    ld.id, 1, ld.body, 'Administrator', 'PB-40000', '2026-06-18',
    'LD recovery made explicit on statutory levies + freight/insurance; wording aligned to Purchase Manual Issue-4.',
    'Legal Vetting Ref LGL/2026/014 dt. 15-06-2026'
  );
  run(
    `UPDATE clauses SET body = ?, version = 2, updated_by = ?, updated_at = ? WHERE id = ?`,
    ld.body + '\nRecovery of liquidated damages shall be effected preferably from the running bills of the SUPPLIER, failing which from the Security Deposit/Performance Bank Guarantee, without prejudice to any other remedy available to the BUYER under the Contract.',
    'Administrator (PB-40000)', '2026-06-18', ld.id
  );

  // Finalised contract — NVB case, ticks EMD/PBG/SD (case-to-case extras) + a custom clause.
  const emd = get('SELECT id FROM clauses WHERE matrix_no = 13').id;
  const pbg = get('SELECT id FROM clauses WHERE matrix_no = 14').id;
  const sd = get('SELECT id FROM clauses WHERE matrix_no = 15').id;
  const nvb = generateContract(
    {
      tenderNo: 'GEM/2025/B/6638737',
      poNo: 'IMM/PO/25-26/0533',
      contractTypeId: 'supply_other',
      classification: 'restricted',
      validity: '12 months from the date of contract; warranty 24 months from acceptance',
      periodTo: '2026-09-05',
      extraClauseIds: [emd, pbg, sd],
      customClauses: [
        {
          title: 'Embedded Software & Firmware Escrow',
          body: 'The SUPPLIER shall deposit the golden image of the binocular firmware, together with programming fixtures and flashing instructions, with HAL or an escrow agent nominated by HAL within 30 days of first delivery. The escrow shall be released to the BUYER on the SUPPLIER ceasing to support the product or on termination of this contract for default.'
        }
      ],
      formatIds: ['pbg_bg', 'integrity_omnibus', 'nda_e7'],
      smartContract: true
    },
    CM
  );
  finaliseContract(nvb.contract.id, CM);

  // Draft contract — seating case, untouched selections (the edit → finalise demo path).
  generateContract(
    { tenderNo: 'GEM/2025/B/6811205', poNo: 'IMM/PO/25-26/0457', contractTypeId: 'supply_general' },
    MAKER
  );
}

const TABLES = [
  'contract_formats', 'contract_items', 'contract_clauses', 'contracts',
  'clause_matrix', 'clause_versions', 'clauses', 'contract_types'
];

export function seedIfEmpty() {
  const n = get('SELECT COUNT(*) AS c FROM clauses').c;
  if (n === 0) insertAll();
}

export function reseed() {
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const t of TABLES) run(`DELETE FROM ${t}`);
  db.exec('PRAGMA foreign_keys = ON;');
  insertAll();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  reseed();
  console.log(
    'Contracts store reseeded:',
    get('SELECT COUNT(*) AS c FROM clauses').c, 'clauses,',
    get('SELECT COUNT(*) AS c FROM clause_matrix').c, 'matrix cells,',
    get('SELECT COUNT(*) AS c FROM contracts').c, 'contracts.'
  );
}
