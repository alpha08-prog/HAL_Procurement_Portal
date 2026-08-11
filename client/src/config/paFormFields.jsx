// Screen 2 (Payment Advice — maker verification) field config, per the IFS spec doc.
// Sections and fields render straight from this file; client feedback edits happen
// here, not in the screen.
import CategoryPills from '../components/CategoryPills.jsx';
import { AttachmentsPanel, SecuritiesPanel } from '../components/PaSubforms.jsx';
import { roleLabel } from './roles.js';

export const PA_FORM_SECTIONS = [
  {
    title: 'Advice & References',
    fields: [
      { key: 'paNo', label: 'Payment Advice No', source: 'ifs' },
      {
        key: 'createdBy',
        label: 'PA Created By (Maker)',
        source: 'ifs',
        render: (pa) => (pa.createdByName ? `${pa.createdByName} / ${pa.createdByPb}` : 'Yogesh M. (Purchase Maker) / PB-44731')
      },
      { key: 'poOfficer', label: 'PO Officer Name / PB No', source: 'ifs' },
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
    title: 'Vendor & Bank Details Verification (Yogesh M. — Purchase Maker)',
    fields: [
      { key: 'vendorCode', label: 'Supplier Code', source: 'ifs' },
      { key: 'vendorName', label: 'Supplier Name', source: 'ifs' },
      { key: 'vendorAddress', label: 'Supplier Address', source: 'ifs' },
      { key: 'gstin', label: 'GSTIN', source: 'ifs' },
      {
        key: 'vendorBank',
        label: 'HAL Master Data Bank Details',
        source: 'ifs',
        render: (pa) =>
          pa.vendorBank
            ? `${pa.vendorBank.name} · A/C ${pa.vendorBank.accountNo} · IFSC: ${pa.vendorBank.ifsc}`
            : '—'
      },
      {
        key: 'invoiceBankDetails',
        label: 'Bank Account Details on Invoice',
        source: 'ifs',
        render: (pa) =>
          pa.bankMismatch
            ? `🚨 Differing Bank A/C: 998811223344 (IFSC: HDFC0009999) — Mismatch with HAL Data`
            : pa.vendorBank
            ? `${pa.vendorBank.name} · A/C ${pa.vendorBank.accountNo} · IFSC: ${pa.vendorBank.ifsc} (Matches HAL Data)`
            : '—'
      },
      {
        key: 'bankMismatch',
        label: 'Bank Account Match Status (Flagged by Yogesh M.)',
        source: 'maker',
        type: 'select',
        options: ['No', 'Yes'],
        hint: 'Select "Yes" to flag bank account mismatch. Note: Mismatch prevents sending advice to Neerja Sharma (Payment Desk).'
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
    title: 'Invoice',
    fields: [
      { key: 'invoiceNo', label: 'Invoice No', source: 'ifs' },
      { key: 'invoiceDate', label: 'Invoice Date', source: 'ifs', type: 'date' },
      { key: 'invoiceValue', label: 'Invoice Value', source: 'ifs', type: 'currency' }
    ]
  },
  {
    title: 'Payment Computation',
    fields: [
      { key: 'rvValue', label: 'RV Value', source: 'ifs', type: 'currency' },
      { key: 'poValue', label: 'PO Order Value', source: 'ifs', type: 'currency', hint: 'LD cap base' },
      {
        key: 'ldApplicable',
        label: 'LD Applicable',
        source: 'maker',
        type: 'select',
        options: ['Yes', 'No'],
        hint: 'Set No to waive the entire deduction — totals recompute on save'
      },
      {
        key: 'ldByGateEntry',
        label: 'Calculate LD on Gate Entry date',
        source: 'maker',
        type: 'select',
        options: ['Yes', 'No'],
        hint: 'Automatic supply-delay LD (a)',
        disabledWhen: (d) => d.ldApplicable !== 'Yes'
      },
      {
        key: 'ldWeeks',
        label: 'Supply Delay',
        source: 'computed',
        render: (pa) => (pa.ldWeeks > 0 ? `${pa.ldWeeks} week(s) late` : 'On time'),
        hiddenWhen: (draft) => draft.ldApplicable !== 'Yes'
      },
      {
        key: 'ldSupplyAmount',
        label: 'LD (a) — Supply Delay',
        source: 'computed',
        type: 'currency',
        hint: '0.5% of RV value per week or part thereof',
        hiddenWhen: (draft) => draft.ldApplicable !== 'Yes'
      },
      {
        key: 'ldByFtr',
        label: 'Calculate LD on FTR date (Installation & Commissioning)',
        source: 'maker',
        type: 'select',
        options: ['Yes', 'No'],
        hint: 'Enables the manual I&C entry (b)',
        disabledWhen: (d) => d.ldApplicable !== 'Yes'
      },
      {
        key: 'ldIcAmount',
        label: 'LD (b) — Installation & Commissioning',
        source: 'maker',
        type: 'amount',
        hint: 'Manual, per FTR date — totals recompute on save',
        disabledWhen: (d) => d.ldApplicable !== 'Yes' || d.ldByFtr !== 'Yes'
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
    title: 'Verification & Forwarding',
    fields: [
      {
        key: 'checkingOfficerPbNo',
        label: 'Person Checking & Forwarding (PB No / Officer)',
        source: 'maker',
        type: 'select',
        options: [
          'PB-44821 (R. Deshpande / Purchase Officer)',
          'PB-43977 (A. K. Sharma / Purchase Officer)',
          'PB-45110 (S. Kulkarni / Purchase Officer)',
          'PB-44731 (Yogesh M. / Purchase Maker)'
        ],
        required: true
      },
      {
        key: 'makerRemark',
        label: 'Maker Remark (Yogesh M.)',
        source: 'maker',
        type: 'textarea',
        quickOptions: [
          'Invoice verified against RV and PO terms.',
          'Bank details on invoice verified and matched with HAL data.',
          'Bank account mismatch flagged — revised details required.',
          'All supporting documents have been checked.'
        ]
      }
    ]
  },
  {
    title: 'Securities & Holds',
    render: (pa, editable, ctx) => (
      <SecuritiesPanel pa={pa} editable={editable} draft={ctx?.draft} onChange={ctx?.onChange} />
    )
  }
];

const VIRTUAL_MAKER_FIELDS = [{ key: 'securitiesRemark', source: 'maker', type: 'textarea' }];

export const PA_MAKER_FIELDS = [
  ...PA_FORM_SECTIONS.flatMap((s) => s.fields ?? []),
  ...VIRTUAL_MAKER_FIELDS
].filter((f) => f.source === 'maker');

export const PA_REQUIRED_FIELDS = PA_MAKER_FIELDS.filter((f) => f.required).map((f) => f.key);
