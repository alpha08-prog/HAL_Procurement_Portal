// Screen 6 (Payment Record & History Register) column config + CSV column map.
// Read-only: the only row action is "View" (navigation — never mutates a PA).
import StatusPill from '../components/StatusPill.jsx';
import { statusMeta } from './statusColors.js';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';

export function registerColumns({ onView }) {
  return [
    { key: 'sl', label: 'Sl', align: 'right' },
    { key: 'paNo', label: 'PA No', render: (row) => <strong>{row.paNo}</strong> },
    { key: 'vendorName', label: 'Vendor' },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'rvNo', label: 'RV No' },
    {
      key: 'finalPayment',
      label: 'Final Payment',
      align: 'right',
      render: (row) => <span className="num">{formatINR(row.finalPayment)}</span>
    },
    {
      key: 'ldAmount',
      label: 'LD',
      align: 'right',
      render: (row) => <span className="num">{formatINR(row.ldAmount)}</span>
    },
    {
      key: 'ppr',
      label: 'CPPC PPR / Date',
      render: (row) =>
        row.pprNo ? (
          <div className="cell-two-line">
            <span>{row.pprNo}</span>
            <span>{formatDate(row.pprDate)}</span>
          </div>
        ) : (
          '—'
        )
    },
    {
      key: 'rvToPaymentDays',
      label: 'RV→Pay (days)',
      align: 'right',
      render: (row) => <span className="num">{row.rvToPaymentDays ?? '—'}</span>
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <button className="btn btn-secondary" onClick={() => onView(row)}>
          View
        </button>
      )
    }
  ];
}

// Flat columns for the CSV export — raw ₹ integers (Excel-friendly), DD/MM/YYYY dates.
const csvDate = (iso) => (iso ? formatDate(iso) : '');

export const registerCsvColumns = [
  { label: 'Sl', value: (r) => r.sl },
  { label: 'PA No', value: (r) => r.paNo },
  { label: 'Vendor', value: (r) => r.vendorName },
  { label: 'Status', value: (r) => statusMeta(r.status).label },
  { label: 'Officer', value: (r) => r.officer },
  { label: 'FY', value: (r) => r.fy },
  { label: 'RV No', value: (r) => r.rvNo },
  { label: 'RV Date', value: (r) => csvDate(r.rvDate) },
  { label: 'RV Value', value: (r) => r.rvValue },
  { label: 'PO No', value: (r) => r.poNo },
  { label: 'LD', value: (r) => r.ldAmount },
  { label: 'Final Payment', value: (r) => r.finalPayment },
  { label: 'CPPC PPR No', value: (r) => r.pprNo ?? '' },
  { label: 'PPR Date', value: (r) => csvDate(r.pprDate) },
  { label: 'RV to Payment (days)', value: (r) => r.rvToPaymentDays ?? '' }
];
