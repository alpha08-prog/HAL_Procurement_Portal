import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CLASSIFICATIONS, REFERENCE_KINDS } from '../../config/notingColumns.jsx';
import { addAttachment, fetchFiles, fetchMembers, fetchStages, generateNextStage, initiateFile } from '../../lib/notingApi.js';
import { fetchRequisition } from '../../lib/requisitionsApi.js';
import { formatINR } from '../../lib/currency.js';
import RichTextEditor from '../../components/noting/RichTextEditor.jsx';
import MemberPickerModal from '../../components/noting/MemberPickerModal.jsx';
import DopModal from '../../components/noting/DopModal.jsx';
import StampingModal from '../../components/noting/StampingModal.jsx';
import FinalReviewModal from '../../components/noting/FinalReviewModal.jsx';

// CREATE E-FILE. Three entry points share this wizard:
//   /noting/initiate                     a new proposal (AI-drafted provisioning or a manual note)
//   /noting/initiate?requisition=<id>    the same, anchored to a requisition from the register
//   /noting/initiate?stage=<id>          a stage file: cascade stages are added to an existing
//                                        proposal (its cabinet guards apply); need-based notes
//                                        may open a file of their own or join a proposal.
// Everything collected here is posted: routing plan, approver, priority, OTP, the DoP row,
// the stamping PDF and any files (as typed attachments on the created note).
const AI_CASES = [
  { id: 'nvb', label: 'Night Vision Binoculars (CAR/25/229 — ₹15.94 lakh) [HAL Nashik sample case]', title: 'Procurement of Night Vision Binoculars for HAL Nashik Division', kind: 'CAR', carNo: 'CAR/25/229' },
  { id: 'led', label: '250W LED High Bay fittings (CAR/26/118 — E-33046) [fabricated bids]', title: 'Procurement of 250W High Bay LED light fittings', kind: 'CAR', carNo: 'CAR/26/118' }
];

