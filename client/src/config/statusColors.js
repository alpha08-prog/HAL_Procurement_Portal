// Status -> pill label + tone. Tones map to CSS classes: warning / info / success / danger / neutral.
export const STATUS_META = {
  // Payment advice state machine
  rv_pending: { label: 'RV Pending', tone: 'warning' },
  pa_created: { label: 'PA Created', tone: 'info' },
  forwarded_to_officer: { label: 'With Officer', tone: 'info' },
  at_payment_desk: { label: 'At Payment Desk', tone: 'info' },
  hod_approved: { label: 'HOD Approved', tone: 'success' },
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
