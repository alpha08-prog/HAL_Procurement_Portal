// Screen 5 (HOD-IMM Approval) config. Same ApprovalQueue component as Screens 3/4.
// HOD reviews an advice the payment desk forwarded, then STAMPS it and forwards it
// BACK to the desk for the final payment — or returns it to the purchase group.
// Transitions used (already on the state machine): hod_stamp (→ stamped_by_hod) and
// hod_return (→ pa_created). No PPR is captured here — the desk captures it at the
// CPPC dispatch.
import StatusPill from '../components/StatusPill.jsx';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';
import { roleLabel } from './roles.js';

// When the desk forwarded this PA to HOD, and by whom — read from the desk_forward_hod step.
const forwardedByDesk = (row) => (row.history ?? []).find((h) => h.action === 'desk_forward_hod');

export const hodQueueConfig = {
  title: 'HOD-IMM Approval',
  note: 'Stamp a desk-forwarded advice and return it to the payment desk for final payment, or return it to the purchase group with a remark.',
  state: 'sent_to_hod',
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
      key: 'forwardedBy',
      label: 'Forwarded by Desk',
      render: (row) => {
        const h = forwardedByDesk(row);
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
    // Stamp & forward back to the payment desk for the final payment. Optional remark.
    {
      key: 'stamp',
      label: 'Stamp & return to desk',
      transition: 'hod_stamp',
      primary: true,
      modalTitle: 'Stamp & return to payment desk',
      submitLabel: 'Stamp & return',
      fields: [
        { key: 'remark', label: 'Remark (optional)', type: 'textarea', placeholder: 'Note for the payment desk…' }
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
