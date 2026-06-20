import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import StatusPill from '../../components/StatusPill.jsx';
import Timeline from '../../components/Timeline.jsx';
import { PA_FORM_SECTIONS, PA_MAKER_FIELDS, PA_REQUIRED_FIELDS } from '../../config/paFormFields.jsx';
import { formatINR } from '../../lib/currency.js';
import { formatDate } from '../../lib/date.js';

const initDraft = (pa) =>
  Object.fromEntries(
    PA_MAKER_FIELDS.map((f) => [
      f.key,
      pa[f.key] ?? (f.type === 'select' ? f.options?.[0] ?? '' : '')
    ])
  );

function displayValue(field, pa) {
  if (field.render) return field.render(pa);
  const value = pa[field.key];
  switch (field.type) {
    case 'currency':
      return <span className="num">{formatINR(value)}</span>;
    case 'date':
      return formatDate(value);
    case 'pill':
      return <StatusPill status={value} />;
    default:
      return value ?? '—';
  }
}

function Field({ field, pa, draft, onChange, editable }) {
  const wide = field.type === 'textarea';
  const disabled = !editable || (field.disabledWhen?.(draft) ?? false);
  const tag =
    field.source === 'ifs' ? (
      <span className="tag">IFS</span>
    ) : field.source === 'computed' ? (
      <span className="tag tag-computed">Computed</span>
    ) : null;

  return (
    <div className={'field' + (wide ? ' field-wide' : '')}>
      <div className="field-label">
        {field.label}
        {field.required && <span className="req">*</span>}
        {tag}
      </div>
      {field.source === 'maker' ? (
        field.type === 'textarea' ? (
          <textarea
            className="field-input"
            rows={2}
            value={draft[field.key]}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.value)}
          />
        ) : field.type === 'select' ? (
          <select
            className="field-input"
            value={draft[field.key]}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.value)}
          >
            {field.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="field-input"
            type={
              field.type === 'date-input' ? 'date' : field.type === 'amount' ? 'number' : 'text'
            }
            min={field.type === 'amount' ? 0 : undefined}
            value={draft[field.key]}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.value)}
          />
        )
      ) : (
        <div className={'field-value' + (field.emphasis ? ' emphasis' : '')}>
          {displayValue(field, pa)}
        </div>
      )}
      {field.hint && <div className="field-hint">{field.hint}</div>}
    </div>
  );
}

export default function PaForm({ paNo }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backPath = searchParams.get('back');
  // Register detail view (Screen 6): force read-only regardless of state and append
  // the history timeline. Without this a pa_created row would render editable.
  const recordView = searchParams.get('view') === '1';
  const [pa, setPa] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/payment-advices?pa=${encodeURIComponent(paNo)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then((rows) => {
        if (cancelled) return;
        if (rows.length === 0) {
          setError(`Payment advice ${paNo} not found.`);
          return;
        }
        setPa(rows[0]);
        setDraft(initDraft(rows[0]));
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [paNo]);

  if (error) {
    return (
      <section className="screen">
        <h1 className="screen-title">Payment Advice</h1>
        <div className="grid-empty">{error}</div>
      </section>
    );
  }
  if (!pa) {
    return (
      <section className="screen">
        <h1 className="screen-title">Payment Advice</h1>
        <div className="grid-empty">Loading…</div>
      </section>
    );
  }

  const editable = pa.status === 'pa_created' && !recordView;
  const missingRequired = PA_REQUIRED_FIELDS.filter((key) => !draft[key]);
  const missingLabels = PA_MAKER_FIELDS.filter((f) => missingRequired.includes(f.key)).map(
    (f) => f.label
  );

  const onChange = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  };

  const post = async (path, body) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
    return data;
  };

  const saveDraft = async () => {
    setBusy(true);
    try {
      const updated = await post('/api/payment-advices/update', { paNo: pa.paNo, ...draft });
      setPa(updated);
      setDraft(initDraft(updated));
      setSaved(true);
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const forward = async () => {
    setBusy(true);
    try {
      await post('/api/payment-advices/update', { paNo: pa.paNo, ...draft });
      await post('/api/payment-advices/transition', {
        paNo: pa.paNo,
        action: 'forward_to_officer',
        remark: draft.makerRemark
      });
      navigate('/rv-inbox');
    } catch (err) {
      window.alert(err.message);
      setBusy(false);
    }
  };

  return (
    <section className="screen">
      <Link className="back-link" to={backPath ?? '/payment-advice'}>
        {backPath ? '← Back to queue' : '← All drafts'}
      </Link>
      <div className="pa-header">
        <h1 className="screen-title">Payment Advice {pa.paNo}</h1>
        <StatusPill status={pa.status} />
      </div>
      <p className="pa-meta">
        Created {formatDate(pa.createdDate)} · RV {pa.rvNo} · {pa.vendorName}
      </p>

      {!editable && (
        <div className="banner banner-info">
          {recordView
            ? 'Read-only record — opened from the payment register.'
            : 'This payment advice has moved on from maker verification — fields are read-only.'}
        </div>
      )}

      {PA_FORM_SECTIONS.map((section) => (
        <div className="form-section" key={section.title}>
          <div className="form-section-title">{section.title}</div>
          {section.render ? (
            section.render(pa, editable && !busy, { draft, onChange })
          ) : (
            <div className="form-grid">
              {section.fields.map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  pa={pa}
                  draft={draft}
                  onChange={onChange}
                  editable={editable && !busy}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {recordView && (
        <div className="form-section">
          <div className="form-section-title">History</div>
          <Timeline paNo={pa.paNo} />
        </div>
      )}

      <div className="form-actions">
        <button className="btn btn-secondary" onClick={() => window.print()}>
          Preview Payment Advice Format
        </button>
        {editable && (
          <>
            <button className="btn btn-secondary" onClick={saveDraft} disabled={busy}>
              Save draft
            </button>
            <button
              className="btn"
              onClick={forward}
              disabled={busy || missingRequired.length > 0}
            >
              Submit to Advising Officer
            </button>
            {saved && <span className="action-note">Saved ✓</span>}
            {missingRequired.length > 0 && (
              <span className="action-note">Fill {missingLabels.join(', ')} to submit.</span>
            )}
          </>
        )}
      </div>
    </section>
  );
}
