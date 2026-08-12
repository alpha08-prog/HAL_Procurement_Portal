import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CLASSIFICATIONS, REFERENCE_KINDS } from '../../config/notingColumns.jsx';
import { fetchAiNotes, fetchFiles, fetchMembers, initiateFile } from '../../lib/notingApi.js';
import RichTextEditor from '../../components/noting/RichTextEditor.jsx';
import MemberPickerModal from '../../components/noting/MemberPickerModal.jsx';
import DopModal from '../../components/noting/DopModal.jsx';
import StampingModal from '../../components/noting/StampingModal.jsx';
import FinalReviewModal from '../../components/noting/FinalReviewModal.jsx';

export default function Initiate() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [source, setSource] = useState('ai');
  const [ai, setAi] = useState(null);
  const [files, setFiles] = useState([]);
  const [members, setMembers] = useState([]);
  
  const [form, setForm] = useState({
    title: '',
    kind: 'CAR',
    carNo: '',
    classification: 'normal',
    priority: 'Medium',
    noteTitle: '',
    stageId: '',
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAiNotes()
      .then((d) => !cancelled && setAi(d))
      .catch(() => !cancelled && setAi({ exists: false, notes: [] }));
    fetchFiles()
      .then((d) => !cancelled && setFiles(d.files))
      .catch(() => !cancelled && setFiles([]));
    fetchMembers()
      .then((d) => !cancelled && setMembers(d.members))
      .catch(() => !cancelled && setMembers([]));
    return () => { cancelled = true; };
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const pickAiNote = (stageId) => {
    const n = ai?.notes?.find((x) => x.stageId === stageId);
    if (!n) return set({ stageId: '', noteTitle: '', body: '' });
    set({
      stageId,
      noteTitle: n.title,
      body: `<p>${n.fullOutput.replace(/\n/g, '<br/>')}</p>`,
      title: form.title || ai.item || n.title
    });
  };

  const addMemberToRouting = (member) => {
    setRoutingList((prev) => [
      ...prev,
      { id: member.id, name: member.name, designation: member.designation, pb: member.pb, unit: member.unit_path || member.unit }
    ]);
  };

  const removeMemberFromRouting = (idx) => {
    setRoutingList((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveRouting = (idx, dir) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= routingList.length) return;
    setRoutingList((prev) => {
      const arr = [...prev];
      const temp = arr[idx];
      arr[idx] = arr[nextIdx];
      arr[nextIdx] = temp;
      return arr;
    });
  };

  const handleFileUpload = (e) => {
    const filesUploaded = Array.from(e.target.files);
    const newItems = filesUploaded.map((f) => ({
      name: f.name,
      date: new Date().toLocaleDateString('en-IN'),
      refer: 'Refer'
    }));
    setAttachments((prev) => [...prev, ...newItems]);
  };

  const submit = async (reviewExtra = {}) => {
    setError(null);
    if (!form.title.trim()) return setError('File title / Subject is required.');
    setBusy(true);
    try {
      const res = await initiateFile({
        title: form.title,
        kind: form.kind,
        carNo: form.kind === 'standalone' ? undefined : form.carNo,
        source,
        stageId: source === 'ai' ? form.stageId : undefined,
        body: form.body,
        classification: form.classification,
        priority: form.priority,
        noteTitle: form.noteTitle,
        parentFileId: form.parentFileId ? Number(form.parentFileId) : undefined,
        lineNo: form.parentFileId ? form.lineNo || undefined : undefined
      });
      navigate(`/noting/note/${res.note.txn_id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const aiReady = ai?.exists && ai.notes?.length > 0;

  return (
    <section className="screen">
      <h1 className="screen-title">CREATE E-FILE</h1>

      {/* 4-Step Wizard Stepper */}
      <div className="ef-wizard-stepper">
        <button
          type="button"
          className={`ef-wizard-step${step === 1 ? ' active' : step > 1 ? ' completed' : ''}`}
          onClick={() => setStep(1)}
        >
          <span className="step-number">{step > 1 ? '✓' : '1'}</span>
          <span>1. File Details</span>
        </button>
        <span className={`ef-wizard-connector${step > 1 ? ' done' : ''}`} />

        <button
          type="button"
          className={`ef-wizard-step${step === 2 ? ' active' : step > 2 ? ' completed' : ''}`}
          onClick={() => setStep(2)}
        >
          <span className="step-number">{step > 2 ? '✓' : '2'}</span>
          <span>2. Routing</span>
        </button>
        <span className={`ef-wizard-connector${step > 2 ? ' done' : ''}`} />

        <button
          type="button"
          className={`ef-wizard-step${step === 3 ? ' active' : step > 3 ? ' completed' : ''}`}
          onClick={() => setStep(3)}
        >
          <span className="step-number">{step > 3 ? '✓' : '3'}</span>
          <span>3. Notesheet</span>
        </button>
        <span className={`ef-wizard-connector${step > 3 ? ' done' : ''}`} />

        <button
          type="button"
          className={`ef-wizard-step${step === 4 ? ' active' : ''}`}
          onClick={() => setStep(4)}
        >
          <span className="step-number">4</span>
          <span>4. Cover Page</span>
        </button>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {/* STEP 1: File Details */}
      {step === 1 && (
        <div>
          <div className="form-section">
            <div className="form-section-title">Source &amp; Reference</div>
            <div className="ai-doc-modes" role="group" aria-label="Note source">
              <button
                type="button"
                className={'btn' + (source === 'ai' ? '' : ' btn-secondary')}
                onClick={() => setSource('ai')}
              >
                AI-drafted
              </button>
              <button
                type="button"
                className={'btn' + (source === 'manual' ? '' : ' btn-secondary')}
                onClick={() => setSource('manual')}
              >
                Standalone / manual
              </button>
            </div>

            {source === 'ai' && (
              <div className="form-grid" style={{ marginTop: 'var(--space-4)' }}>
                <label className="field-wide">
                  <span className="field-label">AI-generated note template</span>
                  {aiReady ? (
                    <select
                      className="field-input"
                      value={form.stageId}
                      onChange={(e) => pickAiNote(e.target.value)}
                    >
                      <option value="">— select a generated note —</option>
                      {ai.notes.map((n) => (
                        <option key={n.stageId} value={n.stageId}>
                          {String(n.seq).padStart(2, '0')} · {n.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="field-hint">No AI outputs found — draft manually.</div>
                  )}
                </label>
              </div>
            )}
          </div>

          <div className="form-section">
            <div className="form-section-title">File Details</div>
            <div className="form-grid">
              <label className="field-wide">
                <span className="field-label">Subject / File Title <span className="req">*</span></span>
                <input
                  className="field-input"
                  value={form.title}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="e.g. Procurement of Night Vision Binoculars for HAL Nashik Division"
                />
              </label>

              <label>
                <span className="field-label">Reference Type</span>
                <select className="field-input" value={form.kind} onChange={(e) => set({ kind: e.target.value })}>
                  {REFERENCE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k === 'standalone' ? 'Standalone (no requisition)' : k}
                    </option>
                  ))}
                </select>
              </label>

              {form.kind !== 'standalone' && (
                <label>
                  <span className="field-label">{form.kind} No.</span>
                  <input
                    className="field-input"
                    value={form.carNo}
                    onChange={(e) => set({ carNo: e.target.value })}
                    placeholder={`e.g. ${form.kind}/25/229`}
                  />
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
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setStep(2)}>Next: Routing →</button>
          </div>
        </div>
      )}

      {/* STEP 2: Routing */}
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
              ⚠ Notice: Stamping authority members must be assigned in the routing sequence.
            </div>

            {routingList.length === 0 ? (
              <div className="grid-empty">No additional members added yet. Add officers to define the approval path.</div>
            ) : (
              <table className="ef-routing-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Name</th>
                    <th>Designation</th>
                    <th>PB No</th>
                    <th>Department / Unit</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {routingList.map((m, idx) => (
                    <tr key={idx}>
                      <td>#{idx + 1}</td>
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

      {/* STEP 3: Notesheet */}
      {step === 3 && (
        <div className="ef-split-layout">
          <div className="ef-main-col">
            <div className="form-section">
              <div className="form-section-title">Note Details (N1)</div>
              <div style={{ marginBottom: 12 }}>
                <span className="field-label">Note Title</span>
                <input
                  className="field-input"
                  style={{ width: '100%' }}
                  value={form.noteTitle}
                  onChange={(e) => set({ noteTitle: e.target.value })}
                  placeholder="e.g. Provisioning &amp; Technical Sanction Note"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <span className="field-label">Note Content</span>
                <RichTextEditor
                  value={form.body}
                  onChange={(val) => set({ body: val })}
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>← Previous</button>
              <button type="button" className="btn" onClick={() => setStep(4)}>Next: Cover Page →</button>
            </div>
          </div>

          {/* Right Panel */}
          <div className="ef-right-panel">
            <div className="ef-accordion-item open">
              <div className="ef-accordion-trigger">
                <span>DOP Authority</span>
              </div>
              <div className="ef-accordion-content" style={{ display: 'block' }}>
                {dopRow ? (
                  <div style={{ fontSize: 12 }}>
                    <div><strong>Annexure:</strong> {dopRow.annexure}</div>
                    <div><strong>FCA:</strong> {dopRow.fca}</div>
                    <div><strong>CFA:</strong> {dopRow.cfa}</div>
                  </div>
                ) : (
                  <button type="button" className="ef-panel-action" style={{ width: '100%' }} onClick={() => setShowDopModal(true)}>
                    + Select DOP Matrix
                  </button>
                )}
              </div>
            </div>

            <div className="ef-accordion-item open">
              <div className="ef-accordion-trigger">
                <span>Stamping Setup</span>
              </div>
              <div className="ef-accordion-content" style={{ display: 'block' }}>
                {stampingSetup ? (
                  <div style={{ fontSize: 12 }}>
                    <div>✓ Stamping PDF attached</div>
                    <div>{stampingSetup.memberIds.length} authorities selected</div>
                  </div>
                ) : (
                  <button type="button" className="ef-panel-action" style={{ width: '100%' }} onClick={() => setShowStampingModal(true)}>
                    + Configure Stamping
                  </button>
                )}
              </div>
            </div>

            <div className="ef-accordion-item open">
              <div className="ef-accordion-trigger">
                <span>Attachments ({attachments.length})</span>
              </div>
              <div className="ef-accordion-content" style={{ display: 'block' }}>
                <input type="file" multiple onChange={handleFileUpload} style={{ fontSize: 11, marginBottom: 8 }} />
                {attachments.map((at, i) => (
                  <div key={i} style={{ fontSize: 11, borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
                    📄 {at.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Cover Page & Final Review */}
      {step === 4 && (
        <div>
          <div className="ef-cover-page">
            <div className="ef-cover-header">
              <h2>HINDUSTAN AERONAUTICS LIMITED</h2>
              <h3>NASHIK DIVISION — E-FILE COVER PAGE</h3>
            </div>

            <dl className="ef-cover-meta">
              <dt>Subject:</dt>
              <dd>{form.title || 'Untitled E-File'}</dd>
              <dt>Reference:</dt>
              <dd>{form.kind} {form.carNo ? `(${form.carNo})` : ''}</dd>
              <dt>Priority:</dt>
              <dd>{form.priority}</dd>
              <dt>Classification:</dt>
              <dd>{form.classification}</dd>
            </dl>

            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Routing Sequence ({routingList.length + 1} steps)</h3>
            <table className="ef-routing-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Officer Name</th>
                  <th>Designation</th>
                  <th>PB No</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Step #1 (Initiator)</td>
                  <td style={{ fontWeight: 600 }}>Signed-in Officer</td>
                  <td>Initiating Desk</td>
                  <td>Current PB</td>
                </tr>
                {routingList.map((r, i) => (
                  <tr key={i}>
                    <td>Step #{i + 2}</td>
                    <td>{r.name}</td>
                    <td>{r.designation}</td>
                    <td>{r.pb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(3)}>← Previous</button>
            <button type="button" className="btn" onClick={() => setShowReviewModal(true)}>
              Review &amp; Submit E-File →
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <MemberPickerModal
        isOpen={showMemberPicker}
        onClose={() => setShowMemberPicker(false)}
        members={members}
        onSelect={addMemberToRouting}
        title="Add Officer to Routing Chain"
      />

      <DopModal
        isOpen={showDopModal}
        onClose={() => setShowDopModal(false)}
        onSave={(dop) => setDopRow(dop)}
      />

      <StampingModal
        isOpen={showStampingModal}
        onClose={() => setShowStampingModal(false)}
        members={members}
        onConfirm={(setup) => setStampingSetup(setup)}
      />

      <FinalReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        formData={form}
        onSubmit={submit}
        busy={busy}
      />
    </section>
  );
}
