import { useState } from 'react';

export default function FinalReviewModal({ isOpen, onClose, formData, onSubmit, busy }) {
  const [totp, setTotp] = useState('');
  const [useTotp, setUseTotp] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="ef-modal-overlay" onClick={onClose}>
      <div className="ef-modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        <div className="ef-modal-header">
          <span>📋 Final Review &amp; Note Submission</span>
          <button type="button" className="ef-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ef-modal-body">
          <div className="banner banner-info" style={{ marginBottom: 16 }}>
            Please review the file summary and routing chain before final submission.
          </div>

          <div style={{ display: 'grid', gap: 12, fontSize: 13 }}>
            <div><strong>Subject / File Title:</strong> {formData.title}</div>
            <div><strong>Reference Kind:</strong> {formData.kind} {formData.carNo ? `(${formData.carNo})` : ''}</div>
            <div><strong>Priority:</strong> {formData.priority || 'Medium'}</div>
            <div><strong>Note Title:</strong> {formData.noteTitle || 'Note N1'}</div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

            <div>
              <strong>Notesheet Content Preview:</strong>
              <div
                style={{
                  background: '#fffff0',
                  padding: 12,
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  maxHeight: 140,
                  overflowY: 'auto',
                  marginTop: 6,
                  fontSize: 12
                }}
                dangerouslySetInnerHTML={{ __html: formData.body }}
              />
            </div>

            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useTotp}
                  onChange={(e) => setUseTotp(e.target.checked)}
                />
                <span>I opt for higher security verification (TOTP / Mobile PIN)</span>
              </label>
            </div>

            {useTotp && (
              <div style={{ marginTop: 8 }}>
                <span className="field-label">Enter 6-digit TOTP / Mobile PIN</span>
                <input
                  className="field-input"
                  maxLength={6}
                  style={{ width: 160, letterSpacing: 4, fontWeight: 700 }}
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                  placeholder="123456"
                />
              </div>
            )}
          </div>
        </div>

        <div className="ef-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Go Back &amp; Edit</button>
          <button
            type="button"
            className="btn"
            disabled={busy || (useTotp && totp.length < 6)}
            onClick={() => onSubmit({ totp: useTotp ? totp : null })}
          >
            {busy ? 'Submitting…' : 'SUBMIT E-FILE'}
          </button>
        </div>
      </div>
    </div>
  );
}
