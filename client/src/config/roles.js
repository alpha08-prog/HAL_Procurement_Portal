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
    visibleTo: ['purchase_maker', 'admin']
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
    visibleTo: ['purchase_officer', 'admin']
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

// Where a role should land after login / on "/". Payment Register is visible to all,
// so it's a safe fallback for roles without a dedicated first screen.
export function firstScreenForRole(role) {
  return screensForRole(role)[0]?.path ?? '/payment-register';
}
