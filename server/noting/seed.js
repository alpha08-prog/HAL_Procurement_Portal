// Seeds a representative HAL org tree + members (mirroring the login accounts by pb,
// plus the org figures the AI notes reference: GM(AOD), FCA, CM(Purchase)) and a
// couple of sample files/notes. seedIfEmpty() runs on boot; running this file
// directly (node server/noting/seed.js) force-reseeds. Swap in real HAL org data later.
import { fileURLToPath } from 'node:url';
import { db, get, run } from './db.js';

// --- Organisation: Corporate > Complex > Division > Department > Section ---
const ORG = [
  [1, 'Hindustan Aeronautics Limited', 'corporate', 'HAL', null],
  [2, 'Nashik Complex', 'complex', 'NC', 1],
  [3, 'Aircraft Overhaul Division', 'division', 'AOD', 2],
  [4, 'Integrated Material Management', 'department', 'IMM', 3],
  [5, 'Finance (CFA)', 'department', 'FIN', 3],
  [6, 'Quality & Inspection', 'department', 'QI', 3],
  [7, 'User Department', 'department', 'USR', 3],
  [16, 'System Administration', 'department', 'SYS', 3],
  [8, 'Provisioning', 'section', 'IMM-PRV', 4],
  [9, 'Purchase (Indigenous)', 'section', 'IMM-PUR-I', 4],
  [10, 'Purchase (Import)', 'section', 'IMM-PUR-F', 4],
  [11, 'Bill Passing & Payment', 'section', 'IMM-BP', 4],
  [12, 'Internal Audit', 'section', 'FIN-IA', 5],
  [13, 'Concurrence', 'section', 'FIN-CON', 5],
  [14, 'Stores & Inspection', 'section', 'QI-SI', 6],
  [15, 'Indenting', 'section', 'USR-IND', 7]
];

// [id, pb, name, email, designation, app_role, section_id, heads_unit_id]
// pb/email match server/mock/users.json so the JWT user resolves to a member.
const MEMBERS = [
  [1, 'PB-40001', 'A. K. Sharma', null, 'General Manager (AOD)', null, 3, 3],
  [2, 'PB-40015', 'V. Rao', 'hod@hal.local', 'HOD (IMM)', 'hod_imm', 4, 4],
  [3, 'PB-40020', 'S. Menon', null, 'FCA (Finance)', null, 5, 5],
  [4, 'PB-41060', 'Gaurav Yadav', null, 'Chief Manager (Purchase)', null, 9, 9],
  [5, 'PB-44731', 'Asha Mhatre', 'maker@hal.local', 'Purchase Maker', 'purchase_maker', 9, null],
  [6, 'PB-44821', 'R. Deshpande', 'officer@hal.local', 'Purchase Officer', 'purchase_officer', 9, null],
  [7, 'PB-48990', 'M. Iyer', 'desk@hal.local', 'Payment Desk Officer', 'payment_desk', 11, 11],
  [8, 'PB-47210', 'S. Kulkarni', 'stores@hal.local', 'Stores & Inspection', 'stores_inspection', 14, 14],
  [9, 'PB-51002', 'Indent Cell', 'indentor@hal.local', 'Indentor', 'indentor', 15, null],
  [10, 'PB-40000', 'Administrator', 'admin@hal.local', 'System Administrator', 'admin', 16, 16],
  [11, 'PB-49999', 'QA Test', 'test@hal.local', 'QA / Demo', 'admin', 16, null],
  // Predecessor HOD (IMM), superannuated — no current posting (section/heads NULL). Powers
  // the tenure/predecessor visibility demo: he headed IMM (unit 4) in 2021–2024.
  [12, 'PB-40010', 'K. Nair (Retd.)', null, 'Former HOD (IMM)', null, null, null]
];

// [member_id, org_unit_id, role_in_unit, from_date, to_date]. Current staff get an open
// posting; the predecessor gets a CLOSED head posting so tenure-window visibility can be
// exercised (a former head still sees files from his tenure; a current head sees all).
const POSTINGS = [
  ...MEMBERS.filter((m) => m[6] != null).map((m) => [m[0], m[6], m[7] ? 'head' : 'member', '2024-06-01', null]),
  [12, 4, 'head', '2021-01-01', '2024-05-31']
];

