// Screen 3 (Forward Payment Advice — officer queue) config. Screens 4 and 5 get
// their own config files like this one; the ApprovalQueue component never changes.
import StatusPill from '../components/StatusPill.jsx';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';
import { roleLabel } from './roles.js';

export const officerQueueConfig = {
  title: 'Forward Payment Advice',
  note: 'Officer queue — verify the advice, add a remark, stamp & forward to the payment desk (Neerja Sharma).',
  state: 'forwarded_to_officer',
  backPath: '/forward-advice',
  emptyMessage: 'No payment advices awaiting officer action.',
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
    { key: 'vendorName', label: 'Vendor' },
    { key: 'poOfficer', label: 'Purchase Officer / PB No' },
    {
      key: 'createdBy',
      label: 'PA Created By (Maker)',
      render: (row) => (row.createdByName ? `${row.createdByName} / ${row.createdByPb}` : roleLabel(row.createdBy))
    },
    { key: 'mseCategory', label: 'MSME', render: (row) => <StatusPill status={row.mseCategory} /> },
    {
      key: 'finalPayment',
      label: 'PA Amount',
      align: 'right',
      render: (row) => <span className="num">{formatINR(row.finalPayment)}</span>
    },
    {
      key: 'bankStatus',
      label: 'Bank Account Status',
      render: (row) =>
        (row.bankMismatch === true || row.bankMismatch === 'Yes') ? (
          <span className="pill pill-danger" title="Bank account details mismatch flagged by Yogesh M. (Maker). Cannot send to Neerja Sharma (Payment Desk).">
            🚨 Mismatch (Blocked)
          </span>
        ) : (
          <span className="pill pill-success">✓ Matched</span>
        )
    },
    {
      key: 'pendingDays',
      label: 'Pending Days (GE / PA)',
      align: 'right',
      render: (row) => (
        <span className="num">
          {row.pendingDaysGate ?? '—'} / {row.pendingDaysPa}
        </span>
      )
    }
  ],
  actions: [
    {
      key: 'stamp',
      label: 'Stamp & forward',
      transition: 'officer_forward',
      primary: true,
      allowedRoles: ['purchase_officer'],
      when: (row) => !(row.bankMismatch === true || row.bankMismatch === 'Yes'),
      modalTitle: 'Stamp & forward to payment desk (Neerja Sharma)',
      submitLabel: 'Stamp & forward',
      fields: [
        {
          key: 'remark',
          label: 'Forwarding remark',
          type: 'textarea',
          placeholder: 'Add a remark…',
          quickOptions: [
            'Verified against PO terms. Forwarded to payment desk.',
            'Documents checked and payment recommended.',
            'Forwarded with the applicable LD deduction.'
          ]
        }
      ]
    },
    {
      key: 'sendback',
      label: 'Return to maker',
      transition: 'officer_send_back',
      allowedRoles: ['purchase_officer'],
      modalTitle: 'Return to purchase maker',
      submitLabel: 'Return',
      fields: [
        { key: 'remark', label: 'Remark', type: 'textarea', required: true, placeholder: 'Reason for returning to the maker…', quickOptions: ['Please verify the supporting documents.', 'Please correct the payment computation.'] }
      ]
    }
  ]
};
