// Screen 2 (Payment Advice — maker verification) field config. Sections and fields
// render straight from this file; client feedback edits happen here, not in the screen.
//
// Field shape:
//   key       — property on the PA object from the API
//   label     — display label
//   source    — 'ifs' (ERP-fetched, read-only, tagged IFS) | 'maker' (input) |
//               'computed' (server-computed, read-only, tagged Computed)
//   type      — text | date | currency | pill | date-input | textarea
//   required  — maker fields that must be filled before forwarding
//   render(pa)— optional custom display for read-only fields
//   emphasis  — render value large/bold (final payment)
//   hint      — small helper text under the value

export const PA_FORM_SECTIONS = [
  {
    title: 'RV & PO Details',
    fields: [
      { key: 'rvNo', label: 'RV No', source: 'ifs' },
      { key: 'rvDate', label: 'RV Date', source: 'ifs', type: 'date' },
      { key: 'gateEntryNo', label: 'Gate Entry No', source: 'ifs' },
      { key: 'gateEntryDate', label: 'Gate Entry Date', source: 'ifs', type: 'date' },
      { key: 'qcDate', label: 'QC Acceptance Date', source: 'ifs', type: 'date' },
      { key: 'ftrDate', label: 'FTR Date', source: 'ifs', type: 'date' },
      { key: 'poNo', label: 'PO No', source: 'ifs' },
      { key: 'poDate', label: 'PO Date', source: 'ifs', type: 'date' },
      { key: 'deliveryDueDate', label: 'Delivery Due (PO)', source: 'ifs', type: 'date' }
    ]
  },
  {
    title: 'Vendor',
    fields: [
      { key: 'vendorName', label: 'Vendor', source: 'ifs' },
      { key: 'gstin', label: 'GSTIN', source: 'ifs' },
      { key: 'mseCategory', label: 'Category', source: 'ifs', type: 'pill' }
    ]
  },
  {
    title: 'Invoice — Maker Entry',
    fields: [
      { key: 'invoiceNo', label: 'Invoice No', source: 'maker', type: 'text', required: true },
      { key: 'invoiceDate', label: 'Invoice Date', source: 'maker', type: 'date-input', required: true },
      { key: 'makerRemark', label: 'Maker Remark', source: 'maker', type: 'textarea' }
    ]
  },
  {
    title: 'Payment Computation',
    fields: [
      { key: 'rvValue', label: 'RV Value', source: 'ifs', type: 'currency' },
      { key: 'poValue', label: 'PO Order Value', source: 'ifs', type: 'currency', hint: 'LD cap base' },
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
  }
];

// Keys the maker edits locally before save/forward.
export const PA_MAKER_FIELDS = PA_FORM_SECTIONS.flatMap((s) => s.fields).filter(
  (f) => f.source === 'maker'
);

export const PA_REQUIRED_FIELDS = PA_MAKER_FIELDS.filter((f) => f.required).map((f) => f.key);
