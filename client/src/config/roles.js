// Roles, navigation groups and per-screen visibility. Client feedback changes this file,
// not components: Header, ModuleActionBar and RequireAuth all read it.

export const ROLES = [
  { id: 'indentor', label: 'Indentor' },
  { id: 'purchase_maker', label: 'Purchase Maker' },
  { id: 'purchase_officer', label: 'Purchase Officer' },
  { id: 'stores_inspection', label: 'Stores & Inspection' },
  { id: 'payment_desk', label: 'Payment Desk' },
  { id: 'cppc', label: 'CPPC (Payment Release)' },
  { id: 'hod_imm', label: 'HOD (IMM)' },
  { id: 'admin', label: 'Admin' }
];

export const DEFAULT_ROLE = 'purchase_maker';

// Accounts that see every screen and may switch roles freely from the top bar.
export const ALL_ACCESS_ROLES = ['admin'];
export const canSwitchRoles = (role) => ALL_ACCESS_ROLES.includes(role);

export const roleLabel = (id) => ROLES.find((r) => r.id === id)?.label ?? id;

const ALL_ROLES = ROLES.map((r) => r.id);
const PURCHASE_CHAIN = ['indentor', 'purchase_maker', 'purchase_officer', 'hod_imm', 'admin'];

// Navigation groups, in module-switcher order. Every SCREENS entry belongs to exactly one
// group: Header draws the switcher from GROUPS and the nav row from the current group's
// screens; ModuleActionBar shows the Portal Hub tab named by `tab`; `home` is where the
// switcher lands. A group with no screen visible to the role is hidden from the switcher.
export const GROUPS = [
  { id: 'hub', label: 'Portal Hub', desc: 'Welcome launchpad (6 lifecycle tabs)', home: '/portal', tab: null },
  { id: 'provisioning', label: 'Provisioning', desc: 'Requisitions, estimates & indent checklist', home: '/provisioning', tab: 'provisioning' },
  { id: 'noting', label: 'e-File Noting', desc: 'Stage files, routing, cabinet & reports', home: '/noting/inbox', tab: 'procurement' },
  { id: 'ai', label: 'AI Cases', desc: 'Live note cascade — Indenting and Tendering', home: '/ai-cases', tab: 'procurement' },
  { id: 'approvals', label: 'Approvals', desc: 'Approval chains, committees & bid evaluation', home: '/approvals/chains', tab: 'procurement' },
  { id: 'contracts', label: 'Contract Management', desc: 'PO release & 72 STC clauses', home: '/contracts/register', tab: 'contract_management' },
  { id: 'payments', label: 'Payment Desk', desc: 'RV status, LD & CPPC', home: '/rv-inbox', tab: 'payment' },
  { id: 'claims', label: 'Claim Management', desc: 'Rejections, discrepancies & replacements', home: '/claims', tab: 'claim_management' },
  { id: 'kpis', label: 'KPI & MIS', desc: 'Procurement metrics & SLAs', home: '/kpis', tab: 'kpi' }
];

export const groupById = (id) => GROUPS.find((g) => g.id === id) ?? GROUPS[0];

