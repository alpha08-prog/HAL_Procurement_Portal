// Screen 1 (RV — payment status) column config, per the IFS spec doc. Field changes
// after client feedback happen here, not in DataGrid or the screen component.
import CategoryPills from '../components/CategoryPills.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { paymentGroupStatus } from './statusColors.js';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';

const twoLine = (a, b) => (
  <div className="cell-two-line">
    <span>{a ?? '—'}</span>
    <span>{b ?? '—'}</span>
  </div>
);

// Payment-pending SLA: advices should clear within PENDING_LIMIT days; anything past
// PENDING_WARN is flagged red as it approaches the limit. Tune the thresholds here.
const PENDING_LIMIT = 30;
const PENDING_WARN = 25;

// A pending-days figure, rendered red once it crosses the warning threshold.
const pendingValue = (days) => {
  if (days == null) return <span>—</span>;
  const over = days > PENDING_WARN;
  return (
    <span
      className={over ? 'pending-over' : undefined}
      title={over ? `Exceeds ${PENDING_WARN}-day warning (limit ${PENDING_LIMIT} days)` : undefined}
    >
      {days}
    </span>
  );
};

const BASE_COLUMNS = [
  { key: 'rvNo', label: 'RV No / Reference No', render: (r) => twoLine(<strong>{r.rvNo}</strong>, <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle, #4b5563)' }}>{r.refNo ?? `REF/${r.rvNo.replaceAll('/', '-')}`}</span>) },
  { key: 'rvDate', label: 'RV Date', render: (r) => formatDate(r.rvDate) },
  { key: 'gateEntryNo', label: 'Gate Entry No / Date', render: (r) => twoLine(r.gateEntryNo, formatDate(r.gateEntryDate)) },
  { key: 'waybillNo', label: 'Waybill No', render: (r) => twoLine(r.waybillNo, formatDate(r.waybillDate)) },
  { key: 'poNo', label: 'PO No / Date', render: (r) => twoLine(r.poNo, formatDate(r.poDate)) },
  { key: 'description', label: 'PO Description' },
  { key: 'poValue', label: 'PO Value', align: 'right', render: (r) => <span className="num">{formatINR(r.poValue)}</span> },
  { key: 'poOfficer', label: 'PO Officer / PB No' },
  { key: 'gemContractNo', label: 'GeM Contract No / Date', render: (r) => twoLine(r.gemContractNo, formatDate(r.gemContractDate)) },
  { key: 'vendorName', label: 'Vendor' },
  {
    key: 'category',
    label: 'Category (MSE / Women / SC-ST)',
    render: (r) => <CategoryPills category={r.mseCategory} women={r.mseWomen} scSt={r.mseScSt} />
  },
  { key: 'rvValue', label: 'RV Value', align: 'right', render: (r) => <span className="num">{formatINR(r.rvValue)}</span> },
  {
    key: 'pendingDays',
    label: 'Pending Days (RV / GE · limit 30)',
    align: 'right',
    render: (r) => (
      <span className="num">
        {pendingValue(r.pendingDaysRv)} / {pendingValue(r.pendingDaysGate)}
      </span>
    )
  },
  {
    key: 'paCreated',
    label: 'PA Created?',
    render: (r) => (r.paStatus && r.paStatus !== 'rv_pending' ? 'Yes' : 'No')
  },
  { key: 'paStatus', label: 'Payment Status', render: (r) => <StatusPill status={r.paStatus} /> },
  { key: 'paymentGroup', label: 'Payment Group', render: (r) => paymentGroupStatus(r.paStatus) }
];

export function rvInboxColumns(role, handlers = {}) {
  return [
    ...BASE_COLUMNS,
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        const busy = handlers.busyRvNo === row.rvNo;
        const isRvValueLess = Number(row.rvValue) < Number(row.invoiceValue ?? row.poValue);
        const creditNoteRequired = row.creditNoteRequired || isRvValueLess;
        const needsCreditNote = creditNoteRequired && !row.creditNoteUploaded;
        return (
          <div className="queue-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {needsCreditNote && (
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => handlers.onCreditNote?.(row)}
                title="RV value is less than claimed invoice value. Upload credit note to proceed."
              >
                Upload Credit Note
              </button>
            )}
            {creditNoteRequired && row.creditNoteUploaded && (
              <span className="action-note">Credit note {row.creditNoteNo ?? 'uploaded'} ✓</span>
            )}
            {row.paStatus === 'rv_pending' ? (
              <button
                className="btn"
                disabled={busy || needsCreditNote}
                title={needsCreditNote ? 'Generate and upload the credit note first.' : undefined}
                onClick={() => handlers.onGenerate?.(row)}
              >
                Generate payment advice
              </button>
            ) : row.paStatus === 'pa_created' ? (
              <button
                className="btn"
                disabled={busy}
                onClick={() => handlers.onViewDraft?.(row)}
                title="Open draft payment advice to edit & submit"
              >
                ✏️ View / Edit Draft PA
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => handlers.onViewPa?.(row)}
                title="View active payment advice"
              >
                🔍 View PA
              </button>
            )}
          </div>
        );
      }
    }
  ];
}
