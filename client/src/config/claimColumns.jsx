// Column config + enums for the claims register (screens/ClaimManagement). Rows are what
// /api/claims returns: the claim, the RV/vendor facts joined server-side and the actions the
// server allows next. `claimColumns(handlers)` is a factory for the row-action cell.
import StatusPill from '../components/StatusPill.jsx';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';

export const CLAIM_STATUS_LABEL = {
  raised: 'Raised',
  dispatched: 'Dispatched to vendor',
  received: 'Received / replaced',
  closed: 'Closed & settled'
};
export const CLAIM_STATUS_TONE = { raised: 'warning', dispatched: 'info', received: 'success', closed: 'neutral' };

export function ClaimStatusBadge({ status }) {
  return <span className={`pill pill-${CLAIM_STATUS_TONE[status] || 'neutral'}`}>{CLAIM_STATUS_LABEL[status] || status}</span>;
}

export const CLAIM_TABS = [
  { id: 'status', label: 'Claim status (all)' },
  { id: 'dispatched', label: 'Units dispatched under claim' },
  { id: 'received', label: 'Item received against claim' },
  { id: 'closed', label: 'Claims closed' },
  { id: 'raise', label: '+ Raise a claim' },
  { id: 'discrepancies', label: 'Discrepancies without a claim' }
];

export const claimColumns = ({ role, onAction }) => [
  { key: 'claimNo', label: 'Claim', render: (r) => <strong>{r.claimNo}</strong> },
  {
    key: 'rvNo',
    label: 'RV / PO',
    render: (r) => (
      <div className="cell-two-line">
        <span>{r.rvNo}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{r.poNo}</span>
      </div>
    )
  },
  { key: 'item', label: 'Item', render: (r) => r.item || '—' },
  { key: 'vendorName', label: 'Vendor' },
  { key: 'typeLabel', label: 'Nature' },
  { key: 'qty', label: 'Qty', align: 'right' },
  { key: 'reason', label: 'Reason' },
  { key: 'actionSought', label: 'Action sought' },
  { key: 'raisedDate', label: 'Raised', render: (r) => `${formatDate(r.raisedDate)}${r.raisedBy ? ` · ${r.raisedBy}` : ''}` },
  {
    key: 'gatePassNo',
    label: 'Gate pass / dates',
    render: (r) => (
      <div className="cell-two-line" style={{ fontSize: '0.75rem' }}>
        <span>{r.gatePassNo ? `${r.gatePassNo} · ${formatDate(r.dispatchDate)}` : '—'}</span>
        <span>{r.receivedDate ? `received ${formatDate(r.receivedDate)}` : ''}</span>
      </div>
    )
  },
  { key: 'settlement', label: 'Settlement', render: (r) => r.settlement || (r.creditNoteNo ? `CN ${r.creditNoteNo}` : '—') },
  { key: 'paStatus', label: 'Payment', render: (r) => (r.paStatus ? <StatusPill status={r.paStatus} /> : '—') },
  { key: 'agingDays', label: 'Aging (days)', align: 'right' },
  { key: 'status', label: 'Status', render: (r) => <ClaimStatusBadge status={r.status} /> },
  {
    key: 'actions',
    label: '',
    render: (r) => (
      <div className="req-row-actions">
        {r.availableActions
          .filter((a) => role === 'admin' || a.by.includes(role))
          .map((a) => (
            <button key={a.id} type="button" className="btn btn-secondary btn-sm" onClick={() => onAction(r, a)}>
              {a.label}
            </button>
          ))}
      </div>
    )
  }
];

export const DISCREPANCY_COLUMNS = [
  { key: 'rvNo', label: 'RV' },
  { key: 'poNo', label: 'PO' },
  { key: 'vendorName', label: 'Vendor' },
  { key: 'kind', label: 'Kind', render: (r) => (r.kind === 'value_shortfall' ? 'RV below invoice' : 'Bank mismatch') },
  { key: 'detail', label: 'Detail' },
  { key: 'amount', label: 'Amount', align: 'right', render: (r) => (r.amount == null ? '—' : formatINR(r.amount)) },
  { key: 'claimNo', label: 'Claim', render: (r) => r.claimNo || <span className="field-hint">none raised</span> }
];
