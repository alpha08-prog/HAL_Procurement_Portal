// Status -> pill label + tone. Tones map to CSS classes: warning / info / success / danger / neutral.
export const STATUS_META = {
  // Payment advice state machine
  rv_pending: { label: 'RV Pending', tone: 'warning' },
  pa_created: { label: 'PA Created', tone: 'info' },
  forwarded_to_officer: { label: 'With Officer', tone: 'info' },
  at_payment_desk: { label: 'At Payment Desk', tone: 'info' },
  sent_to_hod: { label: 'With HOD (IMM)', tone: 'info' },
  stamped_by_hod: { label: 'Stamped — At Desk', tone: 'info' },
  sent_to_cppc: { label: 'Sent to CPPC', tone: 'success' },
  paid: { label: 'Paid', tone: 'success' },
  returned: { label: 'Returned', tone: 'danger' },
  sent_back: { label: 'Sent Back', tone: 'danger' },

  // Vendor categories
  MSE: { label: 'MSE', tone: 'success' },
  'Non-MSE': { label: 'Non-MSE', tone: 'neutral' },
  Women: { label: 'Women', tone: 'info' },
  'SC-ST': { label: 'SC-ST', tone: 'info' }
};

export function statusMeta(status) {
  return STATUS_META[status] ?? { label: String(status ?? '—'), tone: 'neutral' };
}

// Grouped payment status the source doc asks for on Screens 1 & 6
// ("With PO grp / With Payment group / Forwarded to CPPC").
const PAYMENT_GROUP = {
  rv_pending: 'RV Pending',
  pa_created: 'With Purchase Group',
  forwarded_to_officer: 'With Purchase Group',
  at_payment_desk: 'With Payment Group',
  sent_to_hod: 'With HOD (IMM)',
  stamped_by_hod: 'With Payment Group',
  sent_to_cppc: 'Forwarded to CPPC',
  paid: 'Paid by CPPC'
};

export const paymentGroupStatus = (status) => PAYMENT_GROUP[status] ?? statusMeta(status).label;
