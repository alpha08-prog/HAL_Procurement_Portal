import { useState, useEffect } from 'react';
import { useRole } from '../context/RoleContext.jsx';

/**
 * ThreeWayBankVerification
 * 
 * Implements requirement:
 * 1. Bank Details as per PO
 * 2. Bank Detail as Per IFS
 * 3. Bank Detail as Per Invoice
 * 
 * Checks if all match. In case not matching:
 * - Option to upload Approval from Competent authority to transfer payment in Invoice Bank Details
 * - Option for Uploading Vendor request to consider HAL PO/IFS bank Details for Payment Transfer
 * - Once uploaded, option appears to select which account payment is to be transferred
 * - Mismatch described in Remarks / Foot note
 */
export default function ThreeWayBankVerification({
  pa,
  editable = false,
  draft,
  onChange
}) {
  const poBank = draft?.poBank ?? pa?.poBank ?? pa?.vendorBank ?? {
    name: 'State Bank of India',
    accountNo: '30912345678',
    ifsc: 'SBIN0004321',
    branch: 'HAL Old Airport Road, Bengaluru'
  };

  const ifsBank = draft?.ifsBank ?? pa?.ifsBank ?? pa?.vendorBank ?? {
    name: 'State Bank of India',
    accountNo: '30912345678',
    ifsc: 'SBIN0004321',
    branch: 'HAL Old Airport Road, Bengaluru'
  };

  const invoiceBank = draft?.invoiceBank ?? pa?.invoiceBank ?? (
    (draft?.bankMismatch === 'Yes' || pa?.bankMismatch)
      ? {
          name: 'HDFC Bank',
          accountNo: '998811223344',
          ifsc: 'HDFC0009999',
          branch: 'Nariman Point, Mumbai'
        }
      : {
          name: 'State Bank of India',
          accountNo: '30912345678',
          ifsc: 'SBIN0004321',
          branch: 'HAL Old Airport Road, Bengaluru'
        }
  );

  // The mismatch toggle and the instant-upload shortcuts exist to rehearse the flow; they
  // are shown only to an admin account in a dev build, never in a client demo.
  const { accountRole } = useRole();
  const showDemoTools = editable && accountRole === 'admin' && import.meta.env.DEV;

  const caApprovalUploaded = Boolean(draft?.caApprovalUploaded ?? pa?.caApprovalUploaded);
  const vendorRequestUploaded = Boolean(draft?.vendorRequestUploaded ?? pa?.vendorRequestUploaded);
  const selectedPaymentBank = draft?.selectedPaymentBank ?? pa?.selectedPaymentBank ?? (draft?.bankMismatch === 'Yes' || pa?.bankMismatch ? null : 'po_ifs');

  // Check matching
  const poIfsMatch = poBank.accountNo === ifsBank.accountNo && poBank.ifsc === ifsBank.ifsc;
  const poInvoiceMatch = poBank.accountNo === invoiceBank.accountNo && poBank.ifsc === invoiceBank.ifsc;
  const ifsInvoiceMatch = ifsBank.accountNo === invoiceBank.accountNo && ifsBank.ifsc === invoiceBank.ifsc;
  const allMatch = poIfsMatch && poInvoiceMatch && ifsInvoiceMatch;

  // Local state for interactive upload simulations / file names
  const [caFileName, setCaFileName] = useState(draft?.caApprovalFileName || pa?.caApprovalFileName || 'CA_Approval_InvoiceBank_Release.pdf');
  const [caRefNo, setCaRefNo] = useState(draft?.caApprovalAuthority || pa?.caApprovalAuthority || 'GM (IMM) / Ref: HAL/IMM/BNK-APP/2026/08');
  const [vendorFileName, setVendorFileName] = useState(draft?.vendorRequestFileName || pa?.vendorRequestFileName || 'Vendor_Request_PO_Bank.pdf');
  const [vendorRefNo, setVendorRefNo] = useState(draft?.vendorRequestRef || pa?.vendorRequestRef || 'Vendor Ref: BAC/FIN/2026/114');

  // Generate standardized footnote text
  const generateFootnote = (targetBank, hasCa, hasVendor) => {
    if (allMatch) {
      return '';
    }
    const invDesc = `${invoiceBank.name} (A/C: ${invoiceBank.accountNo}, IFSC: ${invoiceBank.ifsc})`;
    const poDesc = `${poBank.name} (A/C: ${poBank.accountNo}, IFSC: ${poBank.ifsc})`;
    
    let resolutionText = '';
    if (targetBank === 'invoice') {
      resolutionText = `Approval from Competent Authority [${caRefNo}] obtained to transfer payment into Invoice Bank Details.`;
    } else if (targetBank === 'po_ifs') {
      resolutionText = `Vendor request letter [${vendorRefNo}] obtained to consider HAL PO/IFS Bank Details for payment transfer.`;
    } else if (hasCa || hasVendor) {
      resolutionText = `Resolution documents uploaded. Selected target account: ${targetBank === 'invoice' ? 'Invoice Bank Details' : 'HAL PO/IFS Bank Details'}.`;
    } else {
      resolutionText = `Discrepancy pending resolution (Upload Competent Authority approval or Vendor request letter).`;
    }

    const targetDesc = targetBank === 'invoice'
      ? `Invoice Account: ${invoiceBank.name}, A/C: ${invoiceBank.accountNo}, IFSC: ${invoiceBank.ifsc}`
      : `HAL PO/IFS Account: ${poBank.name}, A/C: ${poBank.accountNo}, IFSC: ${poBank.ifsc}`;

    return `Footnote: Bank account details on Invoice (${invDesc}) do not match HAL PO/IFS master records (${poDesc}). ${resolutionText} Payment is designated for transfer into ${targetDesc}. Relevant supporting documents enclosed.`;
  };

  // Sync footnote when bank details, uploads, or target changes
  const updateResolutionState = (newCa, newVendor, newTarget, newInvoiceBank = invoiceBank) => {
    const isMismatch = !(poBank.accountNo === newInvoiceBank.accountNo && poBank.ifsc === newInvoiceBank.ifsc);
    const resolved = isMismatch ? Boolean(newTarget && ((newTarget === 'invoice' && newCa) || (newTarget === 'po_ifs' && newVendor) || (newCa && newVendor))) : true;
    const fn = isMismatch ? generateFootnote(newTarget, newCa, newVendor) : '';

    if (onChange) {
      onChange('bankMismatch', isMismatch ? 'Yes' : 'No');
      onChange('bankMismatchResolved', resolved);
      onChange('caApprovalUploaded', newCa);
      onChange('caApprovalFileName', newCa ? caFileName : null);
      onChange('caApprovalAuthority', newCa ? caRefNo : null);
      onChange('vendorRequestUploaded', newVendor);
      onChange('vendorRequestFileName', newVendor ? vendorFileName : null);
      onChange('vendorRequestRef', newVendor ? vendorRefNo : null);
      onChange('selectedPaymentBank', newTarget);
      onChange('bankFootnote', fn);

      // If resolved and footnote exists, also suggest or append to makerRemark if empty
      if (fn && (!draft?.makerRemark || draft.makerRemark.includes('Bank account') || draft.makerRemark.includes('Footnote:'))) {
        onChange('makerRemark', fn);
      }
    }
  };

  const toggleMismatchSimulation = () => {
    if (!editable) return;
    if (allMatch) {
      // Switch to mismatch
      const diffBank = {
        name: 'HDFC Bank',
        accountNo: '998811223344',
        ifsc: 'HDFC0009999',
        branch: 'Nariman Point, Mumbai'
      };
      onChange?.('invoiceBank', diffBank);
      updateResolutionState(false, false, null, diffBank);
    } else {
      // Switch to match
      const matchingBank = { ...poBank };
      onChange?.('invoiceBank', matchingBank);
      onChange?.('bankMismatch', 'No');
      onChange?.('bankMismatchResolved', true);
      onChange?.('selectedPaymentBank', 'po_ifs');
      onChange?.('bankFootnote', '');
      onChange?.('caApprovalUploaded', false);
      onChange?.('vendorRequestUploaded', false);
    }
  };

  const handleCaUpload = (e) => {
    if (!editable) return;
    const file = e.target.files?.[0];
    const name = file ? file.name : 'CA_Approval_InvoiceBank_Release.pdf';
    setCaFileName(name);
    const newTarget = selectedPaymentBank || 'invoice';
    updateResolutionState(true, vendorRequestUploaded, newTarget);
  };

  const handleVendorUpload = (e) => {
    if (!editable) return;
    const file = e.target.files?.[0];
    const name = file ? file.name : 'Vendor_Request_PO_Bank.pdf';
    setVendorFileName(name);
    const newTarget = selectedPaymentBank || 'po_ifs';
    updateResolutionState(caApprovalUploaded, true, newTarget);
  };

  const handleAccountSelection = (target) => {
    if (!editable) return;
    updateResolutionState(caApprovalUploaded, vendorRequestUploaded, target);
  };

  return (
    <div className="three-way-bank-verification" style={{ width: '100%' }}>
      {/* Top Banner Status */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          background: allMatch ? '#f0fdf4' : '#fff7ed',
          border: `1.5px solid ${allMatch ? '#22c55e' : '#f97316'}`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>{allMatch ? '✅' : '⚠️'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: allMatch ? '#15803d' : '#9a3412' }}>
              {allMatch
                ? 'All 3 Bank Details Match (PO, IFS & Invoice)'
                : 'Bank Account Discrepancy Detected (Invoice Details Differ)'}
            </div>
            <div style={{ fontSize: '0.82rem', color: allMatch ? '#166534' : '#c2410c' }}>
              {allMatch
                ? 'Vendor bank account verified across PO, IFS Master and Invoice.'
                : 'Bank account stated on Invoice does not match HAL PO / IFS master records.'}
            </div>
          </div>
        </div>

        {showDemoTools && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={toggleMismatchSimulation}
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            title="Click to toggle between matching and mismatching bank details for verification test"
          >
            {allMatch ? '⇄ Test Mismatch Scenario' : '⇄ Reset to Matching Data'}
          </button>
        )}
      </div>

      {/* 3 Bank Detail Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '14px',
          marginBottom: '20px'
        }}
      >
        {/* Card 1: Bank Details as per PO */}
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #cbd5e1',
            borderRadius: '8px',
            padding: '14px 16px',
            position: 'relative',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '0.9rem' }}>
              1. Bank Details as per PO
            </span>
            <span style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              PO Master
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: '#334155' }}>
            <div><strong>Bank Name:</strong> {poBank.name}</div>
            <div><strong>Account No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.92rem' }}>{poBank.accountNo}</span></div>
            <div><strong>IFSC Code:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{poBank.ifsc}</span></div>
            <div><strong>Branch:</strong> {poBank.branch || 'Main Branch'}</div>
          </div>
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>
            Source: HAL Purchase Order ({pa?.poNo || 'PO Contract'})
          </div>
        </div>

        {/* Card 2: Bank Detail as per IFS */}
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #cbd5e1',
            borderRadius: '8px',
            padding: '14px 16px',
            position: 'relative',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '0.9rem' }}>
              2. Bank Detail as per IFS
            </span>
            <span style={{ fontSize: '0.75rem', background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              IFS ERP Master
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: '#334155' }}>
            <div><strong>Bank Name:</strong> {ifsBank.name}</div>
            <div><strong>Account No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.92rem' }}>{ifsBank.accountNo}</span></div>
            <div><strong>IFSC Code:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ifsBank.ifsc}</span></div>
            <div><strong>Branch:</strong> {ifsBank.branch || 'Main Branch'}</div>
          </div>
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>
            Source: HAL Enterprise IFS ERP Master
          </div>
        </div>

        {/* Card 3: Bank Detail as per Invoice */}
        <div
          style={{
            background: allMatch ? '#ffffff' : '#fffbeb',
            border: `1.5px solid ${allMatch ? '#cbd5e1' : '#f59e0b'}`,
            borderRadius: '8px',
            padding: '14px 16px',
            position: 'relative',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, color: allMatch ? '#1e3a8a' : '#b45309', fontSize: '0.9rem' }}>
              3. Bank Detail as per Invoice
            </span>
            <span style={{ fontSize: '0.75rem', background: allMatch ? '#f1f5f9' : '#fef3c7', color: allMatch ? '#475569' : '#92400e', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              Vendor Invoice
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: '#334155' }}>
            <div><strong>Bank Name:</strong> {invoiceBank.name}</div>
            <div>
              <strong>Account No:</strong>{' '}
              <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.92rem', color: allMatch ? '#334155' : '#b45309' }}>
                {invoiceBank.accountNo}
              </span>
              {!allMatch && <span style={{ color: '#dc2626', marginLeft: 6, fontSize: '0.78rem', fontWeight: 700 }}>(Differing)</span>}
            </div>
            <div><strong>IFSC Code:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{invoiceBank.ifsc}</span></div>
            <div><strong>Branch:</strong> {invoiceBank.branch || 'Corporate Branch'}</div>
          </div>
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>
            Source: Tax Invoice {pa?.invoiceNo || 'Doc'}
          </div>
        </div>
      </div>

      {/* When Mismatched: Upload Requirements & Resolution */}
      {!allMatch && (
        <div
          style={{
            background: '#fafafa',
            border: '1.5px solid #fed7aa',
            borderRadius: '8px',
            padding: '16px 20px',
            marginBottom: '20px'
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#9a3412', marginBottom: '8px' }}>
            📑 Mismatch Resolution Documentation &amp; Uploads
          </div>
          <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: '#7c2d12', lineHeight: 1.4 }}>
            In accordance with HAL Finance guidelines, when invoice bank details differ from PO / IFS records, you must upload either <strong>Competent Authority Approval</strong> (to transfer into Invoice bank details) or <strong>Vendor Request Letter</strong> (to consider HAL PO/IFS bank details).
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '16px',
              marginBottom: '16px'
            }}
          >
            {/* Upload Option 1: Approval from Competent Authority */}
            <div
              style={{
                background: '#ffffff',
                border: `1.5px solid ${caApprovalUploaded ? '#22c55e' : '#e2e8f0'}`,
                borderRadius: '6px',
                padding: '12px 14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <strong style={{ fontSize: '0.86rem', color: '#1e293b' }}>
                  Option A: Approval from Competent Authority
                </strong>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    background: caApprovalUploaded ? '#dcfce7' : '#f1f5f9',
                    color: caApprovalUploaded ? '#15803d' : '#64748b'
                  }}
                >
                  {caApprovalUploaded ? '✓ Uploaded' : 'Pending'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '10px' }}>
                Required to transfer payment into <strong>Invoice Bank Details</strong>.
              </div>

              {editable ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                      Choose File
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleCaUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {showDemoTools && (
                      <button
                        type="button"
                        className="link-btn"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => {
                          const newTarget = selectedPaymentBank || 'invoice';
                          updateResolutionState(!caApprovalUploaded, vendorRequestUploaded, newTarget);
                        }}
                      >
                        {caApprovalUploaded ? 'Remove Upload' : 'Simulate Instant Upload'}
                      </button>
                    )}
                  </div>
                  {caApprovalUploaded && (
                    <div style={{ fontSize: '0.78rem', color: '#15803d', background: '#f0fdf4', padding: '6px 8px', borderRadius: '4px' }}>
                      📄 <strong>{caFileName}</strong>
                      <div>{caRefNo}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: caApprovalUploaded ? '#15803d' : '#64748b' }}>
                  {caApprovalUploaded ? `📄 ${caFileName} (${caRefNo})` : 'Not uploaded'}
                </div>
              )}
            </div>

            {/* Upload Option 2: Vendor Request Letter */}
            <div
              style={{
                background: '#ffffff',
                border: `1.5px solid ${vendorRequestUploaded ? '#22c55e' : '#e2e8f0'}`,
                borderRadius: '6px',
                padding: '12px 14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <strong style={{ fontSize: '0.86rem', color: '#1e293b' }}>
                  Option B: Vendor Request to Consider PO/IFS Details
                </strong>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    background: vendorRequestUploaded ? '#dcfce7' : '#f1f5f9',
                    color: vendorRequestUploaded ? '#15803d' : '#64748b'
                  }}
                >
                  {vendorRequestUploaded ? '✓ Uploaded' : 'Pending'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '10px' }}>
                Required to consider <strong>HAL PO / IFS Bank Details</strong> for payment transfer.
              </div>

              {editable ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                      Choose File
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleVendorUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {showDemoTools && (
                      <button
                        type="button"
                        className="link-btn"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => {
                          const newTarget = selectedPaymentBank || 'po_ifs';
                          updateResolutionState(caApprovalUploaded, !vendorRequestUploaded, newTarget);
                        }}
                      >
                        {vendorRequestUploaded ? 'Remove Upload' : 'Simulate Instant Upload'}
                      </button>
                    )}
                  </div>
                  {vendorRequestUploaded && (
                    <div style={{ fontSize: '0.78rem', color: '#15803d', background: '#f0fdf4', padding: '6px 8px', borderRadius: '4px' }}>
                      📄 <strong>{vendorFileName}</strong>
                      <div>{vendorRefNo}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: vendorRequestUploaded ? '#15803d' : '#64748b' }}>
                  {vendorRequestUploaded ? `📄 ${vendorFileName} (${vendorRefNo})` : 'Not uploaded'}
                </div>
              )}
            </div>
          </div>

          {/* Account Selection for Payment Transfer */}
          <div
            style={{
              marginTop: '16px',
              padding: '14px',
              background: '#ffffff',
              borderRadius: '6px',
              border: '1.5px solid #e2e8f0'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e3a8a', marginBottom: '6px' }}>
              🎯 Select Account in which Payment is to be Transferred:
            </div>
            <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '12px' }}>
              Select which verified bank account will receive the payment transfer. This decision will govern the payment advice and CPPC voucher.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Option 1: Invoice Bank Details */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: `1.5px solid ${selectedPaymentBank === 'invoice' ? '#2563eb' : '#cbd5e1'}`,
                  background: selectedPaymentBank === 'invoice' ? '#eff6ff' : '#ffffff',
                  cursor: (editable && caApprovalUploaded) ? 'pointer' : 'not-allowed',
                  opacity: (!caApprovalUploaded && editable) ? 0.65 : 1
                }}
              >
                <input
                  type="radio"
                  name="selectedPaymentBank"
                  value="invoice"
                  checked={selectedPaymentBank === 'invoice'}
                  disabled={!editable || !caApprovalUploaded}
                  onChange={() => handleAccountSelection('invoice')}
                  style={{ marginTop: '3px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>
                      Transfer to Invoice Bank Details ({invoiceBank.name})
                    </span>
                    {selectedPaymentBank === 'invoice' && (
                      <span style={{ fontSize: '0.72rem', background: '#2563eb', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        ★ SELECTED FOR PAYMENT
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                    A/C: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{invoiceBank.accountNo}</span> · IFSC: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{invoiceBank.ifsc}</span> · {invoiceBank.branch}
                  </div>
                  {!caApprovalUploaded && (
                    <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '2px' }}>
                      ⚠️ Requires Upload of Competent Authority Approval
                    </div>
                  )}
                </div>
              </label>

              {/* Option 2: PO / IFS Bank Details */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: `1.5px solid ${selectedPaymentBank === 'po_ifs' ? '#2563eb' : '#cbd5e1'}`,
                  background: selectedPaymentBank === 'po_ifs' ? '#eff6ff' : '#ffffff',
                  cursor: (editable && vendorRequestUploaded) ? 'pointer' : 'not-allowed',
                  opacity: (!vendorRequestUploaded && editable) ? 0.65 : 1
                }}
              >
                <input
                  type="radio"
                  name="selectedPaymentBank"
                  value="po_ifs"
                  checked={selectedPaymentBank === 'po_ifs'}
                  disabled={!editable || !vendorRequestUploaded}
                  onChange={() => handleAccountSelection('po_ifs')}
                  style={{ marginTop: '3px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>
                      Transfer to HAL PO / IFS Bank Details ({poBank.name})
                    </span>
                    {selectedPaymentBank === 'po_ifs' && (
                      <span style={{ fontSize: '0.72rem', background: '#2563eb', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        ★ SELECTED FOR PAYMENT
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                    A/C: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{poBank.accountNo}</span> · IFSC: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{poBank.ifsc}</span> · {poBank.branch}
                  </div>
                  {!vendorRequestUploaded && (
                    <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '2px' }}>
                      ⚠️ Requires Upload of Vendor Request Letter
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Standardized Footnote / Remark Preview */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>
              📝 Footnote / Remark to be Described in Payment Advice Note:
            </div>
            <div
              style={{
                padding: '10px 14px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.82rem',
                color: '#1e293b',
                lineHeight: 1.45,
                fontStyle: 'italic'
              }}
            >
              {draft?.bankFootnote || pa?.bankFootnote || generateFootnote(selectedPaymentBank, caApprovalUploaded, vendorRequestUploaded)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
