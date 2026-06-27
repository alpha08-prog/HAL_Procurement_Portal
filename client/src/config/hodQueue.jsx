// Screen 5 (HOD-IMM Approval) config. Same ApprovalQueue component as Screens 3/4.
// HOD approval is the gate that dispatches a desk-cleared advice to CPPC and is
// where the CPPC PPR no/date are captured. Transitions used (already on the state
// machine): hod_approve (→ sent_to_cppc, PPR required) and hod_return (→ pa_created).
import StatusPill from '../components/StatusPill.jsx';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';
import { roleLabel } from './roles.js';

// When the desk cleared this PA, and by whom — read from the desk_clear step.
const clearedByDesk = (row) => (row.history ?? []).find((h) => h.action === 'desk_clear');

export const hodQueueConfig = {
  title: 'HOD-IMM Approval',
  note: 'Approve a desk-cleared advice to dispatch it to CPPC (capture PPR no/date), or return it to the purchase group with a remark.',
  state: 'cleared_by_desk',
  backPath: '/hod-approval',
  emptyMessage: 'No payment advices awaiting HOD approval.',
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
    { key: 'vendorName', label: 'Vendor' },
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
      key: 'clearedBy',
      label: 'Cleared by Desk',
      render: (row) => {
        const h = clearedByDesk(row);
        return h ? (
          <div className="cell-two-line">
            <span>{roleLabel(h.by)}</span>
            <span>{formatDate(h.date)}</span>
          </div>
        ) : (
          '—'
        );
      }
    }
  ],
  actions: [
    { key: 'review', label: 'Review', kind: 'preview' },
    // Approve & dispatch to CPPC — captures the CPPC PPR no/date; the modal blocks
    // submit until both are filled (the state machine requires them).
    {
      key: 'approve',
      label: 'Approve & forward to CPPC',
      transition: 'hod_approve',
      primary: true,
      modalTitle: 'Approve & forward to CPPC',
      submitLabel: 'Approve & forward',
      fields: [
        { key: 'pprNo', label: 'CPPC PPR No', type: 'text', required: true, placeholder: 'e.g. PPR/26/0231' },
        { key: 'pprDate', label: 'PPR Date', type: 'date', required: true }
      ]
    },
    // Return to the purchase group (back to pa_created — maker sees it again). Remark
    // is mandatory.
    {
      key: 'return',
      label: 'Return',
      transition: 'hod_return',
      modalTitle: 'Return to purchase group',
      submitLabel: 'Return',
      fields: [
        { key: 'remark', label: 'Remark', type: 'textarea', required: true, placeholder: 'Reason for returning to the maker…' }
      ]
    }
  ]
};
