// The 23-point checklist from the HAL "Payment Advice from Payment Desk to HOD" format.
// Each item's Yes/No/NA value is a prototype default; a few derive from the PA. Client
// feedback edits this file, not the document component.
const yesNo = (b) => (b ? 'Yes' : 'No');

export const CHECKLIST_OPTIONS = ['Yes', 'No', 'NA'];

export function buildChecklist(pa) {
  const ld = pa.ldApplicable === 'Yes';
  const att = pa.attachments ?? {};
  return [
    { n: 1, text: 'Signed PO Original submitted to ABB', value: 'Yes' },
    { n: 2, text: 'Copy of approved PP submitted to ABB', value: 'Yes' },
    { n: 3, text: 'SIGNED TAX INVOICE ENCLOSED', value: yesNo(att.invoice !== 'No') },
    { n: 4, text: 'SIGNED RECEIPT VOUCHER ENCLOSED', value: yesNo(att.rvCopy !== 'No') },
    { n: 5, text: 'GSTIN NO OF VENDOR UPDATED IN IFS', value: 'Yes' },
    { n: 6, text: 'VENDOR AUTHORISED IN IFS', value: 'Yes' },
    { n: 7, text: 'PURCHASE ORDER AMENDMENT TO BE ENCLOSED, IF ANY', value: 'NA' },
    { n: 8, text: 'RECEIPT INTIMATION COPY (IN CASE OF PAYMENT ON RECEIPT OF ITEMS)', value: 'Yes' },
    { n: 9, text: 'FUNCTIONAL TEST REPORTS TO BE ENCLOSED (IF APPLICABLE)', value: yesNo(att.ftr !== 'No') },
    {
      n: 10,
      text: 'BANK GUARANTEE i.e. PBG/SDBG/INDEMNITY BOND TO BE ENCLOSED VERIFIED BY ACCEPTING OFFICER',
      value: 'Yes'
    },
    { n: 11, text: 'ESI/PF CHALLAN ENCLOSED VERIFIED BY ACCEPTING OFFICER', value: 'NA' },
    { n: 12, text: 'LD WAIVER APPROVAL IN CASE LD NOT TO BE DEDUCTED', value: ld ? 'NA' : 'Yes' },
    { n: 13, text: 'No Due/demand certificate/credit note from vendor for final bill', value: 'Yes' },
    { n: 14, text: 'OTHER DOCUMENTS (IF ANY)', value: 'NA' },
    { n: 15, text: 'FINAL DEVIATION STATEMENT/QUALIFIED SUPERVISOR CERTIFICATE', value: 'NA' },
    { n: 16, text: 'LD charges has been fed in PO in IFS', value: ld ? 'Yes' : 'NA' },
    { n: 17, text: 'Project group of PO and line is same', value: 'Yes' },
    { n: 18, text: 'PO status is not in PLANNED stage', value: 'Yes' },
    { n: 19, text: "Invoice Number on RV is matching with Vendor's original Invoice number", value: 'Yes' },
    { n: 20, text: 'RV value is same as Invoice value (If not, state reason)', value: 'Yes' },
    { n: 21, text: 'Line-wise discount feeding in IFS during PO punching (If applicable)', value: 'NA' },
    {
      n: 22,
      text: 'Category of item supplied',
      value: 'Cat A',
      options: ['Cat A', 'Cat B', 'Cat C', 'Cat D'],
      sub: [{ text: 'In case of Cat B/C/D, supplied under warranty', value: 'NA' }]
    },
    {
      n: 23,
      text: 'LD APPLICABLE',
      value: yesNo(ld),
      sub: [
        { text: 'Due Date of Delivery', value: pa.deliveryDueDate, type: 'date' },
        { text: 'Actual Delivery Date', value: pa.receiptDate, type: 'date' },
        { text: 'Delay in weeks', value: ld ? String(pa.ldWeeks ?? 0) : '—' },
        { text: 'Extent of LD', value: ld ? `${((pa.ldWeeks ?? 0) * 0.5).toFixed(1)} %` : '—' }
      ]
    }
  ];
}
