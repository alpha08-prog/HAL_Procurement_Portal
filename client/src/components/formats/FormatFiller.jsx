import { useEffect, useState } from 'react';
import { fetchFormat, renderFormat } from '../../lib/toolsApi.js';
import FormatDocument from './FormatDocument.jsx';

// One library format: a field form on the left (no-print) and the server-rendered document on
// the right (.note-print-area). The server pre-fills from context (contract / PO / RV / user),
// computes every rupee figure and marks computed fields read-only; this component only sends
// the typed inputs back and draws what returns.
export default function FormatFiller({ id, contractId, poNo, rvNo, requisitionId, showFields = true }) {
  const [format, setFormat] = useState(null);
  const [rendered, setRendered] = useState(null);
  const [values, setValues] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFormat(null);
    setRendered(null);
    setError(null);
    fetchFormat(id, { contractId, poNo, rvNo, requisitionId })
      .then((d) => {
        if (cancelled) return;
        setFormat(d.format);
        setRendered(d.rendered);
        setValues(Object.fromEntries(d.rendered.fields.filter((f) => !f.computed).map((f) => [f.key, f.value ?? ''])));
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id, contractId, poNo, rvNo, requisitionId]);

  const update = async () => {
    setBusy(true);
    setError(null);
    try {
      setRendered(await renderFormat(id, { fields: values, contractId, poNo, rvNo, requisitionId }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !rendered) return <div className="banner banner-error">{error}</div>;
  if (!rendered) return <div className="grid-empty">Loading format…</div>;

  const editable = rendered.fields.filter((f) => !f.computed);
  const computed = rendered.fields.filter((f) => f.computed);

  return (
    <div className={`fmt-filler ${showFields && editable.length ? '' : 'fmt-filler-doc-only'}`}>
      {showFields && editable.length > 0 && (
        <div className="fmt-fields no-print">
          <div className="fmt-fields-head">
            <strong>Fill in</strong>
            <span className="field-hint">
              {rendered.missing.length ? `${rendered.missing.length} blank` : 'complete'} · pre-filled from{' '}
              {rendered.fields.some((f) => f.source === 'context') ? 'the linked record' : 'defaults only'}
            </span>
          </div>
          {editable.map((f) => (
            <label key={f.key} className={`fmt-field ${rendered.missing.includes(f.key) ? 'fmt-field-missing' : ''}`}>
              <span className="field-label">{f.label}</span>
              <FieldInput field={f} value={values[f.key] ?? ''} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
              {f.source === 'context' && <span className="fmt-field-src">from the linked record</span>}
            </label>
          ))}
          {computed.length > 0 && (
            <div className="fmt-computed">
              <div className="field-label">Computed server-side</div>
              {computed.map((f) => (
                <div key={f.key} className="fmt-computed-row">
                  <span>{f.label}</span>
                  <strong>{f.display}</strong>
                </div>
              ))}
            </div>
          )}
          {error && <div className="banner banner-error">{error}</div>}
          <button type="button" className="btn" disabled={busy} onClick={update}>
            {busy ? 'Rendering…' : 'Update document'}
          </button>
        </div>
      )}
      <div className="note-print-area fmt-print-area">
        <FormatDocument rendered={rendered} />
      </div>
    </div>
  );
}

function FieldInput({ field, value, onChange }) {
  const common = { className: 'field-input', value: value ?? '', onChange: (e) => onChange(e.target.value) };
  switch (field.type) {
    case 'select':
      return (
        <select {...common}>
          <option value="">— select —</option>
          {(field.options || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case 'textarea':
      return <textarea {...common} rows={3} />;
    case 'lines':
      return <textarea {...common} rows={5} placeholder="one row per line; cells separated by |" />;
    case 'date':
      return <input type="date" {...common} />;
    case 'money':
    case 'number':
      return <input type="number" step="any" {...common} />;
    default:
      return <input type="text" {...common} />;
  }
}
