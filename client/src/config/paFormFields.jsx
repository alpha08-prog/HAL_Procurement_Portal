// Screen 2 (Payment Advice — maker verification) field config, per the IFS spec doc.
// Sections and fields render straight from this file; client feedback edits happen
// here, not in the screen.
//
// Field shape:
//   key       — property on the PA object from the API
//   label     — display label
//   source    — 'ifs' (ERP-fetched, read-only, tagged IFS) | 'maker' (input) |
//               'computed' (server-computed, read-only, tagged Computed)
//   type      — text | date | currency | pill | date-input | amount | textarea
//   required  — maker fields that must be filled before forwarding
//   render(pa)— optional custom display for read-only fields
//   emphasis  — render value large/bold (final payment)
//   hint      — small helper text under the value
//
// A section may instead carry render(pa, editable) to draw a custom sub-form
// (securities, attachments) in place of the field grid.
import CategoryPills from '../components/CategoryPills.jsx';
import { AttachmentsPanel, SecuritiesPanel } from '../components/PaSubforms.jsx';
import { roleLabel } from './roles.js';

export const PA_FORM_SECTIONS = [
  {
    title: 'Advice & References',
    fields: [
      { key: 'createdBy', label: 'PA Created By', source: 'ifs', render: (pa) => roleLabel(pa.createdBy) },
      { key: 'poOfficer', label: 'PO Officer / PB No', source: 'ifs' },
      { key: 'checkingOfficerPbNo', label: 'Checked & Forwarded by (PB No)', source: 'ifs' },
      { key: 'mprNo', label: 'MPR No', source: 'ifs' },
      { key: 'mprDate', label: 'MPR Date', source: 'ifs', type: 'date' },
      { key: 'gemContractNo', label: 'GeM Contract No', source: 'ifs' },
      { key: 'gemContractDate', label: 'GeM Contract Date', source: 'ifs', type: 'date' }
    ]
  },
  {
    title: 'RV & PO Details',
    fields: [
      { key: 'rvNo', label: 'RV No', source: 'ifs' },
      { key: 'rvDate', label: 'RV Date', source: 'ifs', type: 'date' },
      { key: 'gateEntryNo', label: 'Gate Entry No', source: 'ifs' },
      { key: 'gateEntryDate', label: 'Gate Entry Date', source: 'ifs', type: 'date' },
      { key: 'receiptDate', label: 'Date of Receipt of Supplies', source: 'ifs', type: 'date' },
      { key: 'waybillNo', label: 'Waybill No', source: 'ifs' },
      { key: 'waybillDate', label: 'Waybill Date', source: 'ifs', type: 'date' },
      { key: 'qcDate', label: 'QC Acceptance Date', source: 'ifs', type: 'date' },
      { key: 'ftrDate', label: 'FTR Date', source: 'ifs', type: 'date' },
      { key: 'chargeApprovalDate', label: 'Charge Approval Date', source: 'ifs', type: 'date' },
      { key: 'poNo', label: 'PO No', source: 'ifs' },
      { key: 'poDate', label: 'PO Date', source: 'ifs', type: 'date' },
      { key: 'description', label: 'PO Description', source: 'ifs' },
      { key: 'deliveryDueDate', label: 'Delivery Due (PO)', source: 'ifs', type: 'date' }
    ]
  },
  {
    title: 'Vendor',
    fields: [
      { key: 'vendorCode', label: 'Supplier Code', source: 'ifs' },
      { key: 'vendorName', label: 'Supplier Name', source: 'ifs' },
      { key: 'vendorAddress', label: 'Supplier Address', source: 'ifs' },
      { key: 'gstin', label: 'GSTIN', source: 'ifs' },
      {
        key: 'vendorBank',
        label: 'Bank Details',
        source: 'ifs',
        render: (pa) =>
          pa.vendorBank
            ? `${pa.vendorBank.name} · A/C ${pa.vendorBank.accountNo} · ${pa.vendorBank.ifsc}`
            : '—'
      },
      {
        key: 'category',
        label: 'Category (MSE / Women / SC-ST)',
        source: 'ifs',
        render: (pa) => <CategoryPills category={pa.mseCategory} women={pa.mseWomen} scSt={pa.mseScSt} />
      }
    ]
  },
  {
    title: 'Invoice — Maker Entry',
    fields: [
      { key: 'invoiceNo', label: 'Invoice No', source: 'maker', type: 'text', required: true },
      { key: 'invoiceDate', label: 'Invoice Date', source: 'maker', type: 'date-input', required: true },
      { key: 'invoiceValue', label: 'Invoice Value', source: 'ifs', type: 'currency' },
      { key: 'makerRemark', label: 'Maker Remark', source: 'maker', type: 'textarea' }
    ]
  },
  {
    title: 'Payment Computation',
    fields: [
      { key: 'rvValue', label: 'RV Value', source: 'ifs', type: 'currency' },
      { key: 'poValue', label: 'PO Order Value', source: 'ifs', type: 'currency', hint: 'LD cap base' },
      { key: 'ldApplicable', label: 'LD Applicable', source: 'computed' },
      {
        key: 'ldWeeks',
        label: 'Supply Delay',
        source: 'computed',
        render: (pa) => (pa.ldWeeks > 0 ? `${pa.ldWeeks} week(s) late` : 'On time')
      },
      {
        key: 'ldSupplyAmount',
        label: 'LD (a) — Supply Delay',
        source: 'computed',
        type: 'currency',
        hint: '0.5% of RV value per week or part thereof'
      },
      {
        key: 'ldIcAmount',
        label: 'LD (b) — Installation & Commissioning',
        source: 'maker',
        type: 'amount',
        hint: 'Manual, per FTR date — totals recompute on save'
      },
      {
        key: 'ldAmount',
        label: 'LD Total (a + b)',
        source: 'computed',
        type: 'currency',
        hint: 'Capped at 10% of PO order value'
      },
      {
        key: 'finalPayment',
        label: 'Final Proposed Payment',
        source: 'computed',
        type: 'currency',
        emphasis: true,
        hint: 'RV value − LD total'
      }
    ]
  },
  {
    title: 'Securities & Holds',
    render: (pa) => <SecuritiesPanel pa={pa} />
  },
  {
    title: 'Attachments',
    render: (pa, editable) => <AttachmentsPanel pa={pa} editable={editable} />
  }
];

// Keys the maker edits locally before save/forward (render-only sections have no fields).
export const PA_MAKER_FIELDS = PA_FORM_SECTIONS.flatMap((s) => s.fields ?? []).filter(
  (f) => f.source === 'maker'
);

export const PA_REQUIRED_FIELDS = PA_MAKER_FIELDS.filter((f) => f.required).map((f) => f.key);