export default function Initiate() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requisitionParam = params.get('requisition');
  const stageParam = params.get('stage');

  const [step, setStep] = useState(1);
  const [source, setSource] = useState(stageParam ? 'manual' : 'ai');
  const [sourceCase, setSourceCase] = useState('nvb');
  const [files, setFiles] = useState([]);
  const [members, setMembers] = useState([]);
  const [stages, setStages] = useState({ order: [], needBased: [] });
  const [requisition, setRequisition] = useState(null);
  const [targetFilePk, setTargetFilePk] = useState('');

  const [form, setForm] = useState({
    title: AI_CASES[0].title,
    kind: 'CAR',
    carNo: AI_CASES[0].carNo,
    classification: 'normal',
    priority: 'Medium',
    noteTitle: 'Provisioning Note (N1)',
    stageId: 'provisioning',
    body: '',
    parentFileId: '',
    lineNo: ''
  });

  const [routingList, setRoutingList] = useState([]);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showDopModal, setShowDopModal] = useState(false);
  const [showStampingModal, setShowStampingModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [dopRow, setDopRow] = useState(null);
  const [stampingSetup, setStampingSetup] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [busy, setBusy] = useState(false);

  const stageInfo = useMemo(() => [...stages.order, ...stages.needBased].find((s) => s.id === stageParam) ?? null, [stages, stageParam]);
  const stageMode = Boolean(stageParam && stageParam !== 'provisioning');
  const isCascadeStage = stageMode && stages.order.some((s) => s.id === stageParam);
  const openFiles = useMemo(() => files.filter((f) => f.status === 'open'), [files]);

  useEffect(() => {
    let cancelled = false;
    fetchFiles().then((d) => !cancelled && setFiles(d.files)).catch(() => !cancelled && setFiles([]));
    fetchMembers().then((d) => !cancelled && setMembers(d?.members || [])).catch(() => !cancelled && setMembers([]));
    fetchStages().then((d) => !cancelled && setStages(d)).catch(() => !cancelled && setStages({ order: [], needBased: [] }));
    if (requisitionParam) {
      fetchRequisition(requisitionParam)
        .then((d) => {
          if (cancelled) return;
          const r = d.requisition;
          setRequisition(r);
          setForm((f) => ({ ...f, title: r.title, kind: r.kind, carNo: r.req_no }));
          if (r.source_case) setSourceCase(r.source_case);
          else setSource('manual');
          if (r.links?.notingFile) setTargetFilePk(String(r.links.notingFile.id));
        })
        .catch((e) => !cancelled && setError(e.message));
    }
    return () => { cancelled = true; };
  }, [requisitionParam]);

  useEffect(() => {
    if (!stageMode || !stageInfo) return;
    setSource('manual');
    setForm((f) => ({ ...f, stageId: stageParam, noteTitle: `${stageInfo.title} (N1)`, title: f.title === AI_CASES[0].title ? stageInfo.title : f.title }));
  }, [stageMode, stageInfo, stageParam]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSourceCaseChange = (id) => {
    setSourceCase(id);
    const c = AI_CASES.find((x) => x.id === id);
    if (c && !requisition) set({ title: c.title, kind: c.kind, carNo: c.carNo, noteTitle: 'Provisioning Note (N1)', stageId: 'provisioning' });
  };

  const addMemberToRouting = (member) => {
    setRoutingList((prev) => [...prev, { id: member.id, name: member.name, designation: member.designation, pb: member.pb, unit: member.unit_path || member.unit }]);
  };
  const removeMemberFromRouting = (idx) => setRoutingList((prev) => prev.filter((_, i) => i !== idx));
  const moveRouting = (idx, dir) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= routingList.length) return;
    setRoutingList((prev) => {
      const arr = [...prev];
      [arr[idx], arr[nextIdx]] = [arr[nextIdx], arr[idx]];
      return arr;
    });
  };

  const handleFileUpload = (e) => {
    const picked = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...picked.map((file) => ({ file, name: file.name }))]);
    e.target.value = '';
  };

  // After the note exists: the DoP row, the stamping PDF and the chosen files become typed
  // attachments on it. Failures are reported but never lose the created note.
  const postExtras = async (txnId) => {
    const warn = [];
    if (dopRow) {
      try {
        await addAttachment(txnId, { kind: 'dop', name: `DoP ${dopRow.annexure} (${dopRow.para}) — ${dopRow.subCategory}`, ref: `FCA: ${dopRow.fca}; CFA: ${dopRow.cfa}; band ${dopRow.approxVal}${dopRow.verified ? '' : '; row unverified (bands pending from HAL)'}` });
      } catch (e) {
        warn.push(`DoP reference not attached: ${e.message}`);
      }
    }
    if (stampingSetup?.file) {
      try {
        const fd = new FormData();
        fd.append('file', stampingSetup.file);
        fd.append('kind', 'stamping');
        fd.append('name', `Stamping set — ${stampingSetup.file.name}`);
        fd.append('ref', `Stamping authorities: member ids ${stampingSetup.memberIds.join(', ')}`);
        await addAttachment(txnId, fd);
      } catch (e) {
        warn.push(`Stamping PDF not attached: ${e.message}`);
      }
    }
    for (const a of attachments) {
      try {
        const fd = new FormData();
        fd.append('file', a.file);
        fd.append('kind', 'doc');
        fd.append('name', a.name);
        await addAttachment(txnId, fd);
      } catch (e) {
        warn.push(`${a.name} not attached: ${e.message}`);
      }
    }
    return warn;
  };

  const submit = async (reviewExtra = {}) => {
    setError(null);
    if (!form.title.trim()) return setError('File title / Subject is required.');
    if (stageMode && isCascadeStage && !targetFilePk) return setError(`${stageInfo?.title || 'This stage'} is generated on an existing proposal — pick the proposal file first.`);
    setBusy(true);
    try {
      const common = {
        body: form.body,
        classification: form.classification,
        priority: form.priority,
        routingList: routingList.map((m) => m.id),
        approverId: routingList.at(-1)?.id
      };
      let txnId;
      if (stageMode && targetFilePk) {
        const res = await generateNextStage(Number(targetFilePk), { ...common, stageId: stageParam, title: form.noteTitle });
        txnId = res.txnId || res.note?.txn_id;
      } else {
        const res = await initiateFile({
          ...common,
          title: form.title,
          kind: form.kind,
          carNo: form.kind === 'standalone' ? undefined : form.carNo,
          source,
          sourceCase: source === 'ai' ? sourceCase : undefined,
          stageId: stageMode ? stageParam : source === 'ai' ? form.stageId : undefined,
          noteTitle: form.noteTitle,
          requisitionId: requisition?.id,
          parentFileId: form.parentFileId ? Number(form.parentFileId) : undefined,
          lineNo: form.parentFileId ? form.lineNo || undefined : undefined,
          otp: reviewExtra?.totp || undefined
        });
        txnId = res.note.txn_id;
      }
      const warn = await postExtras(txnId);
      if (warn.length) {
        setWarnings(warn);
        setShowReviewModal(false);
        setBusy(false);
        setTimeout(() => navigate(`/noting/note/${txnId}`), 2500);
        return;
      }
      navigate(`/noting/note/${txnId}`);
    } catch (err) {
      setError(err.message + (err.needsOverride ? ' (the AI pipeline advised against this step; resolve or switch to a manual note)' : ''));
      setBusy(false);
    }
  };

  const reqHasFile = Boolean(requisition?.links?.notingFile);

  return (
    <section className="screen">
      <h1 className="screen-title">{stageMode && stageInfo ? `ADD STAGE — ${stageInfo.title.toUpperCase()}` : 'CREATE E-FILE'}</h1>

      <div className="ef-wizard-stepper">
        {[['1. File Details', 1], ['2. Routing', 2], ['3. Notesheet', 3], ['4. Cover Page', 4]].map(([label, n], i) => (
          <span key={n} style={{ display: 'contents' }}>
            {i > 0 && <span className={`ef-wizard-connector${step > n - 1 ? ' done' : ''}`} />}
            <button type="button" className={`ef-wizard-step${step === n ? ' active' : step > n ? ' completed' : ''}`} onClick={() => setStep(n)}>
              <span className="step-number">{step > n ? '✓' : n}</span>
              <span>{label}</span>
            </button>
          </span>
        ))}
      </div>

      {error && <div className="banner banner-error">{error}</div>}
      {warnings.length > 0 && (
        <div className="banner banner-restricted">
          The note was created; some attachments failed — opening the note. {warnings.join(' · ')}
        </div>
      )}

      {step === 1 && (
        <div>
          {requisition && (
            <div className="form-section req-anchor">
              <div className="form-section-title">Requisition from the register</div>
              <div className="req-anchor-row">
                <strong>{requisition.req_no}</strong> · {requisition.kind} · {requisition.title}
                {requisition.estimate_total != null && <span className="field-hint"> · estimate {formatINR(requisition.estimate_total)} ({requisition.estimate_basis_label})</span>}
                {requisition.fixture && <span className="tag tag-fmt-pending">fabricated fixture</span>}
              </div>
              {reqHasFile && !stageMode && (
                <div className="banner banner-restricted" style={{ marginTop: 8 }}>
                  This requisition already has proposal file <Link to={`/noting/note/${requisition.links.notingFile.first_txn}`}>{requisition.links.notingFile.file_id}</Link>. Add the next stage from its cabinet instead of a new file.
                </div>
              )}
            </div>
          )}

          {stageMode && (
            <div className="form-section">
              <div className="form-section-title">{isCascadeStage ? 'Proposal this stage belongs to' : 'Where this note goes'}</div>
              <p className="field-hint" style={{ marginTop: 0 }}>
                {isCascadeStage
                  ? `${stageInfo?.title || 'This stage'} is generated from the approved previous stage of a proposal; the cabinet rules (decided previous stage, tender hand-over) apply.`
                  : `${stageInfo?.title || 'This note'} is need-based: open it as its own file, or add it to an open proposal.`}
              </p>
              <label className="field-wide">
                <span className="field-label">Proposal file {isCascadeStage ? '*' : '(optional)'}</span>
                <select className="field-input" value={targetFilePk} onChange={(e) => setTargetFilePk(e.target.value)}>
                  <option value="">{isCascadeStage ? '— pick an open proposal —' : '— new standalone file —'}</option>
                  {openFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.file_id} · {f.car_no || 'standalone'} · {f.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {!stageMode && (
            <div className="form-section">
              <div className="form-section-title">Source &amp; Reference</div>
              <div className="ai-doc-modes" role="group" aria-label="Note source">
                <button type="button" className={'btn' + (source === 'ai' ? '' : ' btn-secondary')} onClick={() => setSource('ai')}>
                  AI-drafted (Pipeline)
                </button>
                <button type="button" className={'btn' + (source === 'manual' ? '' : ' btn-secondary')} onClick={() => setSource('manual')}>
                  Standalone / manual
                </button>
              </div>
              {source === 'ai' && (
                <div className="form-grid" style={{ marginTop: 'var(--space-4)' }}>
                  <label className="field-wide">
                    <span className="field-label">Procurement case the pipeline drafts from</span>
                    <select className="field-input" value={sourceCase} onChange={(e) => handleSourceCaseChange(e.target.value)} disabled={Boolean(requisition?.source_case)}>
                      {AI_CASES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <span className="field-hint" style={{ marginTop: 4, display: 'block' }}>
                      Opens a Module F case and raises its Provisioning Note (N1) with the MPR/CAR annexure; later stages follow the responsibility cascade. If the pipeline refuses, nothing is created.
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="form-section">
            <div className="form-section-title">File Details</div>
            <div className="form-grid">
              <label className="field-wide">
                <span className="field-label">Subject / File Title <span className="req">*</span></span>
                <input className="field-input" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Procurement of Night Vision Binoculars for HAL Nashik Division" disabled={stageMode && Boolean(targetFilePk)} />
              </label>
              <label>
                <span className="field-label">Reference Type</span>
                <select className="field-input" value={form.kind} onChange={(e) => set({ kind: e.target.value })} disabled={Boolean(requisition) || (stageMode && Boolean(targetFilePk))}>
                  {REFERENCE_KINDS.map((k) => (
                    <option key={k} value={k}>{k === 'standalone' ? 'Standalone (no requisition)' : k}</option>
                  ))}
                </select>
              </label>
              {form.kind !== 'standalone' && (
                <label>
                  <span className="field-label">{form.kind} No.</span>
                  <input className="field-input" value={form.carNo} onChange={(e) => set({ carNo: e.target.value })} placeholder={`e.g. ${form.kind}/25/229`} disabled={Boolean(requisition) || (stageMode && Boolean(targetFilePk))} />
                </label>
              )}
              <label>
                <span className="field-label">Priority</span>
                <select className="field-input" value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
                  <option value="High">High (Pink)</option>
                  <option value="Medium">Medium (Yellow)</option>
                  <option value="Low">Low (White)</option>
                </select>
              </label>
              <label>
                <span className="field-label">Classification</span>
                <select className="field-input" value={form.classification} onChange={(e) => set({ classification: e.target.value })}>
                  {CLASSIFICATIONS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
              {!stageMode && !requisition && (
                <>
                  <label>
                    <span className="field-label">Parent proposal (line-wise child PP)</span>
                    <select className="field-input" value={form.parentFileId} onChange={(e) => set({ parentFileId: e.target.value })}>
                      <option value="">— none —</option>
                      {openFiles.map((f) => (
                        <option key={f.id} value={f.id}>{f.file_id} · {f.title}</option>
                      ))}
                    </select>
                  </label>
                  {form.parentFileId && (
                    <label>
                      <span className="field-label">Line label</span>
                      <input className="field-input" value={form.lineNo} onChange={(e) => set({ lineNo: e.target.value })} placeholder="e.g. Line 3 — M/s …" />
                    </label>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setStep(2)} disabled={reqHasFile && !stageMode}>Next: Routing →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="form-section">
            <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Routing List &amp; Approval Chain</span>
              <button type="button" className="btn" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setShowMemberPicker(true)}>
                + Add Member to Routing
              </button>
            </div>
            <div className="banner banner-warning" style={{ marginBottom: 12 }}>
              The last member in the routing list is recorded as the approving authority for this stage; the forward order is enforced unless a hop is marked as a deviation with a reason.
            </div>
            {routingList.length === 0 ? (
              <div className="grid-empty">No members added yet. Add officers to define the approval path.</div>
            ) : (
              <table className="ef-routing-table">
                <thead>
                  <tr><th>Order</th><th>Name</th><th>Designation</th><th>PB No</th><th>Department / Unit</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {routingList.map((m, idx) => (
                    <tr key={`${m.id}-${idx}`}>
                      <td>#{idx + 1}{idx === routingList.length - 1 ? ' · approver' : ''}</td>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td>{m.designation}</td>
                      <td>{m.pb}</td>
                      <td>{m.unit || '—'}</td>
                      <td>
                        <button type="button" className="action-btn" onClick={() => moveRouting(idx, -1)}>↑</button>
                        <button type="button" className="action-btn" onClick={() => moveRouting(idx, 1)}>↓</button>
                        <button type="button" className="action-btn danger" onClick={() => removeMemberFromRouting(idx)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>← Previous</button>
            <button type="button" className="btn" onClick={() => setStep(3)}>Next: Notesheet →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="ef-split-layout">
          <div className="ef-main-col">
            <div className="form-section">
              <div className="form-section-title">Note Details (N1)</div>
              <div style={{ marginBottom: 12 }}>
                <span className="field-label">Note Title</span>
                <input className="field-input" style={{ width: '100%' }} value={form.noteTitle} onChange={(e) => set({ noteTitle: e.target.value })} placeholder="e.g. Provisioning & Technical Sanction Note" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <span className="field-label">Note Content{source === 'ai' && !stageMode ? ' (the pipeline drafts N1; text here is kept as your remark)' : ''}</span>
                <RichTextEditor value={form.body} onChange={(val) => set({ body: val })} />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>← Previous</button>
              <button type="button" className="btn" onClick={() => setStep(4)}>Next: Cover Page →</button>
            </div>
          </div>

          <div className="ef-right-panel">
            <div className="ef-accordion-item open">
              <div className="ef-accordion-trigger"><span>DOP Authority</span></div>
              <div className="ef-accordion-content" style={{ display: 'block' }}>
                {dopRow ? (
                  <div style={{ fontSize: 12 }}>
                    <div><strong>Annexure:</strong> {dopRow.annexure}</div>
                    <div><strong>FCA:</strong> {dopRow.fca}</div>
                    <div><strong>CFA:</strong> {dopRow.cfa}</div>
                    {!dopRow.verified && <div className="field-hint">row unverified — bands pending from HAL</div>}
                    <button type="button" className="link-button" onClick={() => setDopRow(null)}>clear</button>
                  </div>
                ) : (
                  <button type="button" className="ef-panel-action" style={{ width: '100%' }} onClick={() => setShowDopModal(true)}>+ Select DOP Matrix</button>
                )}
              </div>
            </div>

            <div className="ef-accordion-item open">
              <div className="ef-accordion-trigger"><span>Stamping Setup</span></div>
              <div className="ef-accordion-content" style={{ display: 'block' }}>
                {stampingSetup ? (
                  <div style={{ fontSize: 12 }}>
                    <div>✓ {stampingSetup.file?.name}</div>
                    <div>{stampingSetup.memberIds.length} authorities selected</div>
                    <button type="button" className="link-button" onClick={() => setStampingSetup(null)}>clear</button>
                  </div>
                ) : (
                  <button type="button" className="ef-panel-action" style={{ width: '100%' }} onClick={() => setShowStampingModal(true)}>+ Configure Stamping</button>
                )}
              </div>
            </div>

            <div className="ef-accordion-item open">
              <div className="ef-accordion-trigger"><span>Attachments ({attachments.length})</span></div>
              <div className="ef-accordion-content" style={{ display: 'block' }}>
                <input type="file" multiple onChange={handleFileUpload} style={{ fontSize: 11, marginBottom: 8 }} />
                {attachments.map((at, i) => (
                  <div key={i} style={{ fontSize: 11, borderBottom: '1px solid var(--border)', padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📄 {at.name}</span>
                    <button type="button" className="link-button" onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}>remove</button>
                  </div>
                ))}
                <div className="field-hint">Uploaded as typed attachments on the note after it is created.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <div className="ef-cover-page">
            <div className="ef-cover-header">
              <h2>HINDUSTAN AERONAUTICS LIMITED</h2>
              <h3>NASHIK DIVISION — E-FILE COVER PAGE</h3>
            </div>
            <dl className="ef-cover-meta">
              <dt>Subject:</dt><dd>{form.title || 'Untitled E-File'}</dd>
              <dt>Reference:</dt><dd>{form.kind} {form.carNo ? `(${form.carNo})` : ''}{requisition ? ` — register id ${requisition.id}` : ''}</dd>
              {stageMode && <><dt>Stage:</dt><dd>{stageInfo?.title || stageParam}{targetFilePk ? ` on ${openFiles.find((f) => String(f.id) === targetFilePk)?.file_id || 'proposal'}` : ' (new file)'}</dd></>}
              <dt>Priority:</dt><dd>{form.priority}</dd>
              <dt>Classification:</dt><dd>{form.classification}</dd>
              <dt>Attachments:</dt><dd>{[dopRow && 'DoP reference', stampingSetup && 'stamping PDF', attachments.length && `${attachments.length} file(s)`].filter(Boolean).join(', ') || 'none'}</dd>
            </dl>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Routing Sequence ({routingList.length + 1} steps)</h3>
            <table className="ef-routing-table">
              <thead><tr><th>Step</th><th>Officer Name</th><th>Designation</th><th>PB No</th></tr></thead>
              <tbody>
                <tr><td>Step #1 (Initiator)</td><td style={{ fontWeight: 600 }}>Signed-in Officer</td><td>Initiating Desk</td><td>Current PB</td></tr>
                {routingList.map((r, i) => (
                  <tr key={i}><td>Step #{i + 2}{i === routingList.length - 1 ? ' (approver)' : ''}</td><td>{r.name}</td><td>{r.designation}</td><td>{r.pb}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(3)}>← Previous</button>
            <button type="button" className="btn" onClick={() => setShowReviewModal(true)}>Review &amp; Submit E-File →</button>
          </div>
        </div>
      )}

      <MemberPickerModal isOpen={showMemberPicker} onClose={() => setShowMemberPicker(false)} members={members} onSelect={addMemberToRouting} title="Add Officer to Routing Chain" />
      <DopModal isOpen={showDopModal} onClose={() => setShowDopModal(false)} onSave={(dop) => setDopRow(dop)} />
      <StampingModal isOpen={showStampingModal} onClose={() => setShowStampingModal(false)} members={members} onConfirm={(setup) => setStampingSetup(setup)} />
      <FinalReviewModal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} formData={form} onSubmit={submit} busy={busy} />
    </section>
  );
}
