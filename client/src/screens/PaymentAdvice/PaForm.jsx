import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PaDocumentView from '../../components/paDocuments/PaDocumentView.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import Timeline from '../../components/Timeline.jsx';
import { PA_FORM_SECTIONS, PA_MAKER_FIELDS, PA_REQUIRED_FIELDS } from '../../config/paFormFields.jsx';
import { useRole } from '../../context/RoleContext.jsx';
import { apiFetch } from '../../lib/api.js';
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
      {editable && field.quickOptions && (
        <div className="remark-options" aria-label={`${field.label} examples`}>
          {field.quickOptions.map((option) => (
            <button
              type="button"
              className="remark-option"
              key={option}
              onClick={() => onChange(field.key, option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReferenceButtons({ pa, showForwarding, setShowForwarding }) {
  const [open, setOpen] = useState(null);
  const references = [
    ['rv', 'RV Invoice (Generated)', pa.rvNo, `Receipt Voucher ${pa.rvNo} · Value ${formatINR(pa.rvValue)} · Invoice ${pa.invoiceNo ?? '—'} (${formatINR(pa.invoiceValue)})`],
    ['po', 'HAL PO', pa.poNo, `HAL Purchase Order ${pa.poNo} · Date ${formatDate(pa.poDate)} · Order Value ${formatINR(pa.poValue)}`],
    ['gem', 'GeM Contract', pa.gemContractNo, pa.gemContractNo ? `GeM Contract ${pa.gemContractNo} · Date ${formatDate(pa.gemContractDate)}` : 'No GeM contract linked']
  ];
  const extras = [
    ['FTR (Flight Test / Field Test Report)', pa.attachments?.ftr === 'Yes'],
    ['QC Acceptance Certificate', pa.qcDate ? `Accepted on ${formatDate(pa.qcDate)}` : 'Pending'],
    ['Warranty Certificate', pa.attachments?.warranty === 'Yes'],
    ['Revised Bank Details', pa.attachments?.bankChange === 'Yes'],
    ['Credit Note Uploaded', pa.creditNoteUploaded ? `Yes (${pa.creditNoteNo ?? 'CN-Attached'})` : 'Not required / Pending']
  ];

  return (
    <div className="pa-references no-print">
      <div className="pa-reference-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        {references.map(([key, label, value, text]) => (
          <button key={key} type="button" className="btn btn-secondary" onClick={() => setOpen({ label, text })}>
            📄 {label}{value ? ` · ${value}` : ''}
          </button>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => setOpen({ label: 'Extra Documents & Attachments', extras: true })}>
          📁 Extra Docs
        </button>
        <button type="button" className={showForwarding ? 'btn' : 'btn btn-secondary'} onClick={() => setShowForwarding(!showForwarding)}>
          🔍 {showForwarding ? 'Hide Forwarding Data' : 'View Forwarding Advice Data'}
        </button>
      </div>
      {open && (
        <div className="pa-reference-preview" style={{ padding: '12px 16px', background: 'var(--color-bg-subtle, #f4f6f8)', borderRadius: '6px', marginBottom: '16px', border: '1px solid var(--color-border, #d1d5db)' }}>
          <strong>{open.label}</strong>
          {open.extras ? (
            <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
              {extras.map(([label, available]) => (
                <li key={label} style={{ marginBottom: '4px' }}>
                  <strong>{label}:</strong> {typeof available === 'boolean' ? (available ? '✓ Attached' : '✗ Not attached') : available}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ marginTop: '4px' }}>{open.text}</div>
          )}
          <button type="button" className="link-btn" style={{ marginTop: '8px', cursor: 'pointer' }} onClick={() => setOpen(null)}>
            Close preview
          </button>
        </div>
      )}
    </div>
  );
}

// Quick remark options shown in the inline remark panel for each role.
const OFFICER_REMARKS = [
  'Verified against PO terms. Forwarded to payment desk.',
  'Documents checked and payment recommended.',
  'Forwarded with the applicable LD deduction.'
];
const DESK_REMARKS = [
  'Recommendation report checked & stamped. Forwarded to HOD for approval.',
  'Verified and forwarded for HOD approval.',
  'All supporting documents checked and recommended to HOD.'
];
const HOD_REMARKS = [
  'Approved and stamped. Forwarded to payment desk for CPPC processing.',
  'Approved subject to the enclosed documents.',
  'Payment may be processed as recommended.'
];
const HOD_RETURN_REMARKS = [
  'Please verify the supporting documents.',
  'Please correct the payment computation.',
  'Please provide the missing clarification.'
];
const DESK_CPPC_REMARKS = [
  'HOD-stamped advice forwarded to CPPC for payment.',
  'Payment recommended and forwarded to CPPC.'
];

export default function PaForm({ paNo }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backPath = searchParams.get('back');
  // Register detail view (Screen 6): force read-only regardless of state and append
  // the history timeline. Without this a pa_created row would render editable.
  const recordView = searchParams.get('view') === '1';
  const { role } = useRole();
  const [pa, setPa] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showForwarding, setShowForwarding] = useState(false);
  // Inline remark state for officer / desk / HOD action panels
  const [inlineRemark, setInlineRemark] = useState('');
  // For desk→CPPC: capture PPR fields inline
  const [pprNo, setPprNo] = useState('');
  const [pprDate, setPprDate] = useState('');
  const [hodReturnRemark, setHodReturnRemark] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/payment-advices?pa=${encodeURIComponent(paNo)}`)
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
    const res = await apiFetch(path, {
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

  // Fire a lifecycle transition from within the document preview page, then navigate
  // back to the calling queue. Used by the inline officer/desk/HOD action panels.
  const runInlineTransition = async (action, extra = {}) => {
    setBusy(true);
    try {
      await post('/api/payment-advices/transition', {
        paNo: pa.paNo,
        action,
        ...extra
      });
      navigate(backPath ?? '/');
    } catch (err) {
      window.alert(err.message);
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
      <Link className="back-link no-print" to={backPath ?? '/payment-advice'}>
        {backPath ? '← Back to queue' : '← All drafts'}
      </Link>
      <div className="pa-header no-print">
        <h1 className="screen-title">Payment Advice {pa.paNo}</h1>
        <StatusPill status={pa.status} />
      </div>
      <p className="pa-meta no-print">
        Created {formatDate(pa.createdDate)} · RV {pa.rvNo} (RV Value: {formatINR(pa.rvValue)}) · Supplier: {pa.vendorName}
      </p>
      <ReferenceButtons pa={pa} showForwarding={showForwarding} setShowForwarding={setShowForwarding} />

      {editable ? (
        // Maker verification stage — data entry stays a field grid (it captures LD
        // switches, securities and attachments that no hand-off document carries).
        PA_FORM_SECTIONS.map((section) => (
          <div className="form-section" key={section.title}>
            <div className="form-section-title">{section.title}</div>
            {section.render ? (
              section.render(pa, editable && !busy, { draft, onChange })
            ) : (
              <div className="form-grid">
                {section.fields.filter((field) => !(field.hiddenWhen?.(draft) ?? false)).map((field) => (
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
        ))
      ) : (
        // Once forwarded, the advice is shown (and printed) in the HAL document formats.
        // The role prop gates the HOD checklist tab. remarkPanel/actionBar inject
        // in-page stamp & forward controls for the officer, desk and HOD stages.
        <PaDocumentView
          pa={pa}
          role={role}
          remarkPanel={
            // Show a remark textarea to the officer, desk (at_payment_desk & stamped_by_hod), or HOD
            (backPath === '/forward-advice' && pa.status === 'forwarded_to_officer') ||
            (backPath === '/process-payment' && (pa.status === 'at_payment_desk' || pa.status === 'stamped_by_hod')) ||
            (backPath === '/hod-approval' && pa.status === 'sent_to_hod') ? (
              <div className="pa-remark-panel">
                <div className="form-section-title">
                  {backPath === '/forward-advice' ? 'Officer Forwarding Remark'
                    : backPath === '/hod-approval' ? 'HOD Remark'
                    : pa.status === 'stamped_by_hod' ? 'Desk → CPPC Forwarding Remark'
                    : 'Desk Forwarding Remark'}
                </div>
                <textarea
                  className="field-input"
                  rows={3}
                  value={inlineRemark}
                  placeholder="Add a remark before acting…"
                  onChange={(e) => setInlineRemark(e.target.value)}
                  disabled={busy}
                />
                <div className="remark-options">
                  {(backPath === '/forward-advice' ? OFFICER_REMARKS
                    : backPath === '/hod-approval' ? HOD_REMARKS
                    : pa.status === 'stamped_by_hod' ? DESK_CPPC_REMARKS
                    : DESK_REMARKS
                  ).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className="remark-option"
                      onClick={() => setInlineRemark(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {/* HOD gets an extra Return remark box */}
                {backPath === '/hod-approval' && (
                  <>
                    <div className="form-section-title" style={{ marginTop: '16px' }}>Return Remark (if returning)</div>
                    <textarea
                      className="field-input"
                      rows={2}
                      value={hodReturnRemark}
                      placeholder="Reason for returning to maker (required to return)…"
                      onChange={(e) => setHodReturnRemark(e.target.value)}
                      disabled={busy}
                    />
                    <div className="remark-options">
                      {HOD_RETURN_REMARKS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className="remark-option"
                          onClick={() => setHodReturnRemark(opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {/* Desk→CPPC: PPR No and Date */}
                {backPath === '/process-payment' && pa.status === 'stamped_by_hod' && (
                  <div className="form-grid" style={{ marginTop: '12px' }}>
                    <div className="field">
                      <div className="field-label">CPPC PPR No <span className="req">*</span></div>
                      <input
                        className="field-input"
                        type="text"
                        placeholder="e.g. PPR/26/0231"
                        value={pprNo}
                        onChange={(e) => setPprNo(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div className="field">
                      <div className="field-label">PPR Date <span className="req">*</span></div>
                      <input
                        className="field-input"
                        type="date"
                        value={pprDate}
                        onChange={(e) => setPprDate(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null
          }
          actionBar={
            // Officer: Stamp & forward to payment desk
            backPath === '/forward-advice' && pa.status === 'forwarded_to_officer' ? (
              <div className="form-actions">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => runInlineTransition('officer_forward', { remark: inlineRemark })}
                >
                  ✔ Stamp &amp; forward to payment desk
                </button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => navigate(backPath)}>
                  ← Back to queue
                </button>
              </div>
            )
            // Payment desk (at_payment_desk): Stamp & forward to HOD
            : backPath === '/process-payment' && pa.status === 'at_payment_desk' ? (
              <div className="form-actions">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => runInlineTransition('desk_forward_hod', { remark: inlineRemark })}
                >
                  ✔ Stamp &amp; forward to HOD
                </button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => navigate(backPath)}>
                  ← Back to queue
                </button>
              </div>
            )
            // HOD: Stamp & forward to desk, or Return
            : backPath === '/hod-approval' && pa.status === 'sent_to_hod' ? (
              <div className="form-actions">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => runInlineTransition('hod_stamp', { remark: inlineRemark })}
                >
                  ✔ Approve, stamp &amp; return to desk
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={busy || !hodReturnRemark.trim()}
                  title={!hodReturnRemark.trim() ? 'Enter a return remark above' : undefined}
                  onClick={() => runInlineTransition('hod_return', { remark: hodReturnRemark })}
                >
                  ✗ Return to maker
                </button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => navigate(backPath)}>
                  ← Back to queue
                </button>
              </div>
            )
            // Desk (stamped_by_hod): Forward Recommendation Report to CPPC
            : backPath === '/process-payment' && pa.status === 'stamped_by_hod' ? (
              <div className="form-actions">
                <button
                  className="btn"
                  disabled={busy || !pprNo.trim() || !pprDate.trim()}
                  title={!pprNo.trim() || !pprDate.trim() ? 'Enter CPPC PPR No and Date above' : undefined}
                  onClick={() =>
                    runInlineTransition('desk_forward_cppc', {
                      pprNo: pprNo.trim(),
                      pprDate,
                      remark: inlineRemark
                    })
                  }
                >
                  ✔ Stamp, sign &amp; forward to CPPC
                </button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => navigate(backPath)}>
                  ← Back to queue
                </button>
              </div>
            )
            : null
          }
        />
      )}

      {(recordView || showForwarding) && (
        <div className="form-section no-print">
          <div className="form-section-title">Forwarding history</div>
          <Timeline paNo={pa.paNo} />
        </div>
      )}

      {editable && (
        <div className="form-actions no-print">
          <button className="btn btn-secondary" onClick={saveDraft} disabled={busy}>
            Save draft
          </button>
          <button className="btn" onClick={forward} disabled={busy || missingRequired.length > 0}>
            Submit to Advising Officer
          </button>
          {saved && <span className="action-note">Saved ✓</span>}
          {missingRequired.length > 0 && (
            <span className="action-note">Fill {missingLabels.join(', ')} to submit.</span>
          )}
        </div>
      )}
    </section>
  );
}
