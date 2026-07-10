import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CLASSIFICATIONS, REFERENCE_KINDS } from '../../config/notingColumns.jsx';
import { fetchAiNotes, initiateFile } from '../../lib/notingApi.js';

// Initiate a new file + its first note (N1). Source is either the AI pipeline's
// generated note or a standalone/manual draft (administrative approvals, no requisition).
export default function Initiate() {
  const navigate = useNavigate();
  const [source, setSource] = useState('ai');
  const [ai, setAi] = useState(null); // { exists, item, notes } | null
  const [form, setForm] = useState({
    title: '',
    kind: 'CAR',
    carNo: '',
    classification: 'normal',
    noteTitle: '',
    stageId: '',
    body: ''
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAiNotes()
      .then((d) => !cancelled && setAi(d))
      .catch(() => !cancelled && setAi({ exists: false, notes: [] }));
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Pull the chosen AI note into the draft (prose stays server-authoritative; we snapshot it).
  const pickAiNote = (stageId) => {
    const n = ai?.notes?.find((x) => x.stageId === stageId);
    if (!n) return set({ stageId: '', noteTitle: '', body: '' });
    set({
      stageId,
      noteTitle: n.title,
      body: n.fullOutput,
      title: form.title || ai.item || n.title
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError('File title is required.');
    if (source === 'ai' && !form.body) return setError('Pick an AI-generated note to base N1 on.');
    setBusy(true);
    try {
      const res = await initiateFile({
        title: form.title,
        kind: source === 'ai' ? form.kind : form.kind,
        carNo: form.kind === 'standalone' ? undefined : form.carNo,
        source,
        stageId: source === 'ai' ? form.stageId : undefined,
        body: form.body,
        classification: form.classification,
        noteTitle: form.noteTitle
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
      <h1 className="screen-title">Initiate Note (N1)</h1>
      <p className="screen-sub">
        Every HAL member can start a file. N1 can be AI-drafted from the pipeline or a
        standalone administrative note with no MPR/CAR/SPR/CPR reference.
      </p>

      <form onSubmit={submit}>
        <div className="form-section">
          <div className="form-section-title">Source</div>
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
                <span className="field-label">AI-generated note</span>
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
                  <div className="field-hint">
                    No AI outputs found — run the pipeline (<code>python ai/run.py</code>) or use
                    Standalone / manual.
                  </div>
                )}
              </label>
            </div>
          )}
        </div>

        <div className="form-section">
          <div className="form-section-title">File</div>
          <div className="form-grid">
            <label className="field-wide">
              <span className="field-label">
                File title <span className="req">*</span>
              </span>
              <input
                className="field-input"
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="e.g. Procurement of Night Vision Binocular"
              />
            </label>

            <label>
              <span className="field-label">Reference type</span>
              <select
                className="field-input"
                value={form.kind}
                onChange={(e) => set({ kind: e.target.value })}
              >
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
              <span className="field-label">Classification</span>
              <select
                className="field-input"
                value={form.classification}
                onChange={(e) => set({ classification: e.target.value })}
              >
                {CLASSIFICATIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">Note (N1)</div>
          <div className="form-grid">
            <label className="field-wide">
              <span className="field-label">Note title</span>
              <input
                className="field-input"
                value={form.noteTitle}
                onChange={(e) => set({ noteTitle: e.target.value })}
                placeholder="e.g. Provisioning Note"
              />
            </label>
            <label className="field-wide">
              <span className="field-label">Note body</span>
              <textarea
                className="field-input"
                rows={source === 'ai' ? 10 : 6}
                value={form.body}
                onChange={(e) => set({ body: e.target.value })}
                placeholder="Note content. Pipe-delimited rows render as tables."
              />
            </label>
          </div>
        </div>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="form-actions">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Creating…' : 'Create & open'}
          </button>
          <span className="action-note">
            Generates a connected File ID, Reference No and Transaction ID.
          </span>
        </div>
      </form>
    </section>
  );
}
