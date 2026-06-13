// Screen 4 (Process Payment — payment desk) config. Same ApprovalQueue component
// as Screens 3/5; the desk just watches more states and gates its actions per row.
// The desk acts on an advice sitting at the desk: it either CLEARS it (forwards for
// HOD approval — no PPR captured here) or SENDS IT BACK to the maker. Once cleared,
// the PA moves on to HOD/CPPC and the desk only views it. Both desk transitions
// already exist on the state machine (desk_clear, desk_send_back) — this wires them.
import StatusPill from '../components/StatusPill.jsx';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';
import { roleLabel } from './roles.js';

// Who handed this PA to the desk, and when — read from the officer_forward step.
const forwardedToDesk = (row) =>
  (row.history ?? []).find((h) => h.action === 'officer_forward');

export const deskQueueConfig = {
  title: 'Process Payment',
  note: 'Payment desk — check the advice, then clear it for HOD approval, or send it back to the purchase group with a remark.',
  states: ['at_payment_desk', 'cleared_by_desk', 'sent_to_cppc'],
  backPath: '/process-payment',
  emptyMessage: 'No payment advices at the payment desk.',
  columns: [
    {
      key: 'paNo',
      label: 'PA No / Date',
      render: (row) => (
        <div className="cell-two-line">
          <strong>{row.paNo}</strong>
          <span>{formatDate(row.createdDate)}</span>
        </div>
      )
    },
    {
      key: 'poNo',
      label: 'PO / RV No',
      render: (row) => (
        <div className="cell-two-line">
          <span>{row.poNo}</span>
          <span>{row.rvNo}</span>
        </div>
      )
    },
    { key: 'gateEntryNo', label: 'Gate Entry No' },
    {
      key: 'gemContractNo',
      label: 'GeM Contract No / Date',
      render: (row) => (
        <div className="cell-two-line">
          <span>{row.gemContractNo ?? '—'}</span>
          <span>{formatDate(row.gemContractDate)}</span>
        </div>
      )
    },
    { key: 'mseCategory', label: 'MSME', render: (row) => <StatusPill status={row.mseCategory} /> },
    {
      key: 'finalPayment',
      label: 'PA Amount',
      align: 'right',
      render: (row) => <span className="num">{formatINR(row.finalPayment)}</span>
    },
    {
      key: 'forwardedBy',
      label: 'Forwarded By',
      render: (row) => {
        const h = forwardedToDesk(row);
        return h ? (
          <div className="cell-two-line">
            <span>{roleLabel(h.by)}</span>
            <span>{formatDate(h.date)}</span>
          </div>
        ) : (
          '—'
        );
      }
    },
    {
      key: 'pendingDays',
      label: 'Pending Days (GE / Advised)',
      align: 'right',
      render: (row) => (
        <span className="num">
          {row.pendingDaysGate ?? '—'} / {row.pendingDaysPa}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <div className="cell-two-line">
          <StatusPill status={row.status} />
          {row.pprNo && (
            <span>
              PPR {row.pprNo} · {formatDate(row.pprDate)}
            </span>
          )}
        </div>
      )
    }
  ],
  actions: [
    // Open the maker's advice read-only (reused Screen 2 form). Actionable rows get
    // "Check advice"; once the PA has left the desk it's just "View record".
    {
      key: 'check',
      label: 'Check advice',
      kind: 'preview',
      when: (row) => row.status === 'at_payment_desk'
    },
    {
      key: 'view',
      label: 'View record',
      kind: 'preview',
      when: (row) => row.status !== 'at_payment_desk'
    },
    // Clear the advice and forward it for HOD approval. No PPR here — the CPPC PPR
    // no/date are captured by HOD at the approval step.
    {
      key: 'clear',
      label: 'Clear & forward for approval',
      transition: 'desk_clear',
      primary: true,
      when: (row) => row.status === 'at_payment_desk'
    },
    // Send back to the purchase group (returns the PA to pa_created — maker sees it
    // again). Remark is mandatory.
    {
      key: 'sendback',
      label: 'Send back',
      transition: 'desk_send_back',
      when: (row) => row.status === 'at_payment_desk',
      modalTitle: 'Send back to purchase group',
      submitLabel: 'Send back',
      fields: [
        { key: 'remark', label: 'Remark', type: 'textarea', required: true, placeholder: 'Reason for sending back to the maker…' }
      ]
    }
  ]
};
