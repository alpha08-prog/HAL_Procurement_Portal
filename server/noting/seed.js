// Seeds a representative HAL org tree + members (mirroring the login accounts by pb,
// plus the org figures the AI notes reference: GM(AOD), FCA, CM(Purchase)) and a demo
// storyline of files/notes/routing so every screen has data on first login. seedIfEmpty()
// runs on boot; running this file directly (node server/noting/seed.js) force-reseeds.
// Swap in real HAL org data later.
//
// Demo storyline (today ~ Jul 2026):
//   file 1  NVB parent case — N1+N2 approved, OPEN → cabinet prompts "Generate EMD…"
//   file 2  standalone furniture — in flight, last hop still UNOPENED → officer can Retract
//   file 3  NVB child PP (Line 1) — routed to officer, clarification threads live here
//   file 4  predecessor-era 2023 case (closed) — tenure/predecessor visibility demo
//   file 5  NVB child PP (Line 2) — draft with officer
//   file 6  CONFIDENTIAL case — active share grant + a revoked (re-shared) grant + leak alert
//   file 7  TOP SECRET case — participants (maker + CM) only; hidden even from HOD
//   file 8  SYS-dept standalone — admin/test accounts get a live inbox + reports row
//   file 9  rejected case (closed) — cabinet + Retrieve demo for hod@
//   file 10 hydraulic seals — PO approved, CLOSED → cabinet prompts "Generate PO Amendment"
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
// GM(AOD) and CM(Purchase) have logins too: gm@ demos division-wide supervision,
// cm@ demos the direct-head "secret" grade + the top_secret participant path.
const MEMBERS = [
  [1, 'PB-40001', 'A. K. Sharma', 'gm@hal.local', 'General Manager (AOD)', 'hod_imm', 3, 3],
  [2, 'PB-40015', 'V. Rao', 'hod@hal.local', 'HOD (IMM)', 'hod_imm', 4, 4],
  [3, 'PB-40020', 'S. Menon', null, 'FCA (Finance)', null, 5, 5],
  [4, 'PB-41060', 'Gaurav Yadav', 'cm@hal.local', 'Chief Manager (Purchase)', 'hod_imm', 9, 9],
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
const FILES = [
  [1, 'AOD/IMM/2026/0001', 'Procurement of Night Vision Binocular (NVB)', 'CAR', 'CAR/25/229', 0, 5, 9, null, null, 'open', '2026-05-02', '2026-05-18', '2026-05-02', null],
  [2, 'AOD/IMM/2026/0002', 'Purchase of office furniture — administrative approval', 'standalone', null, 1, 6, 9, null, null, 'open', '2026-06-10', null, '2026-06-10', null],
  [3, 'AOD/IMM/2026/0003', 'NVB — Purchase Proposal (Line 1: M/s Optic Systems)', 'CAR', 'CAR/25/229', 0, 5, 9, 1, 'Line 1 — M/s Optic Systems', 'open', '2026-05-02', '2026-05-18', '2026-06-01', null],
  [4, 'AOD/IMM/2023/0001', 'IMM predecessor-era procurement (historical)', 'CAR', 'CAR/23/101', 0, 12, 4, null, null, 'closed', '2023-06-01', '2023-06-20', '2023-06-01', '2023-09-01'],
  [5, 'AOD/IMM/2026/0004', 'NVB — Purchase Proposal (Line 2: M/s Bharat Optics)', 'CAR', 'CAR/25/229', 0, 6, 9, 1, 'Line 2 — M/s Bharat Optics', 'open', '2026-05-02', '2026-05-18', '2026-06-05', null],
  [6, 'AOD/IMM/2026/0005', 'Procurement of secure communication modules', 'CAR', 'CAR/26/104', 0, 5, 9, null, null, 'open', '2026-06-20', null, '2026-06-20', null],
  [7, 'AOD/IMM/2026/0006', 'Special project procurement (restricted)', 'SPR', 'SPR/26/017', 0, 5, 9, null, null, 'open', '2026-07-01', null, '2026-07-01', null],
  [8, 'AOD/SYS/2026/0001', 'IT hardware refresh — administrative approval', 'standalone', null, 1, 11, 16, null, null, 'open', '2026-07-10', null, '2026-07-10', null],
  [9, 'AOD/IMM/2026/0007', 'Procurement of tool kits — budget review', 'CAR', 'CAR/26/077', 0, 5, 9, null, null, 'closed', '2026-05-20', null, '2026-05-20', '2026-06-12'],
  [10, 'AOD/IMM/2026/0008', 'Procurement of hydraulic seals', 'CAR', 'CAR/25/301', 0, 5, 9, null, null, 'closed', '2026-03-02', '2026-03-20', '2026-03-02', '2026-07-05']
];

// [id, file_pk, seq, ref_no, txn_id, title, stage_id, source, body, classification,
//  status, initiator_id, custodian_id, decision, decided_by, created_at, closed_at]
const NOTES = [
  [1, 1, 1, 'AOD/IMM/2026/0001/N1', 'TXN-2026-000003', 'Provisioning Note', 'provisioning', 'ai',
    'Provisioning note for procurement of Night Vision Binocular against CAR/25/229. Estimated value ₹15,94,065. Requirement vetted by Indent Cell; provisioning approved by HOD (IMM) — case advanced to tendering.',
    'normal', 'approved', 5, 2, 'approved', 2, '2026-05-02', '2026-05-16'],
  [2, 1, 2, 'AOD/IMM/2026/0001/N2', 'TXN-2026-000004', 'Tender Document', 'tender_doc', 'manual',
    'Draft tender document for the NVB case, prepared for issue on GeM (two-bid system, reverse auction enabled). EMD ₹31,900; delivery 120 days; PBG 10%. Approved for publication.',
    'normal', 'approved', 5, 2, 'approved', 2, '2026-05-18', '2026-06-02'],
  [3, 2, 1, 'AOD/IMM/2026/0002/N1', 'TXN-2026-000008', 'Administrative Approval Note', null, 'manual',
    'Standalone administrative note seeking approval for purchase of office furniture for the IMM section. No MPR/CAR/SPR/CPR reference. Returned once by Bill Passing for the comparative statement; resubmitted to CM (Purchase).',
    'normal', 'routed', 6, 4, null, null, '2026-06-10', null],
  [4, 3, 1, 'AOD/IMM/2026/0003/N1', 'TXN-2026-000006', 'Purchase Proposal Note', 'pp', 'ai',
    'Purchase Proposal for the Night Vision Binocular case, line-wise L1 M/s Optic Systems. Spun off from CAR/25/229 as a child file.',
    'normal', 'routed', 5, 6, null, null, '2026-06-01', null],
  [5, 4, 1, 'AOD/IMM/2023/0001/N1', 'TXN-2023-000001', 'Provisioning Note (historical)', 'provisioning', 'manual',
    'Historical provisioning note initiated under the previous HOD (IMM). Retained for predecessor-tenure visibility.',
    'normal', 'approved', 12, 12, 'approved', 12, '2023-06-01', '2023-09-01'],
  [6, 5, 1, 'AOD/IMM/2026/0004/N1', 'TXN-2026-000007', 'Purchase Proposal Note (Line 2)', 'pp', 'manual',
    'Second line-wise Purchase Proposal for the NVB case — Line 2, L1 M/s Bharat Optics. Spun off from CAR/25/229 as a child file.',
    'normal', 'draft', 6, 6, null, null, '2026-06-05', null],
  [7, 6, 1, 'AOD/IMM/2026/0005/N1', 'TXN-2026-000009', 'Procurement Note — secure communication modules', 'provisioning', 'manual',
    'Provisioning note for secure communication modules against CAR/26/104. CONFIDENTIAL — circulation restricted to routed members and supervising heads; need-to-know access via share grant only.',
    'confidential', 'routed', 5, 6, null, null, '2026-06-20', null],
  [8, 7, 1, 'AOD/IMM/2026/0006/N1', 'TXN-2026-000010', 'Special Project Note', 'provisioning', 'manual',
    'TOP SECRET special-project procurement against SPR/26/017. Access strictly limited to routed members and explicit grants — no supervisory bypass.',
    'top_secret', 'routed', 5, 4, null, null, '2026-07-01', null],
  [9, 8, 1, 'AOD/SYS/2026/0001/N1', 'TXN-2026-000011', 'IT Hardware Refresh — Approval Note', null, 'manual',
    'Standalone administrative note seeking approval for replacement of 12 workstations in System Administration. Pending with the System Administrator.',
    'normal', 'routed', 11, 10, null, null, '2026-07-10', null],
  [10, 9, 1, 'AOD/IMM/2026/0007/N1', 'TXN-2026-000005', 'Provisioning Note — tool kits', 'provisioning', 'manual',
    'Provisioning note for special tool kits against CAR/26/077. Rejected by HOD (IMM): budget provision not available in the current FY.',
    'normal', 'rejected', 5, 2, 'rejected', 2, '2026-05-20', '2026-06-12'],
  [11, 10, 1, 'AOD/IMM/2026/0008/N1', 'TXN-2026-000001', 'Purchase Proposal — hydraulic seals', 'pp', 'manual',
    'Purchase Proposal for hydraulic seal kits against CAR/25/301, L1 M/s Seal Tech Industries. Approved by HOD (IMM).',
    'normal', 'approved', 5, 2, 'approved', 2, '2026-03-02', '2026-04-10'],
  [12, 10, 2, 'AOD/IMM/2026/0008/N2', 'TXN-2026-000002', 'Purchase Order + Contract', 'po', 'manual',
    'Purchase Order placed on M/s Seal Tech Industries against CAR/25/301.\n\nItem | Qty | Unit Rate | Value\nHydraulic seal kit MK-II | 120 | ₹4,850 | ₹5,82,000\n\nDelivery 90 days from PO date; PBG 10%; LD clause as per PM Issue-4. Case closed on PO release.',
    'normal', 'approved', 5, 2, 'approved', 2, '2026-04-12', '2026-07-05']
];

// [note_id, seq, from_member_id, to_member_id, purpose, state, action, comment, sent_at, opened_at, actioned_at]
// States mirror exactly what workflow.js produces: 'sent' (retractable) → 'opened' (viewed,
// retract locked) → 'actioned' (receiver forwarded / sent back / decided; `action` = what
// THEY did with it). Decisions append a self-to-self 'approve'-purpose step.
const STEPS = [
  // file 1 N1 — maker → officer → HOD, approved
  [1, 1, 5, 6, 'forward', 'actioned', 'forward', 'Concurred & Forwarded', '2026-05-03', '2026-05-04', '2026-05-06'],
  [1, 2, 6, 2, 'forward', 'actioned', 'approve', 'Concurred & Forwarded. Placed for approval.', '2026-05-06', '2026-05-08', '2026-05-16'],
  [1, 3, 2, 2, 'approve', 'actioned', 'approve', 'Approved. Proceed with tendering.', '2026-05-16', null, '2026-05-16'],
  // file 1 N2 — same chain, approved
  [2, 1, 5, 6, 'forward', 'actioned', 'forward', 'Concurred & Forwarded', '2026-05-19', '2026-05-20', '2026-05-22'],
  [2, 2, 6, 2, 'forward', 'actioned', 'approve', 'Draft tender document verified against PM Issue-4.', '2026-05-22', '2026-05-25', '2026-06-02'],
  [2, 3, 2, 2, 'approve', 'actioned', 'approve', 'Tender document approved for issue on GeM.', '2026-06-02', null, '2026-06-02'],
  // file 2 — officer → desk (sent back) → officer → CM, last hop UNOPENED (Retract demo)
  [3, 1, 6, 7, 'forward', 'actioned', 'send_back', 'Concurred & Forwarded', '2026-06-11', '2026-06-12', '2026-06-14'],
  [3, 2, 7, 6, 'forward', 'actioned', 'forward', 'Please attach the quotation comparative statement.', '2026-06-14', '2026-06-15', '2026-06-18'],
  [3, 3, 6, 4, 'forward', 'sent', 'forward', 'Comparative statement attached. Resubmitted for concurrence.', '2026-06-18', null, null],
  // file 3 — maker → officer, opened but not yet actioned
  [4, 1, 5, 6, 'forward', 'opened', 'forward', 'Concurred & Forwarded', '2026-06-01', '2026-06-03', null],
  // file 6 (confidential) — maker → officer, opened
  [7, 1, 5, 6, 'forward', 'opened', 'forward', 'For concurrence — restricted circulation.', '2026-06-20', '2026-06-21', null],
  // file 7 (top secret) — maker → CM(Purchase), opened
  [8, 1, 5, 4, 'forward', 'opened', 'forward', 'Top secret — for CM (Purchase) only.', '2026-07-01', '2026-07-02', null],
  // file 8 — QA Test → Administrator, still UNOPENED (Retract demo for test@)
  [9, 1, 11, 10, 'forward', 'sent', 'forward', 'Concurred & Forwarded', '2026-07-10', null, null],
  // file 9 — maker → officer → HOD, rejected
  [10, 1, 5, 6, 'forward', 'actioned', 'forward', 'Concurred & Forwarded', '2026-05-21', '2026-05-22', '2026-05-25'],
  [10, 2, 6, 2, 'forward', 'actioned', 'reject', 'Concurred & Forwarded', '2026-05-25', '2026-05-28', '2026-06-12'],
  [10, 3, 2, 2, 'approve', 'actioned', 'reject', 'Rejected — budget provision not available in current FY.', '2026-06-12', null, '2026-06-12'],
  // file 10 N1 (PP) + N2 (PO) — both approved; file closed at PO
  [11, 1, 5, 6, 'forward', 'actioned', 'forward', 'Concurred & Forwarded', '2026-03-03', '2026-03-04', '2026-03-08'],
  [11, 2, 6, 2, 'forward', 'actioned', 'approve', 'Concurred & Forwarded', '2026-03-08', '2026-03-10', '2026-04-10'],
  [11, 3, 2, 2, 'approve', 'actioned', 'approve', 'Purchase proposal approved.', '2026-04-10', null, '2026-04-10'],
  [12, 1, 5, 6, 'forward', 'actioned', 'forward', 'Concurred & Forwarded', '2026-04-13', '2026-04-14', '2026-04-18'],
  [12, 2, 6, 2, 'forward', 'actioned', 'approve', 'PO terms verified against DoP.', '2026-04-18', '2026-04-20', '2026-07-05'],
  [12, 3, 2, 2, 'approve', 'actioned', 'approve', 'PO approved and released to vendor.', '2026-07-05', null, '2026-07-05']
];

// [note_id, kind, name, ref, uploaded_by_id, created_at] — the 'pm' reference is the
// automatic one every note gets at creation (uploaded_by NULL renders as "System").
const ATTACHMENTS = [
  ...NOTES.map((n) => [n[0], 'pm', 'Purchase Manual Issue-4', 'PM/Issue-4', null, n[15]]),
  [1, 'stamping', 'Stamped CAR/25/229 (scanned)', null, 5, '2026-05-02'],
  [1, 'dop', 'DoP 2025 — Annexure 3 (value bands)', 'DOP-2025/A3', 5, '2026-05-02'],
  [1, 'doc', 'GeM bid comparative statement', 'GEM/2026/B-114532', 6, '2026-05-05'],
  [4, 'doc', 'L1 price bid extract — M/s Optic Systems', null, 5, '2026-06-01']
];

// Clarifications live on file 3's note (id 4): one answered thread, one still open.
// [id, note_id, asked_by_id, asked_to_id, status, created_at]
const CLARIFICATIONS = [
  [1, 4, 6, 5, 'answered', '2026-06-04'],
  [2, 4, 5, 6, 'open', '2026-06-08']
];
// [clarification_id, author_id, body, created_at]
const CLARIFICATION_MESSAGES = [
  [1, 6, 'Please confirm the Udyam registration number quoted for M/s Optic Systems.', '2026-06-04'],
  [1, 5, 'Verified — UDYAM-MH-26-0012345; certificate is on record with the bid.', '2026-06-05'],
  [2, 5, 'Should the PBG clause cite DoP-2025 or the earlier CVC circular?', '2026-06-08']
];

// Need-to-know grants on the CONFIDENTIAL note (id 7): one active (desk), one revoked
// after a re-share caught by stores' PB — with the matching custodian alert for officer@.
// [id, note_id, token, granted_by_id, granted_to_id, state, created_at, revoked_at, revoke_reason]
const GRANTS = [
  [1, 7, 'demo-grant-active-desk', 6, 7, 'active', '2026-06-22', null, null],
  [2, 7, 'demo-grant-leaked-indent', 6, 9, 'revoked', '2026-06-23', '2026-06-25', 'reshared']
];
// [id, note_id, grant_id, custodian_id, offender_pb, message, created_at]
const ALERTS = [
  [1, 7, 2, 6, 'PB-47210', 'Restricted note AOD/IMM/2026/0005/N1 link re-shared — access attempted by PB PB-47210. Grant revoked.', '2026-06-25']
];

// Cabinet rows for the three decided cases (union of routed members + file initiator,
// exactly as decide() files them). File 1 is OPEN with N2 approved → next-action prompt;
// file 10 is CLOSED at the PO → PO-amendment prompt; file 9 is rejected → no prompt.
// [member_id, file_pk, reason, placed_at]
const CABINET = [
  [5, 1, 'initiator', '2026-06-02'], [6, 1, 'router', '2026-06-02'], [2, 1, 'approver', '2026-06-02'],
  [5, 9, 'initiator', '2026-06-12'], [6, 9, 'router', '2026-06-12'], [2, 9, 'approver', '2026-06-12'],
  [5, 10, 'initiator', '2026-07-05'], [6, 10, 'router', '2026-07-05'], [2, 10, 'approver', '2026-07-05']
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
  for (const r of STEPS) run('INSERT INTO routing_steps(note_id,seq,from_member_id,to_member_id,purpose,state,action,comment,sent_at,opened_at,actioned_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', ...r);
  for (const r of ATTACHMENTS) run('INSERT INTO attachments(note_id,kind,name,ref,uploaded_by_id,created_at) VALUES(?,?,?,?,?,?)', ...r);
  for (const r of CLARIFICATIONS) run('INSERT INTO clarifications(id,note_id,asked_by_id,asked_to_id,status,created_at) VALUES(?,?,?,?,?,?)', ...r);
  for (const r of CLARIFICATION_MESSAGES) run('INSERT INTO clarification_messages(clarification_id,author_id,body,created_at) VALUES(?,?,?,?)', ...r);
  for (const r of GRANTS) run('INSERT INTO access_grants(id,note_id,token,granted_by_id,granted_to_id,state,created_at,revoked_at,revoke_reason) VALUES(?,?,?,?,?,?,?,?,?)', ...r);
  for (const r of ALERTS) run('INSERT INTO access_alerts(id,note_id,grant_id,custodian_id,offender_pb,message,created_at) VALUES(?,?,?,?,?,?,?)', ...r);
  for (const r of CABINET) run('INSERT INTO cabinet(member_id,file_pk,reason,placed_at) VALUES(?,?,?,?)', ...r);
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
