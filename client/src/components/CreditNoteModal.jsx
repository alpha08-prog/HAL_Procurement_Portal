import { useState } from 'react';
import { apiFetch } from '../lib/api.js';
import { formatINR } from '../lib/currency.js';

export default function CreditNoteModal({ row, onClose, onSuccess }) {
  const defaultCnNo = row.creditNoteNo || `CN/${(row.rvNo || 'RV').replaceAll('/', '-')}`;
  const defaultFile = row.creditNoteFileName || `CreditNote_${(row.rvNo || 'RV').replaceAll('/', '_')}.pdf`;
  
  const [creditNoteNo, setCreditNoteNo] = useState(defaultCnNo);
  const [fileName, setFileName] = useState(defaultFile);
  const [remarks, setRemarks] = useState(row.creditNoteRemarks || 'Credit note for price/qty difference issued by vendor.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const diffAmount = Math.abs(Number(row.invoiceValue || 0) - Number(row.rvValue || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
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
          remarks: remarks.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
      onSuccess?.(data);
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
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-card" style={{
        background: '#fff',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        padding: '24px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827', fontWeight: 600 }}>
            Upload Credit Note
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>
            ✕
          </button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '4px', marginBottom: '16px', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
            <div><strong>RV No:</strong> {row.rvNo}</div>
            <div><strong>Invoice No:</strong> {row.invoiceNo || '—'}</div>
            <div><strong>Invoice Value:</strong> {formatINR(row.invoiceValue)}</div>
            <div><strong>Accepted RV Value:</strong> {formatINR(row.rvValue)}</div>
          </div>
          {diffAmount > 0 && (
            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1', color: '#b45309', fontWeight: 600 }}>
              Credit Note Difference Amount: {formatINR(diffAmount)}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>
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
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>
              Attach Credit Note Document <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="file"
                id="cn-file-input"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={busy}
              />
              <label
                htmlFor="cn-file-input"
                className="btn btn-secondary"
                style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
              >
                📁 Choose File
              </label>
              <span style={{ fontSize: '0.875rem', color: '#4b5563', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {fileName}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px', color: '#374151' }}>
              Remarks / Justification
            </label>
            <textarea
              className="field-input"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional remarks regarding credit note upload..."
              disabled={busy}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={busy}
            >
              {busy ? 'Uploading...' : 'Upload Credit Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