// Every routable screen. `visibleTo` drives both nav and route guards; `group` picks the
// nav row; order within a group is nav order. Detail routes (/noting/note/:txnId, …) are
// listed in DETAIL_ROUTES below, not here.
export const SCREENS = [
  { path: '/portal', title: 'Portal Hub — 6 Core Lifecycle Tabs', navLabel: 'Portal Overview', group: 'hub', visibleTo: ALL_ROLES },

  // Provisioning
  { path: '/provisioning', title: 'Provisioning Workspace — Requisitions, Estimations & Certifications', navLabel: 'Provisioning Workspace', group: 'provisioning', visibleTo: ALL_ROLES },
  { path: '/approvals/intake', title: 'Indent Intake — Checklist', navLabel: 'Indentor Checklist', group: 'provisioning', visibleTo: PURCHASE_CHAIN },

  // Module C — e-File Noting. Every HAL user can initiate/route notes.
  { path: '/noting', title: 'e-File Noting', navLabel: 'Noting Home', group: 'noting', visibleTo: ALL_ROLES },
  { path: '/noting/inbox', title: 'Inbox', navLabel: 'Inbox', group: 'noting', visibleTo: ALL_ROLES },
  { path: '/noting/sentbox', title: 'SentBox', navLabel: 'SentBox', group: 'noting', visibleTo: ALL_ROLES },
  { path: '/noting/cabinet', title: 'Cabinet', navLabel: 'Cabinet', group: 'noting', visibleTo: ALL_ROLES },
  { path: '/noting/initiate', title: 'Initiate Note', navLabel: '+ Create E-File', group: 'noting', visibleTo: ALL_ROLES },
  { path: '/noting/files', title: 'Files', navLabel: 'Drafts & Files', group: 'noting', visibleTo: ALL_ROLES },
  { path: '/noting/upcoming', title: 'Upcoming Files', navLabel: 'Upcoming', group: 'noting', visibleTo: ALL_ROLES },
  { path: '/noting/reports', title: 'Reports', navLabel: 'Reports', group: 'noting', visibleTo: ALL_ROLES },
  { path: '/noting/org', title: 'Organisation', navLabel: 'Organisation', group: 'noting', visibleTo: ALL_ROLES },
  { path: '/noting/ai-documents', title: 'AI Generated Noting Documents', navLabel: 'AI Documents', group: 'noting', visibleTo: PURCHASE_CHAIN },

  // Module F — the live AI cascade. Every role can open the queue and read a file; only
  // positions in the holding agency can raise the next note (server/ai/access.js).
  { path: '/ai-cases', title: 'AI Procurement Cases', navLabel: 'AI Cases', group: 'ai', visibleTo: ALL_ROLES },

  // Module E — internal approval chains. Starting a file belongs to the purchase chain;
  // the directory and the bid evaluation are readable by everyone.
  { path: '/approvals/chains', title: 'Approval Files', navLabel: 'Approval Files', group: 'approvals', visibleTo: ALL_ROLES },
  { path: '/approvals/committees', title: 'Committees — TEC & PNC', navLabel: 'Committees', group: 'approvals', visibleTo: PURCHASE_CHAIN },
  { path: '/approvals/bids', title: 'Bid Evaluation', navLabel: 'Bid Evaluation', group: 'approvals', visibleTo: ALL_ROLES },
  { path: '/approvals/directory', title: 'Personnel Directory', navLabel: 'Directory', group: 'approvals', visibleTo: ALL_ROLES },

  // Module D — Contract Generation. Register and STC library are readable by everyone
  // (library amendment is admin-only server-side); generation is for the purchase chain.
  { path: '/contracts/register', title: 'Contract Register', navLabel: 'Contract Register', group: 'contracts', visibleTo: ALL_ROLES },
  { path: '/contracts/generate', title: 'Contract Generation', navLabel: 'Generate Contract', group: 'contracts', visibleTo: ['purchase_maker', 'purchase_officer', 'hod_imm', 'admin'] },
  { path: '/contracts/library', title: 'Contract Terms & Conditions Library', navLabel: '72 STC Clause Library', group: 'contracts', visibleTo: ALL_ROLES },

  // Module A — the six payment screens plus the desk KPIs.
  { path: '/rv-inbox', title: 'RV — Payment Status', navLabel: 'RV Inbox', group: 'payments', visibleTo: ALL_ROLES },
  { path: '/payment-advice', title: 'Payment Advice', navLabel: 'Payment Advice', group: 'payments', visibleTo: ['purchase_maker', 'admin'] },
  { path: '/forward-advice', title: 'Forward Payment Advice', navLabel: 'Forward Advice', group: 'payments', visibleTo: ALL_ROLES },
  { path: '/process-payment', title: 'Process Payment', navLabel: 'Process Payment', group: 'payments', visibleTo: ['payment_desk', 'cppc', 'admin'] },
  { path: '/hod-approval', title: 'HOD-IMM Approval', navLabel: 'HOD Approval', group: 'payments', visibleTo: ['hod_imm', 'admin'] },
  { path: '/payment-register', title: 'Payment Record & History Register', navLabel: 'Payment Register', group: 'payments', visibleTo: ALL_ROLES },
  { path: '/payment-kpis', title: 'Payment Desk KPIs & Processing Analytics', navLabel: 'Payment KPIs', group: 'payments', visibleTo: ALL_ROLES },

  { path: '/claims', title: 'Claim Management — Rejections, Discrepancies & Replacements', navLabel: 'Claim Status & Register', group: 'claims', visibleTo: ALL_ROLES },
  { path: '/kpis', title: 'Executive Procurement KPI & MIS Dashboard', navLabel: 'Procurement KPIs & MIS', group: 'kpis', visibleTo: ALL_ROLES }
];

// Parameterised detail routes. They are guarded like screens (by prefix) and mapped to a
// group for the nav, but never listed in the nav row.
export const DETAIL_ROUTES = [
  { prefix: '/noting/note/', group: 'noting', visibleTo: ALL_ROLES },
  { prefix: '/ai-cases/', group: 'ai', visibleTo: ALL_ROLES },
  { prefix: '/approvals/chain/', group: 'approvals', visibleTo: ALL_ROLES },
  { prefix: '/approvals/committee/', group: 'approvals', visibleTo: PURCHASE_CHAIN },
  { prefix: '/contracts/view/', group: 'contracts', visibleTo: ALL_ROLES }
];

const detailRouteFor = (path) =>
  DETAIL_ROUTES.find((d) => path.startsWith(d.prefix) && path.length > d.prefix.length);

export function screensForRole(role) {
  if (ALL_ACCESS_ROLES.includes(role)) return SCREENS;
  return SCREENS.filter((s) => s.visibleTo.includes(role));
}

// Groups that have at least one screen visible to the role (the module switcher).
export function groupsForRole(role) {
  const visible = screensForRole(role);
  return GROUPS.filter((g) => visible.some((s) => s.group === g.id));
}

// True for any path we route: a listed screen or a detail route.
export function isKnownPath(path) {
  return SCREENS.some((s) => s.path === path) || Boolean(detailRouteFor(path));
}

// True if `role` is allowed to open `path`. ALL_ACCESS_ROLES (admin) see everything.
export function canAccessPath(role, path) {
  const screen = SCREENS.find((s) => s.path === path);
  const rule = screen ?? detailRouteFor(path);
  if (!rule) return false;
  if (ALL_ACCESS_ROLES.includes(role)) return true;
  return rule.visibleTo.includes(role);
}

// Which nav group a pathname belongs to; unknown paths fall back to the hub.
export function groupForPath(path) {
  const screen = SCREENS.find((s) => s.path === path);
  if (screen) return screen.group;
  return detailRouteFor(path)?.group ?? 'hub';
}

// Where a role lands after login / on "/". Portal Hub is the launchpad for all roles.
export function firstScreenForRole(role) {
  return '/portal';
}
