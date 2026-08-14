import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PaDocumentView from '../../components/paDocuments/PaDocumentView.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import Timeline from '../../components/Timeline.jsx';
import CreditNoteModal from '../../components/CreditNoteModal.jsx';
import LdSheetModal from '../../components/LdSheetModal.jsx';
import { PA_FORM_SECTIONS, PA_MAKER_FIELDS, PA_REQUIRED_FIELDS } from '../../config/paFormFields.jsx';
import { useRole } from '../../context/RoleContext.jsx';
import { apiFetch } from '../../lib/api.js';
import { formatINR } from '../../lib/currency.js';
import { formatDate } from '../../lib/date.js';

const initDraft = (pa) =>
  Object.fromEntries(
    PA_MAKER_FIELDS.map((f) => [
      f.key,
      f.key === 'bankMismatch'
        ? (pa.bankMismatch === true || pa.bankMismatch === 'Yes' ? 'Yes' : 'No')
        : (pa[f.key] ?? (f.type === 'select' ? f.options?.[0] ?? '' : ''))
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

function ReferenceButtons({ pa, showForwarding, setShowForwarding, onOpenLdSheet, onOpenCreditNoteModal }) {
  const [open, setOpen] = useState(null);
  const references = [
    ['rv', 'RV Invoice (Generated)', pa.rvNo, `Receipt Voucher ${pa.rvNo} · Ref No: ${pa.refNo ?? ('REF/' + pa.rvNo.replaceAll('/', '-'))} · Value ${formatINR(pa.rvValue)} · Invoice ${pa.invoiceNo ?? '—'} (${formatINR(pa.invoiceValue)})`],
    ['po', 'HAL PO', pa.poNo, `HAL Purchase Order ${pa.poNo} · Date ${formatDate(pa.poDate)} · Order Value ${formatINR(pa.poValue)}`],
    ['gem', 'GeM Contract', pa.gemContractNo, pa.gemContractNo ? `GeM Contract ${pa.gemContractNo} · Date ${formatDate(pa.gemContractDate)}` : 'No GeM contract linked']
  ];

  if (pa.creditNoteUploaded || pa.creditNoteNo) {
    references.push([
      'cn',
      'Credit Note',
      pa.creditNoteNo,
      `Credit Note ${pa.creditNoteNo ?? 'CN-Attached'} · Uploaded ${formatDate(pa.creditNoteUploadedDate || pa.createdDate)} · File: ${pa.creditNoteFileName || 'CN_Attached.pdf'} · Difference Amount: ${formatINR(Math.abs((pa.invoiceValue || 0) - (pa.rvValue || 0)))}${pa.creditNoteRemarks ? ` · Remarks: ${pa.creditNoteRemarks}` : ''}`
    ]);
  }

  const extras = [
    ['FTR (Flight Test / Field Test Report)', pa.attachments?.ftr === 'Yes'],
    ['QC Acceptance Certificate', pa.qcDate ? `Accepted on ${formatDate(pa.qcDate)}` : 'Pending'],
    ['Warranty Certificate', pa.attachments?.warranty === 'Yes'],
    ['Revised Bank Details', pa.attachments?.bankChange === 'Yes'],
    ['Credit Note Uploaded', pa.creditNoteUploaded ? `Yes (${pa.creditNoteNo ?? 'CN-Attached'})` : 'Not required / Pending']
  ];

  const hasLd = pa.ldAmount > 0 || pa.ldApplicable === 'Yes' || (pa.ldWeeks || 0) > 0;

  return (
    <div className="pa-references no-print">
      <div className="pa-reference-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        {references.map(([key, label, value, text]) => (
          <button key={key} type="button" className="btn btn-secondary" onClick={() => setOpen({ label, text })}>
            📄 {label}{value ? ` · ${value}` : ''}
          </button>
        ))}
        {!pa.creditNoteUploaded && onOpenCreditNoteModal && (
          <button type="button" className="btn btn-secondary" onClick={onOpenCreditNoteModal}>
            📄 Upload Credit Note
          </button>
        )}
        {hasLd && (
          <button type="button" className="btn btn-secondary" onClick={onOpenLdSheet}>
            📄 View / Generate LD Sheet
          </button>
        )}
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
  const recordView = searchParams.get('view') === '1';
  const { role } = useRole();
  const [pa, setPa] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showForwarding, setShowForwarding] = useState(false);
  const [showLdSheetModal, setShowLdSheetModal] = useState(false);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [inlineRemark, setInlineRemark] = useState('');
  const [pprNo, setPprNo] = useState('');
  const [pprDate, setPprDate] = useState('');
  const [hodReturnRemark, setHodReturnRemark] = useState('');
  const [officerReturnRemark, setOfficerReturnRemark] = useState('');
  const [viewTab, setViewTab] = useState(null);

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
  const isOfficerStage = (backPath === '/forward-advice' || pa.status === 'forwarded_to_officer') && !recordView;
  const isFormStage = editable || isOfficerStage;
  const activeTab = viewTab ?? (isOfficerStage ? 'doc' : 'form');
  const isLdApplicable = pa.ldAmount > 0 || pa.ldApplicable === 'Yes' || (pa.ldWeeks || 0) > 0;
  const isBankMismatch = editable
    ? (draft?.bankMismatch === 'Yes' || draft?.bankMismatch === true)
    : (pa.bankMismatch === true || pa.bankMismatch === 'Yes');
  const missingRequired = PA_REQUIRED_FIELDS.filter((key) => !draft[key]);
  const missingLabels = PA_MAKER_FIELDS.filter((f) => missingRequired.includes(f.key)).map(
    (f) => f.label
  );

  const handleCnSuccess = (data) => {
    setPa((prev) => prev ? {
      ...prev,
      creditNoteUploaded: true,
      creditNoteNo: data.creditNoteNo,
      creditNoteFileName: data.fileName,
      creditNoteRemarks: data.remarks
    } : prev);
  };

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
      <div className="pa-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 className="screen-title" style={{ margin: 0 }}>Payment Advice {pa.paNo}</h1>
          <StatusPill status={pa.status} />
        </div>
      </div>
      <p className="pa-meta no-print">
        Created {formatDate(pa.createdDate)} · RV {pa.rvNo} (Ref: {pa.refNo ?? ('REF/' + pa.rvNo.replaceAll('/', '-'))}) · RV Value: {formatINR(pa.rvValue)} · Supplier: {pa.vendorName}
      </p>

      {isLdApplicable && (
        <div className="banner banner-warn no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 16px 0', padding: '12px 16px', background: '#fffbe8', border: '1px solid #fde047', borderRadius: '6px', color: '#854d0e' }}>
          <div>
            <strong>⚠️ Liquidated Damages (LD) Applicable:</strong> Total LD Deduction of <strong>{formatINR(pa.ldAmount)}</strong> ({pa.ldWeeks || 0} week(s) supply delay). Net proposed payment: <strong>{formatINR(pa.finalPayment)}</strong>.
          </div>
          <button type="button" className="btn btn-secondary" style={{ whiteSpace: 'nowrap', marginLeft: '12px' }} onClick={() => setShowLdSheetModal(true)}>
            📄 View LD Sheet
          </button>
        </div>
      )}

      {isBankMismatch && (
        <div className="banner banner-danger no-print" style={{ margin: '12px 0 16px 0', padding: '14px 18px', background: '#fef2f2', border: '1.5px solid #ef4444', borderRadius: '6px', color: '#991b1b', fontSize: '0.95rem' }}>
          <strong>🚨 Bank Account Details Mismatch (Flagged by Yogesh M. - Purchase Maker):</strong> Bank account details on Invoice do not match HAL master data. Payment advice <strong>CANNOT be sent to Neerja Sharma (Payment Desk)</strong> until bank account details match.
        </div>
      )}

      <ReferenceButtons
        pa={pa}
        showForwarding={showForwarding}
        setShowForwarding={setShowForwarding}
        onOpenLdSheet={() => setShowLdSheetModal(true)}
        onOpenCreditNoteModal={() => setShowCreditNoteModal(true)}
      />

      {(editable || isOfficerStage) && (
        <div className="no-print" style={{ display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '2px solid var(--color-border, #e5e7eb)', paddingBottom: '12px' }}>
          <button
            type="button"
            className={activeTab === 'doc' ? 'btn' : 'btn btn-secondary'}
            onClick={() => setViewTab('doc')}
          >
            📄 {isOfficerStage ? 'Stamped Payment Advice Document' : 'Draft Payment Advice Document'}
          </button>
          <button
            type="button"
            className={activeTab === 'form' ? 'btn' : 'btn btn-secondary'}
            onClick={() => setViewTab('form')}
          >
            📋 Verification Form Grid
          </button>
        </div>
      )}

      {(editable || isOfficerStage) && activeTab === 'form' ? (
        <>
          {PA_FORM_SECTIONS.map((section) => (
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
          ))}

          {/* Officer Verification & Forwarding Panel rendered on 1st screen form grid */}
          {isOfficerStage && pa.status === 'forwarded_to_officer' && (
            <div className="form-section no-print" style={{ marginTop: '24px', background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div className="form-section-title">Officer Verification &amp; Action</div>
              <div className="field">
                <div className="field-label">Officer Forwarding Remark</div>
                <textarea
                  className="field-input"
                  rows={3}
                  value={inlineRemark}
                  placeholder="Add a remark before forwarding to payment desk (Neerja Sharma)..."
                  onChange={(e) => setInlineRemark(e.target.value)}
                  disabled={busy}
                />
                <div className="remark-options">
                  {OFFICER_REMARKS.map((opt) => (
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
              </div>

              <div className="field" style={{ marginTop: '14px' }}>
                <div className="field-label">Return Remark (if returning to maker due to ambiguity)</div>
                <textarea
                  className="field-input"
                  rows={2}
                  value={officerReturnRemark}
                  placeholder="Reason for returning to maker (Yogesh M.)..."
                  onChange={(e) => setOfficerReturnRemark(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="form-actions" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || isBankMismatch}
                  title={isBankMismatch ? 'Cannot send to Neerja Sharma (Payment Desk): Bank account details on Invoice and in HAL data do not match (Flagged by Yogesh M.).' : undefined}
                  onClick={() => runInlineTransition('officer_forward', { remark: inlineRemark })}
                >
                  ✔ Stamp &amp; forward to payment desk
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || (!officerReturnRemark.trim() && !inlineRemark.trim())}
                  title={(!officerReturnRemark.trim() && !inlineRemark.trim()) ? 'Enter a return remark above to return' : undefined}
                  onClick={() => runInlineTransition('officer_send_back', { remark: officerReturnRemark || inlineRemark })}
                >
                  ✗ Return to maker
                </button>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => navigate(backPath ?? '/forward-advice')}>
                  ← Back to queue
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <PaDocumentView
          pa={pa}
          role={role}
          backPath={backPath}
          officerRemark={inlineRemark}
          remarkPanel={
            isOfficerStage ? (
              <div className="pa-remark-panel">
                <div className="form-section-title">Officer Verification &amp; Forwarding Remark</div>
                <textarea
                  className="field-input"
                  rows={3}
                  value={inlineRemark}
                  placeholder="Add a remark before forwarding to payment desk (Neerja Sharma)..."
                  onChange={(e) => setInlineRemark(e.target.value)}
                  disabled={busy}
                />
                <div className="remark-options">
                  {OFFICER_REMARKS.map((opt) => (
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
                <div className="form-section-title" style={{ marginTop: '16px' }}>Return Remark (if returning to maker)</div>
                <textarea
                  className="field-input"
                  rows={2}
                  value={officerReturnRemark}
                  placeholder="Reason for returning to maker (Yogesh M.)..."
                  onChange={(e) => setOfficerReturnRemark(e.target.value)}
                  disabled={busy}
                />
              </div>
            ) : (backPath === '/process-payment' && (pa.status === 'at_payment_desk' || pa.status === 'stamped_by_hod')) ||
            (backPath === '/hod-approval' && pa.status === 'sent_to_hod') ? (
              <div className="pa-remark-panel">
                <div className="form-section-title">
                  {backPath === '/hod-approval' ? 'HOD Remark'
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
                  {(backPath === '/hod-approval' ? HOD_REMARKS
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
            isOfficerStage ? (
              <div className="form-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy || isBankMismatch}
                  title={isBankMismatch ? 'Cannot send to Neerja Sharma (Payment Desk): Bank account details on Invoice and in HAL data do not match (Flagged by Yogesh M.).' : undefined}
                  onClick={() => runInlineTransition('officer_forward', { remark: inlineRemark })}
                >
                  ✔ Stamp &amp; forward to payment desk
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || (!officerReturnRemark.trim() && !inlineRemark.trim())}
                  title={(!officerReturnRemark.trim() && !inlineRemark.trim()) ? 'Enter a return remark above to return' : undefined}
                  onClick={() => runInlineTransition('officer_send_back', { remark: officerReturnRemark || inlineRemark })}
                >
                  ✗ Return to maker
                </button>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => navigate(backPath ?? '/forward-advice')}>
                  ← Back to queue
                </button>
              </div>
            )
            // Payment desk (at_payment_desk): Stamp & forward to HOD, or Return to maker
            : backPath === '/process-payment' && pa.status === 'at_payment_desk' ? (
              <div className="form-actions">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => runInlineTransition('desk_forward_hod', { remark: inlineRemark })}
                >
                  ✔ Stamp &amp; forward to HOD
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => runInlineTransition('desk_send_back', { remark: inlineRemark || 'Returned by payment desk' })}
                >
                  ✗ Return to maker
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
          <Timeline paNo={pa.paNo} history={pa.history} />
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

      {showLdSheetModal && (
        <LdSheetModal pa={pa} onClose={() => setShowLdSheetModal(false)} />
      )}

      {showCreditNoteModal && (
        <CreditNoteModal row={pa} onClose={() => setShowCreditNoteModal(false)} onSuccess={handleCnSuccess} />
      )}
    </section>
  );
}
