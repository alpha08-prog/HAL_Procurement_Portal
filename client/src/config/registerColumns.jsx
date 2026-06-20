// Screen 6 (Payment Record & History Register) column config + CSV column map.
// Mirrors the IFS spec doc's full register field list. Read-only: the only row
// action is "View" (navigation — never mutates a PA). The grid scrolls horizontally.
import CategoryPills from '../components/CategoryPills.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { paymentGroupStatus, statusMeta } from './statusColors.js';
import { roleLabel } from './roles.js';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';

const twoLine = (a, b) => (
  <div className="cell-two-line">
    <span>{a ?? '—'}</span>
    <span>{b ?? '—'}</span>
  </div>
);
const inr = (v) => <span className="num">{formatINR(v)}</span>;
const days = (v) => <span className="num">{v ?? '—'}</span>;

export function registerColumns({ onView }) {
  return [
    { key: 'sl', label: 'Sl', align: 'right' },
    { key: 'paNo', label: 'PA No', render: (r) => <strong>{r.paNo}</strong> },
    { key: 'officer', label: 'Officer In-charge' },
    { key: 'status', label: 'Present Status', render: (r) => <StatusPill status={r.status} /> },
    { key: 'paymentGroup', label: 'Payment Group', render: (r) => paymentGroupStatus(r.status) },
    { key: 'gateEntry', label: 'Gate Entry No / Date', render: (r) => twoLine(r.gateEntryNo, formatDate(r.gateEntryDate)) },
    { key: 'waybill', label: 'Waybill No / Date', render: (r) => twoLine(r.waybillNo, formatDate(r.waybillDate)) },
    { key: 'receiptDate', label: 'Receipt Date', render: (r) => formatDate(r.receiptDate) },
    { key: 'ftrDate', label: 'FTR Date', render: (r) => formatDate(r.ftrDate) },
    { key: 'qcDate', label: 'QC Acceptance', render: (r) => formatDate(r.qcDate) },
    { key: 'chargeApprovalDate', label: 'Charge Approval', render: (r) => formatDate(r.chargeApprovalDate) },
    { key: 'rv', label: 'RV No / Date', render: (r) => twoLine(<strong>{r.rvNo}</strong>, formatDate(r.rvDate)) },
    { key: 'rvValue', label: 'RV Value', align: 'right', render: (r) => inr(r.rvValue) },
    { key: 'vendor', label: 'Vendor Code / Name', render: (r) => twoLine(r.vendorCode, r.vendorName) },
    { key: 'vendorAddress', label: 'Vendor Address' },
    {
      key: 'category',
      label: 'Category (MSE / Women / SC-ST)',
      render: (r) => <CategoryPills category={r.mseCategory} women={r.mseWomen} scSt={r.mseScSt} />
    },
    { key: 'po', label: 'PO No / Date', render: (r) => twoLine(r.poNo, formatDate(r.poDate)) },
    { key: 'poDescription', label: 'PO Description' },
    { key: 'poValue', label: 'PO Value', align: 'right', render: (r) => inr(r.poValue) },
    { key: 'deliveryDueDate', label: 'PO Delivery Due', render: (r) => formatDate(r.deliveryDueDate) },
    { key: 'gem', label: 'GeM Contract No / Date', render: (r) => twoLine(r.gemContractNo, formatDate(r.gemContractDate)) },
    { key: 'mpr', label: 'MPR No / Date', render: (r) => twoLine(r.mprNo, formatDate(r.mprDate)) },
    { key: 'invoice', label: 'Invoice No / Date', render: (r) => twoLine(r.invoiceNo, formatDate(r.invoiceDate)) },
    { key: 'invoiceValue', label: 'Invoice Value', align: 'right', render: (r) => inr(r.invoiceValue) },
    { key: 'ldApplicable', label: 'LD?' },
    { key: 'ldAmount', label: 'LD', align: 'right', render: (r) => inr(r.ldAmount) },
    { key: 'finalPayment', label: 'Final Payment', align: 'right', render: (r) => inr(r.finalPayment) },
    {
      key: 'created',
      label: 'PA Created (Date / By)',
      render: (r) =>
        twoLine(formatDate(r.createdDate), r.createdByName ? `${r.createdByName} / ${r.createdByPb}` : roleLabel(r.createdBy))
    },
    {
      key: 'forwarded',
      label: 'PA Forwarded (Date / By)',
      render: (r) => twoLine(formatDate(r.forwardedDate), r.forwardedBy ? roleLabel(r.forwardedBy) : '—')
    },
    { key: 'advisedBy', label: 'Advised By', render: (r) => (r.advisedBy ? roleLabel(r.advisedBy) : '—') },
    { key: 'ppr', label: 'CPPC PRR No / Date', render: (r) => (r.pprNo ? twoLine(r.pprNo, formatDate(r.pprDate)) : '—') },
    { key: 'advisedFromRvDays', label: 'Advised: RV→PA (d)', align: 'right', render: (r) => days(r.advisedFromRvDays) },
    { key: 'processedFromForwardingDays', label: 'Proc: Fwd→CPPC (d)', align: 'right', render: (r) => days(r.processedFromForwardingDays) },
    { key: 'rvToPaymentDays', label: 'Proc: RV→CPPC (d)', align: 'right', render: (r) => days(r.rvToPaymentDays) },
    { key: 'geToPaymentDays', label: 'Proc: GE→CPPC (d)', align: 'right', render: (r) => days(r.geToPaymentDays) },
    { key: 'remarks', label: 'Remarks' },
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
  { label: 'Officer In-charge', value: (r) => r.officer },
  { label: 'Present Status', value: (r) => statusMeta(r.status).label },
  { label: 'Payment Group', value: (r) => paymentGroupStatus(r.status) },
  { label: 'FY', value: (r) => r.fy },
  { label: 'Gate Entry No', value: (r) => r.gateEntryNo ?? '' },
  { label: 'Gate Entry Date', value: (r) => csvDate(r.gateEntryDate) },
  { label: 'Waybill No', value: (r) => r.waybillNo ?? '' },
  { label: 'Waybill Date', value: (r) => csvDate(r.waybillDate) },
  { label: 'Receipt Date', value: (r) => csvDate(r.receiptDate) },
  { label: 'FTR Date', value: (r) => csvDate(r.ftrDate) },
  { label: 'QC Acceptance Date', value: (r) => csvDate(r.qcDate) },
  { label: 'Charge Approval Date', value: (r) => csvDate(r.chargeApprovalDate) },
  { label: 'RV No', value: (r) => r.rvNo },
  { label: 'RV Date', value: (r) => csvDate(r.rvDate) },
  { label: 'RV Value', value: (r) => r.rvValue },
  { label: 'Vendor Code', value: (r) => r.vendorCode },
  { label: 'Vendor Name', value: (r) => r.vendorName },
  { label: 'Vendor Address', value: (r) => r.vendorAddress },
  { label: 'Category MSE', value: (r) => r.mseCategory },
  { label: 'Category Women', value: (r) => r.mseWomen },
  { label: 'Category SC-ST', value: (r) => r.mseScSt },
  { label: 'PO No', value: (r) => r.poNo },
  { label: 'PO Date', value: (r) => csvDate(r.poDate) },
  { label: 'PO Description', value: (r) => r.poDescription },
  { label: 'PO Value', value: (r) => r.poValue },
  { label: 'PO Delivery Due', value: (r) => csvDate(r.deliveryDueDate) },
  { label: 'GeM Contract No', value: (r) => r.gemContractNo ?? '' },
  { label: 'GeM Contract Date', value: (r) => csvDate(r.gemContractDate) },
  { label: 'MPR No', value: (r) => r.mprNo ?? '' },
  { label: 'MPR Date', value: (r) => csvDate(r.mprDate) },
  { label: 'Invoice No', value: (r) => r.invoiceNo ?? '' },
  { label: 'Invoice Date', value: (r) => csvDate(r.invoiceDate) },
  { label: 'Invoice Value', value: (r) => r.invoiceValue ?? '' },
  { label: 'LD Applicable', value: (r) => r.ldApplicable },
  { label: 'LD Amount', value: (r) => r.ldAmount },
  { label: 'Final Payment', value: (r) => r.finalPayment },
  { label: 'PA Creation Date', value: (r) => csvDate(r.createdDate) },
  { label: 'PA Forwarding Date', value: (r) => csvDate(r.forwardedDate) },
  { label: 'CPPC PRR No', value: (r) => r.pprNo ?? '' },
  { label: 'CPPC Forwarding Date', value: (r) => csvDate(r.pprDate) },
  { label: 'PA Created By', value: (r) => (r.createdByName ? `${r.createdByName} / ${r.createdByPb}` : r.createdBy ? roleLabel(r.createdBy) : '') },
  { label: 'PA Forwarded By', value: (r) => (r.forwardedBy ? roleLabel(r.forwardedBy) : '') },
  { label: 'Payment Advised By', value: (r) => (r.advisedBy ? roleLabel(r.advisedBy) : '') },
  { label: 'Advised days from RV', value: (r) => r.advisedFromRvDays ?? '' },
  { label: 'Processed days from Forwarding', value: (r) => r.processedFromForwardingDays ?? '' },
  { label: 'Processed days from RV', value: (r) => r.rvToPaymentDays ?? '' },
  { label: 'Processed days from Gate Entry', value: (r) => r.geToPaymentDays ?? '' },
  { label: 'Remarks', value: (r) => r.remarks }
];
