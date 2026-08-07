import { useState } from 'react';

// Generic capture dialog used by ApprovalQueue when an action declares `fields`.
// Collects a few values (e.g. CPPC PPR no/date, or a send-back remark) and hands
// them back on submit. Submit stays disabled until every required field is filled,
// so the queue never fires a transition the state machine would reject.
//
// fields = [{ key, label, type?: 'text' | 'date' | 'textarea', required?, placeholder? }]
export default function CaptureModal({ title, fields, submitLabel, busy, onSubmit, onCancel }) {
  const [values, setValues] = useState(
    Object.fromEntries(fields.map((f) => [f.key, '']))
  );

  const setValue = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  const missing = fields.filter((f) => f.required && !String(values[f.key]).trim());

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onCancel}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">
          {fields.map((field) => (
            <label className="field" key={field.key}>
              <span className="field-label">
                {field.label}
                {field.required && <span className="req">*</span>}
              </span>
              {field.type === 'textarea' ? (
                <>
                  <textarea
                    className="field-input"
                    rows={3}
                    placeholder={field.placeholder}
                    value={values[field.key]}
                    disabled={busy}
                    onChange={(e) => setValue(field.key, e.target.value)}
                  />
                  {field.quickOptions && (
                    <div className="remark-options">
                      {field.quickOptions.map((option) => (
                        <button type="button" className="remark-option" key={option} disabled={busy} onClick={() => setValue(field.key, option)}>
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <input
                  className="field-input"
                  type={field.type === 'date' ? 'date' : 'text'}
                  placeholder={field.placeholder}
                  value={values[field.key]}
                  disabled={busy}
                  onChange={(e) => setValue(field.key, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={() => onSubmit(values)}
            disabled={busy || missing.length > 0}
            title={missing.length > 0 ? `Required: ${missing.map((f) => f.label).join(', ')}` : undefined}
          >
            {submitLabel ?? 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
