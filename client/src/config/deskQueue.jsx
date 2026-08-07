// Screen 4 (Process Payment — payment desk) config. Same ApprovalQueue component
// as Screens 3/5; the desk watches the whole desk↔HOD↔CPPC loop and gates its actions
// per row. The desk (1) forwards a freshly-arrived advice to HOD — or sends it back
// to the maker; then, once HOD stamps it and returns it, (2) forwards it to CPPC for
// the final payment (capturing the PPR); and finally (3) records the CPPC payment.
// Every transition already exists on the state machine — this only wires them.
import StatusPill from '../components/StatusPill.jsx';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';
import { roleLabel } from './roles.js';

// Who handed this PA to the desk, and when — read from the officer_forward step.
const forwardedToDesk = (row) =>
  (row.history ?? []).find((h) => h.action === 'officer_forward');

export const deskQueueConfig = {
  title: 'Process Payment',
  note: 'Payment desk — check the same recommendation report received from the forwarding officer, stamp & forward it to HOD, then forward the HOD-stamped advice to CPPC.',
  states: ['at_payment_desk', 'sent_to_hod', 'stamped_by_hod', 'sent_to_cppc', 'paid'],
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
    // Open the advice read-only (HAL document format). Actionable rows get "Check
    // advice"; rows the desk can only watch get "View record".
    {
      key: 'check',
      label: 'Check advice',
      kind: 'preview',
      when: (row) => row.status === 'at_payment_desk'
    },
    {
      key: 'viewStamp',
      label: 'View & stamp Recommendation Report → CPPC',
      kind: 'preview',
      when: (row) => row.status === 'stamped_by_hod'
    },
    {
      key: 'view',
      label: 'View record',
      kind: 'preview',
      when: (row) => row.status !== 'at_payment_desk' && row.status !== 'stamped_by_hod'
    },
    // (1) Forward a freshly-arrived advice to HOD for approval.
    {
      key: 'forwardHod',
      label: 'Check, stamp & forward to HOD',
      transition: 'desk_forward_hod',
      primary: true,
      when: (row) => row.status === 'at_payment_desk',
      modalTitle: 'Stamp & forward recommendation report to HOD',
      submitLabel: 'Stamp & Forward',
      fields: [
        {
          key: 'remark',
          label: 'Forwarding remark',
          type: 'textarea',
          placeholder: 'Add note for HOD…',
          quickOptions: [
            'Recommendation report checked & stamped. Forwarded to HOD for approval.',
            'Verified and forwarded for HOD approval.',
            'All supporting documents checked and recommended to HOD.'
          ]
        }
      ]
    },
    // Send back to the purchase group (returns the PA to pa_created). Remark required.
    {
      key: 'sendback',
      label: 'Send back',
      transition: 'desk_send_back',
      when: (row) => row.status === 'at_payment_desk',
      modalTitle: 'Send back to purchase group',
      submitLabel: 'Send back',
      fields: [
        { key: 'remark', label: 'Remark', type: 'textarea', required: true, placeholder: 'Reason for sending back to the maker…', quickOptions: ['Please verify the supporting documents.', 'Please correct the payment computation.'] }
      ]
    },
    // (2) Forward an HOD-stamped advice to CPPC for the final payment (capture PPR).
    {
      key: 'forwardCppc',
      label: 'Forward to CPPC (final payment)',
      transition: 'desk_forward_cppc',
      primary: true,
      when: (row) => row.status === 'stamped_by_hod',
      modalTitle: 'Forward to CPPC for final payment',
      submitLabel: 'Forward to CPPC',
      fields: [
        { key: 'pprNo', label: 'CPPC PPR No', type: 'text', required: true, placeholder: 'e.g. PPR/26/0231' },
        { key: 'pprDate', label: 'PPR Date', type: 'date', required: true },
        { key: 'remark', label: 'Forwarding remark', type: 'textarea', quickOptions: ['HOD-stamped advice forwarded to CPPC for payment.', 'Payment recommended and forwarded to CPPC.'] }
      ]
    },
    // (3) Record the final payment released by CPPC — closes the loop to 'paid'.
    {
      key: 'recordPaid',
      label: 'Record payment released',
      transition: 'cppc_pay',
      primary: true,
      when: (row) => row.status === 'sent_to_cppc'
    }
  ]
};
