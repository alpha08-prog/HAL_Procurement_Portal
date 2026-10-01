// Column configs for the fixture-backed trackers (components/trackers/TrackerTable.jsx),
// keyed by the /api/trackers/:name tracker name. Values are rendered as received — every
// figure (LD, SD, PBG, outstanding) is computed on the server.
import { Link } from 'react-router-dom';
import StatusPill from '../components/StatusPill.jsx';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';

const text = (key, label) => ({ key, label, render: (r) => (r[key] == null || r[key] === '' ? '—' : String(r[key])) });
const date = (key, label) => ({ key, label, render: (r) => (r[key] ? formatDate(r[key]) : '—') });
const money = (key, label) => ({ key, label, align: 'right', render: (r) => (r[key] == null ? '—' : formatINR(r[key])) });
const pill = (key, label, tone) => ({ key, label, render: (r) => <span className={`pill pill-${tone(r)}`}>{r[key]}</span> });
const contractLink = { key: 'contractNo', label: 'Contract', render: (r) => (r.contractId ? <Link to={`/contracts/view/${r.contractId}`}>{r.contractNo}</Link> : '—') };
const rvList = { key: 'rvNos', label: 'RV(s)', render: (r) => (r.rvNos?.length ? r.rvNos.join(', ') : '—') };

export const TRACKER_COLUMNS = {
  'po-due': {
    rowKey: 'poNo',
    columns: [
      text('poNo', 'PO No'),
      date('poDate', 'PO date'),
      text('vendorName', 'Vendor'),
      text('description', 'Description'),
      money('landedValue', 'PO value'),
      text('deliveryPeriod', 'Delivery period'),
      date('dueDate', 'Due date'),
      {
        key: 'daysToDue',
        label: 'Countdown',
        render: (r) => (r.daysToDue == null ? '—' : r.daysToDue < 0 ? `${-r.daysToDue} days overdue` : `${r.daysToDue} days left`)
      },
      pill('status', 'Status', (r) => (r.status === 'Overdue' ? 'danger' : r.status.startsWith('Due') ? 'warning' : r.daysToDue == null ? 'neutral' : 'success')),
      contractLink
    ]
  },
  'dp-expired': {
    rowKey: 'poNo',
    columns: [
      text('poNo', 'PO No'),
      text('vendorName', 'Vendor'),
      text('description', 'Description'),
      date('dueDate', 'Delivery due'),
      text('ldBasis', 'Arrival basis'),
      { key: 'daysLate', label: 'Days late', align: 'right' },
      { key: 'ldWeeks', label: 'Weeks (part = 1)', align: 'right' },
      money('landedValue', 'PO value'),
      money('ldSupplyAmount', 'LD @ 0.5%/wk'),
      money('ldCap', '10% ceiling'),
      {
        key: 'ldAmount',
        label: 'LD deductible',
        align: 'right',
        render: (r) => (
          <>
            {formatINR(r.ldAmount)}
            {r.ldCapApplied && <span className="pill pill-danger" style={{ marginLeft: 6 }}>capped</span>}
          </>
        )
      },
      text('action', 'Action')
    ]
  },
  'live-po': {
    rowKey: 'poNo',
    columns: [
      text('poNo', 'PO No'),
      date('poDate', 'PO date'),
      text('tenderNo', 'Tender'),
      text('vendorName', 'Vendor'),
      text('mseCategory', 'MSE'),
      text('description', 'Description'),
      money('landedValue', 'PO value'),
      date('dueDate', 'Due'),
      pill('stage', 'Stage', (r) => (r.stage === 'Paid' ? 'success' : r.stage.startsWith('Received') || r.stage.startsWith('Payment') ? 'info' : r.stage.startsWith('Contract') ? 'warning' : 'neutral')),
      contractLink,
      rvList,
      text('paNo', 'PA')
    ]
  },
  'po-receipts': {
    rowKey: 'rvNo',
    columns: [
      text('rvNo', 'RV No'),
      date('rvDate', 'RV date'),
      text('gateEntryNo', 'Gate entry'),
      date('gateEntryDate', 'Gate date'),
      date('qcDate', 'QC'),
      date('ftrDate', 'FTR'),
      text('poNo', 'PO No'),
      text('vendorName', 'Vendor'),
      text('description', 'Description'),
      money('rvValue', 'RV value'),
      text('invoiceNo', 'Invoice'),
      text('paNo', 'PA'),
      { key: 'paStatus', label: 'Payment status', render: (r) => <StatusPill status={r.paStatus} /> },
      { key: 'daysSinceRv', label: 'Days since RV', align: 'right' }
    ]
  },
  securities: {
    rowKey: 'poNo',
    columns: [
      text('poNo', 'PO No'),
      text('vendorName', 'Vendor'),
      text('description', 'Description'),
      money('basicValue', 'PO basic'),
      money('sdAmount', 'SD (5%)'),
      text('sdStatus', 'SD status'),
      money('pbgAmount', 'PBG (10%)'),
      text('pbgStatus', 'PBG status'),
      text('emd', 'EMD'),
      text('indemnity', 'Indemnity'),
      text('paNo', 'PA'),
      text('basis', 'Basis')
    ]
  },
  'balance-outstanding': {
    rowKey: 'rvNo',
    columns: [
      text('rvNo', 'RV No'),
      date('rvDate', 'RV date'),
      text('poNo', 'PO No'),
      text('vendorName', 'Vendor'),
      money('rvValue', 'RV value'),
      money('ldAmount', 'LD'),
      money('payable', 'Payable'),
      { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
      money('outstanding', 'Outstanding'),
      { key: 'agingDays', label: 'Aging (days)', align: 'right' },
      text('paNo', 'PA')
    ]
  },
  erelease: {
    rowKey: 'poNo',
    columns: [
      text('poNo', 'PO No'),
      date('poDate', 'PO date'),
      text('vendorName', 'Vendor'),
      text('description', 'Description'),
      money('landedValue', 'PO value'),
      contractLink,
      text('contractStatus', 'Contract status'),
      pill('releaseStatus', 'e-Release', (r) => (r.releaseStatus.startsWith('Released') ? 'success' : r.releaseStatus.startsWith('Contract finalised') ? 'info' : r.releaseStatus.startsWith('Contract still') ? 'warning' : 'neutral'))
    ]
  },
  'gem-sync': {
    rowKey: 'poNo',
    columns: [
      text('poNo', 'PO No'),
      text('tenderNo', 'Tender'),
      text('vendorName', 'Vendor'),
      text('gemContractNo', 'GeM contract no'),
      date('gemContractDate', 'GeM contract date'),
      date('dueDate', 'Delivery due'),
      pill('syncStatus', 'Sync', (r) => (r.syncStatus.startsWith('GeM contract no on') ? 'success' : r.syncStatus.startsWith('Not a') ? 'neutral' : 'warning'))
    ]
  }
};