// [id, file_id, title, kind, car_no, standalone, initiator_id, initiator_unit_id,
//  parent_file_id, line_no, status, provisioning_start, tendering_start, created_at, closed_at]
// Files 3 & 5 are line-wise child PPs of the NVB case (file 1) — one MPR/CAR, many L1 lines.
// File 4 is the predecessor-era historical case (initiated by the former HOD, id 12).
const FILES = [
  [1, 'AOD/IMM/2026/0001', 'Procurement of Night Vision Binocular (NVB)', 'CAR', 'CAR/25/229', 0, 5, 9, null, null, 'open', '2026-05-02', '2026-05-18', '2026-05-02', null],
  [2, 'AOD/IMM/2026/0002', 'Purchase of office furniture — administrative approval', 'standalone', null, 1, 6, 9, null, null, 'open', null, null, '2026-06-10', null],
  [3, 'AOD/IMM/2026/0003', 'NVB — Purchase Proposal (Line 1: M/s Optic Systems)', 'CAR', 'CAR/25/229', 0, 5, 9, 1, 'Line 1 — M/s Optic Systems', 'open', '2026-05-02', '2026-05-18', '2026-06-01', null],
  [4, 'AOD/IMM/2023/0001', 'IMM predecessor-era procurement (historical)', 'CAR', 'CAR/23/101', 0, 12, 4, null, null, 'closed', '2023-06-01', '2023-06-20', '2023-06-01', '2023-09-01'],
  [5, 'AOD/IMM/2026/0004', 'NVB — Purchase Proposal (Line 2: M/s Bharat Optics)', 'CAR', 'CAR/25/229', 0, 6, 9, 1, 'Line 2 — M/s Bharat Optics', 'open', '2026-05-02', '2026-05-18', '2026-06-05', null]
];

// [id, file_pk, seq, ref_no, txn_id, title, stage_id, source, body, classification,
//  status, initiator_id, custodian_id, decision, decided_by, created_at, closed_at]
const NOTES = [
  [1, 1, 1, 'AOD/IMM/2026/0001/N1', 'TXN-2026-000001', 'Provisioning Note', 'provisioning', 'ai',
    'Provisioning note for procurement of Night Vision Binocular against CAR/25/229. Estimated value ₹15,94,065. Drafted by the AI noting pipeline; pending routing for approval.',
    'normal', 'draft', 5, 5, null, null, '2026-05-02', null],
  [2, 2, 1, 'AOD/IMM/2026/0002/N1', 'TXN-2026-000002', 'Administrative Approval Note', null, 'manual',
    'Standalone administrative note seeking approval for purchase of office furniture for the IMM section. No MPR/CAR/SPR/CPR reference.',
    'normal', 'draft', 6, 6, null, null, '2026-06-10', null],
  [3, 3, 1, 'AOD/IMM/2026/0003/N1', 'TXN-2026-000003', 'Purchase Proposal Note', 'pp', 'ai',
    'Purchase Proposal for the Night Vision Binocular case, line-wise L1 M/s Optic Systems. Spun off from CAR/25/229 as a child file.',
    'normal', 'routed', 5, 6, null, null, '2026-06-01', null],
  [4, 4, 1, 'AOD/IMM/2023/0001/N1', 'TXN-2023-000001', 'Provisioning Note (historical)', 'provisioning', 'manual',
    'Historical provisioning note initiated under the previous HOD (IMM). Retained for predecessor-tenure visibility.',
    'normal', 'approved', 12, 12, 'approved', 12, '2023-06-01', '2023-09-01'],
  [5, 5, 1, 'AOD/IMM/2026/0004/N1', 'TXN-2026-000004', 'Purchase Proposal Note (Line 2)', 'pp', 'manual',
    'Second line-wise Purchase Proposal for the NVB case — Line 2, L1 M/s Bharat Optics. Spun off from CAR/25/229 as a child file.',
    'normal', 'draft', 6, 6, null, null, '2026-06-05', null]
];

const TABLES = [
  'cabinet', 'access_alerts', 'access_grants', 'attachments', 'clarification_messages',
  'clarifications', 'routing_steps', 'notes', 'files', 'postings', 'members', 'org_units'
];

function insertAll() {
  for (const r of ORG) run('INSERT INTO org_units(id,name,kind,code,parent_id) VALUES(?,?,?,?,?)', ...r);
  for (const r of MEMBERS) run('INSERT INTO members(id,pb,name,email,designation,app_role,section_id,heads_unit_id) VALUES(?,?,?,?,?,?,?,?)', ...r);
  for (const r of POSTINGS) run('INSERT INTO postings(member_id,org_unit_id,role_in_unit,from_date,to_date) VALUES(?,?,?,?,?)', ...r);
  for (const r of FILES) run('INSERT INTO files(id,file_id,title,kind,car_no,standalone,initiator_id,initiator_unit_id,parent_file_id,line_no,status,provisioning_start,tendering_start,created_at,closed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ...r);
  for (const r of NOTES) run('INSERT INTO notes(id,file_pk,seq,ref_no,txn_id,title,stage_id,source,body,classification,status,initiator_id,custodian_id,decision,decided_by,created_at,closed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ...r);
}

export function seedIfEmpty() {
  const n = get('SELECT COUNT(*) AS c FROM members').c;
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
  console.log('Noting store reseeded:', get('SELECT COUNT(*) AS c FROM members').c, 'members,', get('SELECT COUNT(*) AS c FROM org_units').c, 'org units,', get('SELECT COUNT(*) AS c FROM files').c, 'files.');
}
