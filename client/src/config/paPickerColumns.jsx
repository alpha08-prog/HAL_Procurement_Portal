// Columns for the Screen 2 draft picker (payment advices in pa_created).
import StatusPill from '../components/StatusPill.jsx';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';

export function paPickerColumns(handlers = {}) {
  return [
    { key: 'paNo', label: 'PA No' },
    { key: 'createdDate', label: 'Created', render: (row) => formatDate(row.createdDate) },
    { key: 'rvNo', label: 'RV No' },
    { key: 'vendorName', label: 'Vendor' },
    {
      key: 'finalPayment',
      label: 'Proposed Payment',
      align: 'right',
      render: (row) => <span className="num">{formatINR(row.finalPayment)}</span>
    },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button className="btn btn-secondary" onClick={() => handlers.onOpen?.(row)}>
          Open
        </button>
      )
    }
  ];
}
