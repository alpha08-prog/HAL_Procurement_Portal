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

const BASE_COLUMNS = [
  { key: 'rvNo', label: 'RV No / Date', render: (r) => twoLine(<strong>{r.rvNo}</strong>, formatDate(r.rvDate)) },
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
    label: 'Pending Days (RV / GE)',
    align: 'right',
    render: (r) => (
      <span className="num">
        {r.pendingDaysRv} / {r.pendingDaysGate}
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
