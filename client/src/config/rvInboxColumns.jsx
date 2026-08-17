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
        const invoiceVal = Number(row.invoiceValue ?? row.poValue ?? 0);
        const rvVal = Number(row.rvValue ?? 0);
        const diffAmount = Math.abs(invoiceVal - rvVal);
        const hasDiscrepancy = diffAmount > 0;
        const isRvValueLess = rvVal < invoiceVal;
        const creditNoteWaived = Boolean(row.creditNoteWaived);
        const creditNoteUploaded = Boolean(row.creditNoteUploaded);
        const needsCreditNoteDecision = (row.creditNoteRequired ?? isRvValueLess) && !creditNoteWaived && !creditNoteUploaded;

        return (
          <div className="queue-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {hasDiscrepancy && (
              <>
                {needsCreditNoteDecision ? (
                  <button
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => (handlers.onReceiptComparison || handlers.onCreditNote)?.(row)}
                    title={`Discrepancy of ${formatINR(diffAmount)} between Invoice and RV. Review receipts to decide or upload credit note.`}
                    style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                  >
                    ⚖️ Review Receipts / CN
                  </button>
                ) : creditNoteWaived ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span className="action-note" style={{ color: '#15803d', fontWeight: 600 }}>
                      CN Waived ({formatINR(diffAmount)}) ✓
                    </span>
                    <button
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => (handlers.onReceiptComparison || handlers.onCreditNote)?.(row)}
                      style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                      title="View receipt comparison & waiver details"
                    >
                      ⚖️ View Decision
                    </button>
                  </div>
                ) : creditNoteUploaded ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span className="action-note">Credit note {row.creditNoteNo ?? 'uploaded'} ✓</span>
                    <button
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => (handlers.onReceiptComparison || handlers.onCreditNote)?.(row)}
                      style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                      title="View credit note & receipt details"
                    >
                      ⚖️ View CN
                    </button>
                  </div>
                ) : null}
              </>
            )}

            {row.paStatus === 'rv_pending' ? (
              <button
                className="btn"
                disabled={busy || needsCreditNoteDecision}
                title={
                  needsCreditNoteDecision
                    ? `Discrepancy of ${formatINR(diffAmount)} found. Review receipts & decide on credit note to proceed.`
                    : undefined
                }
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
