// Human-readable labels for PA history actions, used by the Screen 6 timeline.
// Lives in config so wording changes after client feedback are a one-file edit.
export const ACTION_LABELS = {
  pa_created: 'Payment advice created',
  forward_to_officer: 'Forwarded to purchase officer',
  officer_forward: 'Forwarded to payment desk',
  desk_clear: 'Cleared by payment desk',
  desk_send_back: 'Sent back to maker',
  hod_approve: 'Approved & forwarded to CPPC',
  hod_return: 'Returned to maker',
  paid: 'Payment released by CPPC'
};

export const actionLabel = (action) => ACTION_LABELS[action] ?? action;
