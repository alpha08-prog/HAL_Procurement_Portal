// Roles and per-screen visibility. Client feedback changes this file, not components.

export const ROLES = [
  { id: 'indentor', label: 'Indentor' },
  { id: 'purchase_maker', label: 'Purchase Maker' },
  { id: 'purchase_officer', label: 'Purchase Officer' },
  { id: 'stores_inspection', label: 'Stores & Inspection' },
  { id: 'payment_desk', label: 'Payment Desk' },
  { id: 'hod_imm', label: 'HOD (IMM)' },
  { id: 'admin', label: 'Admin' }
];

export const DEFAULT_ROLE = 'purchase_maker';

// Accounts that see every screen and may switch roles freely from the top bar.
export const ALL_ACCESS_ROLES = ['admin'];
export const canSwitchRoles = (role) => ALL_ACCESS_ROLES.includes(role);

export const roleLabel = (id) => ROLES.find((r) => r.id === id)?.label ?? id;

const ALL_ROLES = ROLES.map((r) => r.id);

// The six payment-module screens. `visibleTo` drives both nav and route guards.
export const SCREENS = [
  {
    path: '/rv-inbox',
    title: 'RV — Payment Status',
    navLabel: 'RV Inbox',
    visibleTo: ALL_ROLES
  },
  {
    path: '/payment-advice',
    title: 'Payment Advice',
    navLabel: 'Payment Advice',
    visibleTo: ['purchase_maker', 'admin']
  },
  {
    path: '/forward-advice',
    title: 'Forward Payment Advice',
    navLabel: 'Forward Advice',
    visibleTo: ALL_ROLES
  },
  {
    path: '/process-payment',
    title: 'Process Payment',
    navLabel: 'Process Payment',
    visibleTo: ['payment_desk', 'admin']
  },
  {
    path: '/hod-approval',
    title: 'HOD-IMM Approval',
    navLabel: 'HOD Approval',
    visibleTo: ['hod_imm', 'admin']
  },
  {
    path: '/payment-register',
    title: 'Payment Record & History Register',
    navLabel: 'Payment Register',
    visibleTo: ALL_ROLES
  },
  {
    path: '/ai-documents',
    title: 'AI Documents',
    navLabel: 'AI Documents',
    visibleTo: ['indentor', 'purchase_maker', 'purchase_officer', 'hod_imm', 'admin']
  },

  // Module F — the live AI cascade. A case is a shared file held by one of the two
  // agencies at a time; every role can open the queue and read a file, but only positions
  // belonging to the holding agency can raise its next note (enforced server-side, see
  // server/ai/access.js). /ai-cases/:id is a detail route, deliberately not listed.
  {
    path: '/ai-cases',
    title: 'AI Procurement Cases',
    navLabel: 'AI Cases',
    visibleTo: ALL_ROLES
  },

  // Module C — e-File Noting Workflow. Every HAL user can initiate/route notes, so
  // these are visible to all roles. `group` drives the nav divider in Header.
  {
    path: '/noting',
    title: 'e-File Noting',
    navLabel: 'Noting Home',
    group: 'Noting',
    visibleTo: ALL_ROLES
  },
  {
    path: '/noting/initiate',
    title: 'Initiate Note',
    navLabel: 'Initiate',
    group: 'Noting',
    visibleTo: ALL_ROLES
  },
  {
    path: '/noting/inbox',
    title: 'Inbox',
    navLabel: 'Inbox',
    group: 'Noting',
    visibleTo: ALL_ROLES
  },
  {
    path: '/noting/sentbox',
    title: 'SentBox',
    navLabel: 'SentBox',
    group: 'Noting',
    visibleTo: ALL_ROLES
  },
  {
    path: '/noting/upcoming',
    title: 'Upcoming Files',
    navLabel: 'Upcoming',
    group: 'Noting',
    visibleTo: ALL_ROLES
  },
  {
    path: '/noting/files',
    title: 'Files',
    navLabel: 'Files',
    group: 'Noting',
    visibleTo: ALL_ROLES
  },
  {
    path: '/noting/cabinet',
    title: 'Cabinet',
    navLabel: 'Cabinet',
    group: 'Noting',
    visibleTo: ALL_ROLES
  },
  {
    path: '/noting/reports',
    title: 'Reports',
    navLabel: 'Reports',
    group: 'Noting',
    visibleTo: ALL_ROLES
  },
  {
    path: '/noting/org',
    title: 'Organisation',
    navLabel: 'Organisation',
    group: 'Noting',
    visibleTo: ALL_ROLES
  },

  // Module D — Contract Generation. The register and the STC library are readable by
  // everyone (library amendment is admin-only, enforced server-side); generation is for
  // the purchase chain. /contracts/view/:id is a detail route, deliberately not listed.
  {
    path: '/contracts/generate',
    title: 'Contract Generation',
    navLabel: 'Generate Contract',
    group: 'Contracts',
    visibleTo: ['purchase_maker', 'purchase_officer', 'hod_imm', 'admin']
  },
  {
    path: '/contracts/register',
    title: 'Contract Register',
    navLabel: 'Contract Register',
    group: 'Contracts',
    visibleTo: ALL_ROLES
  },
  {
    path: '/contracts/library',
    title: 'Contract Terms & Conditions Library',
    navLabel: 'Clause Library',
    group: 'Contracts',
    visibleTo: ALL_ROLES
  },

  // Module E — internal approval chains. Filling the checklist and starting a file belong
  // to the indentor and the purchase chain; the directory and the bid evaluation are
  // readable by everyone. /approvals/chain/:id is a detail route, deliberately not listed.
  {
    path: '/approvals/intake',
    title: 'Indent Intake — Checklist',
    navLabel: 'Indent Intake',
    group: 'Approvals',
    visibleTo: ['indentor', 'purchase_maker', 'purchase_officer', 'hod_imm', 'admin']
  },
  {
    path: '/approvals/chains',
    title: 'Approval Files',
    navLabel: 'Approval Files',
    group: 'Approvals',
    visibleTo: ALL_ROLES
  },
  {
    path: '/approvals/committees',
    title: 'Committees — TEC & PNC',
    navLabel: 'Committees',
    group: 'Approvals',
    visibleTo: ['indentor', 'purchase_maker', 'purchase_officer', 'hod_imm', 'admin']
  },
  {
    path: '/approvals/bids',
    title: 'Bid Evaluation',
    navLabel: 'Bid Evaluation',
    group: 'Approvals',
    visibleTo: ALL_ROLES
  },
  {
    path: '/approvals/directory',
    title: 'Personnel Directory',
    navLabel: 'Directory',
    group: 'Approvals',
    visibleTo: ALL_ROLES
  }
];

export function screensForRole(role) {
  if (ALL_ACCESS_ROLES.includes(role)) return SCREENS;
  return SCREENS.filter((s) => s.visibleTo.includes(role));
}

// True if `role` is allowed to open `path`. ALL_ACCESS_ROLES (admin) see everything.
export function canAccessPath(role, path) {
  return screensForRole(role).some((s) => s.path === path);
}

// Where a role should land after login / on "/". Portal Hub is the main launchpad for all roles.
export function firstScreenForRole(role) {
  return '/portal';
}
