// Screen 1 (RV — payment status) column config. Field changes after client
// feedback happen here, not in DataGrid or the screen component.
import StatusPill from '../components/StatusPill.jsx';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';

const BASE_COLUMNS = [
  { key: 'rvNo', label: 'RV No' },
  { key: 'rvDate', label: 'RV Date', render: (row) => formatDate(row.rvDate) },
  { key: 'poNo', label: 'PO No' },
  { key: 'vendorName', label: 'Vendor' },
  {
    key: 'rvValue',
    label: 'RV Value',
    align: 'right',
    render: (row) => <span className="num">{formatINR(row.rvValue)}</span>
  },
  {
    key: 'mseCategory',
    label: 'Category',
    render: (row) => <StatusPill status={row.mseCategory} />
  },
  {
    key: 'pendingDays',
    label: 'Pending Days (RV / GE)',
    align: 'right',
    render: (row) => (
      <span className="num">
        {row.pendingDaysRv} / {row.pendingDaysGate}
      </span>
    )
  },
  {
    key: 'paStatus',
    label: 'PA Status',
    render: (row) => <StatusPill status={row.paStatus} />
  }
];

// Roles that can generate a payment advice from this inbox.
const CAN_GENERATE_PA = ['purchase_maker', 'admin'];

export function rvInboxColumns(role, handlers = {}) {
  if (!CAN_GENERATE_PA.includes(role)) return BASE_COLUMNS;
  return [
    ...BASE_COLUMNS,
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button
          className="btn"
          disabled={row.paStatus !== 'rv_pending' || handlers.busyRvNo === row.rvNo}
          onClick={() => handlers.onGenerate?.(row)}
        >
          Generate payment advice
        </button>
      )
    }
  ];
}
