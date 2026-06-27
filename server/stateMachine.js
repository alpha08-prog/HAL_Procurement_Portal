import { rvByNo, todayISO } from './store.js';

// PA lifecycle (linear; HOD approval gates CPPC dispatch):
//   rv_pending → pa_created → forwarded_to_officer → at_payment_desk
//   → cleared_by_desk → sent_to_cppc → paid
// The payment desk CLEARS an advice (no PPR yet); HOD approval is what dispatches
// it to CPPC and captures the CPPC PPR no/date. Each named action is a row here;
// routes never hand-roll status changes. `by` is stamped server-side into history
// — the role switcher is not trusted.
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
  desk_clear: {
    from: 'at_payment_desk',
    to: 'cleared_by_desk',
    by: 'payment_desk',
    defaultRemark: 'Cleared by payment desk — forwarded for HOD approval.'
  },
  hod_approve: {
    from: 'cleared_by_desk',
    to: 'sent_to_cppc',
    by: 'hod_imm',
    metaRequired: ['pprNo', 'pprDate'],
    defaultRemark: 'Approved — payment proposal forwarded to CPPC.'
  },
  hod_return: {
    from: 'cleared_by_desk',
    to: 'pa_created',
    by: 'hod_imm',
    remarkRequired: true
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
