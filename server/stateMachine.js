import { rvByNo, todayISO } from './store.js';

// PA lifecycle (linear; the desk↔HOD loop gates CPPC dispatch):
//   rv_pending → pa_created → forwarded_to_officer → at_payment_desk
//   → sent_to_hod → stamped_by_hod → sent_to_cppc → paid
// The desk forwards the advice to HOD (generating the "Payment Advice → HOD"
// document); HOD STAMPS it and forwards it BACK to the desk; the desk then forwards
// it to CPPC (capturing the CPPC PPR no/date) for the final payment, which CPPC
// releases. Each named action is a row here; routes never hand-roll status changes.
// `by` is stamped server-side into history — the role switcher is not trusted.
export const TRANSITIONS = {
  forward_to_officer: {
    from: 'pa_created',
    to: 'forwarded_to_officer',
    by: 'purchase_maker',
    guard: (pa) =>
      !pa.invoiceNo || !pa.invoiceDate
        ? 'Invoice no and invoice date are required before forwarding'
        : null,
    defaultRemark: 'Verified and forwarded to purchase officer.'
  },
  officer_forward: {
    from: 'forwarded_to_officer',
    to: 'at_payment_desk',
    by: 'purchase_officer',
    defaultRemark: 'Stamped and forwarded to payment desk.'
  },
  desk_send_back: {
    from: 'at_payment_desk',
    to: 'pa_created',
    by: 'payment_desk',
    remarkRequired: true
  },
  // Desk forwards the advice to HOD-IMM (the "Payment Advice from Payment Desk to
  // HOD" document). No PPR here — that is captured later, at the CPPC dispatch.
  desk_forward_hod: {
    from: 'at_payment_desk',
    to: 'sent_to_hod',
    by: 'payment_desk',
    defaultRemark: 'Forwarded to HOD (IMM) for approval.'
  },
  // HOD stamps the advice and forwards it BACK to the payment desk for payment.
  hod_stamp: {
    from: 'sent_to_hod',
    to: 'stamped_by_hod',
    by: 'hod_imm',
    defaultRemark: 'Approved & stamped — returned to payment desk for payment.'
  },
  hod_return: {
    from: 'sent_to_hod',
    to: 'pa_created',
    by: 'hod_imm',
    remarkRequired: true
  },
  // Desk forwards the HOD-stamped advice to CPPC for the final payment; the CPPC
  // PPR no/date are captured here.
  desk_forward_cppc: {
    from: 'stamped_by_hod',
    to: 'sent_to_cppc',
    by: 'payment_desk',
    metaRequired: ['pprNo', 'pprDate'],
    defaultRemark: 'Forwarded to CPPC for final payment.'
  },
  // CPPC releases the final payment (recorded at the desk to close the demo loop).
  cppc_pay: {
    from: 'sent_to_cppc',
    to: 'paid',
    by: 'cppc',
    defaultRemark: 'Final payment released by CPPC.'
  }
};

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

// Validates and applies a named transition: sets pa.status, stores any captured
// meta (e.g. PPR no/date) on the PA, appends a history entry, syncs rv.paStatus.
export function applyTransition(pa, action, payload = {}) {
  const t = TRANSITIONS[action];
  if (!t) fail(400, `Unknown action '${action}'`);
  if (pa.status !== t.from) {
    fail(409, `${pa.paNo} is ${pa.status} — '${action}' requires ${t.from}`);
  }

  const remark = String(payload.remark ?? '').trim();
  if (t.remarkRequired && !remark) fail(422, `A remark is required for '${action}'`);

  if (t.guard) {
    const problem = t.guard(pa);
    if (problem) fail(422, problem);
  }

  const meta = {};
  for (const key of t.metaRequired ?? []) {
    if (!payload[key]) fail(422, `${key} is required for '${action}'`);
    meta[key] = payload[key];
  }

  Object.assign(pa, meta);
  pa.status = t.to;
  pa.history.push({
    action,
    from: t.from,
    to: t.to,
    by: t.by,
    date: todayISO(),
    remark: remark || t.defaultRemark || '',
    ...meta
  });

  const rv = rvByNo(pa.rvNo);
  if (rv) rv.paStatus = t.to;
  return pa;
}
