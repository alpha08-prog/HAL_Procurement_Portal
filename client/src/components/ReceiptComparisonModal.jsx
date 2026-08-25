import { useState } from 'react';
import { apiFetch } from '../lib/api.js';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';

export default function ReceiptComparisonModal({ row, onClose, onWaiverSuccess, onCnSuccess }) {
  const invoiceVal = Number(row.invoiceValue ?? row.poValue ?? 0);
  const rvVal = Number(row.rvValue ?? 0);
  const diffAmount = Math.abs(invoiceVal - rvVal);
  const isMinor = diffAmount <= 10;

  // Default decision: If already waived, 'no'. If already uploaded, 'yes'. If diff is minor, 'no'.
  const initialMode = row.creditNoteWaived
    ? 'no'
    : row.creditNoteUploaded
    ? 'yes'
    : isMinor
    ? 'no'
    : 'no';

  const [decision, setDecision] = useState(initialMode); // 'no' | 'yes'

  // Waiver fields
  const defaultWaiverReason =
    row.creditNoteWaiverReason ||
    (isMinor
      ? `Minor rounding difference (${formatINR(diffAmount)}) within permissible tolerance. Credit note waived by Purchase Maker.`
      : `Discrepancy of ${formatINR(diffAmount)} reconciled against PO terms. Payment to be processed on accepted RV value (${formatINR(rvVal)}). Credit note waived.`);

  const [waiverReason, setWaiverReason] = useState(defaultWaiverReason);

  // CN Upload fields
  const defaultCnNo = row.creditNoteNo || `CN/${(row.rvNo || 'RV').replaceAll('/', '-')}`;
  const defaultFile = row.creditNoteFileName || `CreditNote_${(row.rvNo || 'RV').replaceAll('/', '_')}.pdf`;
  const [creditNoteNo, setCreditNoteNo] = useState(defaultCnNo);
  const [fileName, setFileName] = useState(defaultFile);
  const [cnRemarks, setCnRemarks] = useState(row.creditNoteRemarks || 'Credit note for price/qty difference issued by vendor.');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const quickWaiverPills = [
    `Minor rounding difference (${formatINR(diffAmount)}) within tolerance; waived.`,
    'Fractional GST / paise rounding variance reconciled by Purchase Maker.',
    `Discrepancy of ${formatINR(diffAmount)} verified against inspection; cleared on accepted RV value.`,
    'Immaterial variance approved for payment advice generation.'
  ];

  const handleWaiverSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!waiverReason.trim()) {
      setError('Please enter a justification remark for waiving the credit note.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch('/api/payment-advices/credit-note-waiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rvNo: row.rvNo,
          paNo: row.paNo,
          creditNoteRequired: false,
          waiverReason: waiverReason.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
      onWaiverSuccess?.({
        rvNo: row.rvNo,
        creditNoteWaived: true,
        creditNoteRequired: false,
        creditNoteWaiverReason: waiverReason.trim()
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCnSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!creditNoteNo.trim()) {
      setError('Please enter a valid Credit Note number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch('/api/payment-advices/credit-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rvNo: row.rvNo,
          paNo: row.paNo,
          creditNoteNo: creditNoteNo.trim(),
          fileName: fileName.trim(),
          remarks: cnRemarks.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
      onCnSuccess?.(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
    >
      <div
        className="modal-card"
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          padding: '24px',
          boxSizing: 'border-box',
          border: '1px solid #cbd5e1'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '16px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '12px'
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 700 }}>
              Hindustan Aeronautics Limited · Stores & Accounts Reconciliation
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.35rem', color: '#0f172a', fontWeight: 700 }}>
              Receipt Comparison & Credit Note Decision
            </h2>
            <div style={{ fontSize: '0.875rem', color: '#475569', marginTop: '2px' }}>
              Verify claimed vendor tax invoice against accepted stores receipt voucher for <strong>{row.rvNo}</strong> (PO: {row.poNo})
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              cursor: 'pointer',
              color: '#475569'
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '0.875rem'
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Discrepancy KPI Banner */}
        <div
          style={{
            background: isMinor ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${isMinor ? '#bbf7d0' : '#fde68a'}`,
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Claimed Invoice Value
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                {formatINR(invoiceVal)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '1.25rem' }}>
              vs
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Accepted RV Value
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#15803d' }}>
                {formatINR(rvVal)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Discrepancy Amount
              </div>
              <div
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: isMinor ? '#166534' : '#b45309'
                }}
              >
                {formatINR(diffAmount)}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              background: isMinor ? '#dcfce7' : '#fef3c7',
              color: isMinor ? '#166534' : '#92400e',
              border: `1px solid ${isMinor ? '#86efac' : '#fcd34d'}`
            }}
          >
            {isMinor ? `Minor / Rounding Variance (${formatINR(diffAmount)})` : `Material Discrepancy (${formatINR(diffAmount)})`}
          </div>
        </div>

        {/* Both Receipts Side-by-Side View */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          {/* Receipt 1: Vendor Tax Invoice */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '16px',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                  Vendor Tax Invoice (Claim)
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                Vendor Bill
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Invoice Number</span>
                <strong>{row.invoiceNo || 'INV-Pending'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Invoice Date</span>
                <strong>{formatDate(row.invoiceDate)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Vendor Name</span>
                <span>{row.vendorName} ({row.vendorId})</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Waybill No & Date</span>
                <span>{row.waybillNo || '—'} {row.waybillDate ? `(${formatDate(row.waybillDate)})` : ''}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>PO Description</span>
                <span style={{ color: '#334155' }}>{row.description || 'Supply of stores / equipment'}</span>
              </div>
              <div style={{ gridColumn: 'span 2', marginTop: '6px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>Total Invoiced / Claimed:</span>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{formatINR(invoiceVal)}</span>
              </div>
            </div>
          </div>

          {/* Receipt 2: HAL Receipt Voucher (RV) */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #93c5fd',
              borderRadius: '8px',
              padding: '16px',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #bfdbfe', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e3a8a' }}>
                  HAL Stores Receipt Voucher (RV)
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                Accepted Stores
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>RV Number & Ref</span>
                <strong>{row.rvNo}</strong> <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({row.refNo})</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>RV Date</span>
                <strong>{formatDate(row.rvDate)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Gate Entry No & Date</span>
                <span>{row.gateEntryNo || '—'} {row.gateEntryDate ? `(${formatDate(row.gateEntryDate)})` : ''}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>QC / Inspection Date</span>
                <span>{formatDate(row.qcDate || row.ftrDate || row.chargeApprovalDate || row.receiptDate)}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>PO Officer / Stores</span>
                <span style={{ color: '#334155' }}>{row.poOfficer || 'Stores Officer / Aircraft Overhaul Div'}</span>
              </div>
              <div style={{ gridColumn: 'span 2', marginTop: '6px', paddingTop: '8px', borderTop: '1px dashed #93c5fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#1e3a8a' }}>Total Stores Accepted:</span>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#15803d' }}>{formatINR(rvVal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reconciliation Breakdown */}
        <div style={{ background: '#f1f5f9', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem', color: '#334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span><strong>Reconciliation Summary:</strong> Invoiced {formatINR(invoiceVal)} – Accepted {formatINR(rvVal)} = <strong>Net Discrepancy: {formatINR(diffAmount)}</strong></span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {isMinor
              ? `💡 This is a minor discrepancy (≤ ₹10), commonly occurring from line-item rounding or fractional GST. Purchase Maker can waive the credit note to proceed immediately with Payment Advice generation.`
              : `💡 A material variance exists between invoiced claim and accepted RV value. You may either waive it with specific justification or upload a formal vendor credit note.`}
          </div>
        </div>

        {/* Decision & Action Selector */}
        <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '18px', background: '#ffffff', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
            Purchase Maker Credit Note Determination
          </h3>
          <p style={{ margin: '0 0 14px', fontSize: '0.875rem', color: '#475569' }}>
            Is a formal Credit Note required from the vendor to proceed with Payment Advice creation?
          </p>

          {/* Tab Selector */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
            <button
              type="button"
              onClick={() => {
                setDecision('no');
                setError(null);
              }}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '6px',
                border: `2px solid ${decision === 'no' ? '#22c55e' : '#cbd5e1'}`,
                background: decision === 'no' ? '#f0fdf4' : '#ffffff',
                color: decision === 'no' ? '#15803d' : '#475569',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <input
                type="radio"
                name="cn-decision"
                checked={decision === 'no'}
                onChange={() => {}}
                style={{ cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '0.95rem' }}>NO — Credit Note NOT Required (Waive)</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b', marginTop: '2px' }}>
                  Ideal for ₹1 rounding, fractional tax, or acceptable variances. Enables PA immediately.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setDecision('yes');
                setError(null);
              }}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '6px',
                border: `2px solid ${decision === 'yes' ? '#3b82f6' : '#cbd5e1'}`,
                background: decision === 'yes' ? '#eff6ff' : '#ffffff',
                color: decision === 'yes' ? '#1d4ed8' : '#475569',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <input
                type="radio"
                name="cn-decision"
                checked={decision === 'yes'}
                onChange={() => {}}
                style={{ cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '0.95rem' }}>YES — Credit Note Required &amp; Upload</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b', marginTop: '2px' }}>
                  Attach formal vendor credit note document and reference number.
                </div>
              </div>
            </button>
          </div>

          {/* Form based on Decision */}
          {decision === 'no' ? (
            <form onSubmit={handleWaiverSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Waiver Justification / Remarks <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  className="field-input"
                  rows={3}
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                  placeholder="State reason for waiving credit note (e.g. minor rounding discrepancy)..."
                  required
                  disabled={busy}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              {/* Quick Remark Pills */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>
                  Quick Fill Examples:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {quickWaiverPills.map((pill, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setWaiverReason(pill)}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        color: '#334155',
                        textAlign: 'left'
                      }}
                    >
                      + {pill}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={busy}
                  style={{ background: '#16a34a', borderColor: '#16a34a', color: '#ffffff', fontWeight: 600 }}
                >
                  {busy ? 'Processing...' : 'Confirm: No Credit Note Required & Enable PA'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCnSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Credit Note Number <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="field-input"
                    value={creditNoteNo}
                    onChange={(e) => setCreditNoteNo(e.target.value)}
                    placeholder="e.g. CN/2026/001"
                    required
                    disabled={busy}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Credit Note Document <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="file"
                      id="cn-upload-file"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                      disabled={busy}
                    />
                    <label
                      htmlFor="cn-upload-file"
                      className="btn btn-secondary"
                      style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
                    >
                      Browse PDF
                    </label>
                    <span style={{ fontSize: '0.8125rem', color: '#475569', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {fileName}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Remarks / Justification
                </label>
                <textarea
                  className="field-input"
                  rows={2}
                  value={cnRemarks}
                  onChange={(e) => setCnRemarks(e.target.value)}
                  placeholder="Optional remarks regarding uploaded credit note..."
                  disabled={busy}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={busy}
                  style={{ fontWeight: 600 }}
                >
                  {busy ? 'Uploading...' : 'Upload Credit Note & Enable PA'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
