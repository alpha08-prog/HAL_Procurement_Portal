import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../../context/RoleContext.jsx';
import {
  fetchChecklist, fetchMeta, planChain, previewInjections, startChain, submitChecklist
} from '../../lib/approvalsApi.js';

// The indentor's checklist, filled in the browser.
//
// The point of this screen is the right-hand panel: nine rows of this form name an
// approving authority in their own text, so as the user answers, the approval chain
// changes under them. Answer "yes" to short tendering and the Head of Division appears;
// answer "yes" to brand-specific procurement and a Committee does. There is no fixed
// ladder — the form builds it.
export default function Intake() {
  const nav = useNavigate();
  const { role } = useRole();
  const canAct = ['indentor', 'purchase_maker', 'purchase_officer', 'hod_imm', 'admin'].includes(role);
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [caseRef, setCaseRef] = useState('CAR/26/118');
  const [title, setTitle] = useState('Procurement of 250W High Bay LED Light Fittings');
  const [division, setDivision] = useState('DIV9');
  const [dept, setDept] = useState('FIRE & SEC');
  const [noteId, setNoteId] = useState('provisioning');
  const [preview, setPreview] = useState(null);
  const [plan, setPlan] = useState(null);
  const [openBlock, setOpenBlock] = useState('provisioning');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    Promise.all([fetchMeta(), fetchChecklist()])
      .then(([m, f]) => {
        setMeta(m);
        setForm(f);
        setAnswers(f.defaults);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Re-ask the server which authorities the current answers oblige.
  useEffect(() => {
    if (!Object.keys(answers).length) return;
    let dead = false;
    previewInjections(answers)
      .then((p) => !dead && setPreview(p))
      .catch(() => {});
    return () => { dead = true; };
  }, [answers]);

  const depts = useMemo(
    () => (meta?.unitTree?.[division] ?? []),
    [meta, division]
  );

  const injectionIndex = form?.injectionIndex ?? {};
  const firedSl = new Set((preview?.injected ?? []).map((i) => `${i.block}:${i.sl}`));

  const setAnswer = (block, sl, value) =>
    setAnswers((a) => ({ ...a, [`${block}:${sl}`]: value }));

  const doPlan = async () => {
    setBusy(true);
    setError(null);
    try {
      const { plan: p } = await planChain({ noteId, division, dept, answers });
      setPlan(p);
      setNotice(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doStart = async () => {
    setBusy(true);
    setError(null);
    try {
      await submitChecklist({ caseRef, title, division, dept, answers });
      const { chain } = await startChain({ noteId, division, dept, caseRef, answers });
      nav(`/approvals/chain/${chain.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  if (error && !form) return <section className="screen"><div className="banner banner-error">{error}</div></section>;
  if (!form || !meta) return <section className="screen"><div className="grid-empty">Loading the checklist…</div></section>;

  const committeeNote = meta.notes.find((n) => n.id === noteId)?.mode === 'committee';

  return (
    <section className="screen">
      <h1 className="screen-title">Indent Intake — Checklist</h1>
      <p className="screen-sub">
        {form.summary.rows} clauses from the Indentor Checklist. {form.summary.injectionRows} of
        them name an approving authority in their own text, so your answers decide who has to
        sign this file — watch the panel on the right change as you fill it in.
      </p>

      {error && <div className="banner banner-error">{error}</div>}
      {notice && <div className="banner banner-info">{notice}</div>}

      <div className="ef-split-layout">
        <div className="ef-main-col">
          <div className="form-section">
            <h2 className="form-section-title">The file</h2>
            <div className="form-grid">
              <label className="field-label">
                Requisition ref
                <input className="field-input" value={caseRef} onChange={(e) => setCaseRef(e.target.value)} />
              </label>
              <label className="field-label field-wide">
                Subject
                <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="field-label">
                Division
                <select
                  className="field-input"
                  value={division}
                  onChange={(e) => { setDivision(e.target.value); setDept(''); setPlan(null); }}
                >
                  {meta.divisions.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="field-label">
                Requisitioning department
                <select
                  className="field-input"
                  value={dept}
                  onChange={(e) => { setDept(e.target.value); setPlan(null); }}
                >
                  <option value="">— select —</option>
                  {depts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="field-label">
                Note to raise
                <select className="field-input" value={noteId} onChange={(e) => { setNoteId(e.target.value); setPlan(null); }}>
                  {meta.notes.map((n) => (
                    <option key={n.id} value={n.id}>{n.label} — {n.agency} ({n.mode})</option>
                  ))}
                </select>
              </label>
            </div>
            {committeeNote && (
              <div className="banner banner-info">
                {meta.notes.find((n) => n.id === noteId)?.label} is decided by a committee, not a
                serial chain. Use the Committees screen for it.
              </div>
            )}
          </div>

          {form.sections.map((sec) => (
            <div className="form-section" key={sec.id}>
              <h2
                className="form-section-title"
                style={{ cursor: 'pointer' }}
                onClick={() => setOpenBlock(openBlock === sec.id ? null : sec.id)}
              >
                {sec.title} ({sec.rows.length}) {openBlock === sec.id ? '▾' : '▸'}
              </h2>
              <p className="field-hint">{sec.hint}</p>
              {openBlock === sec.id && (
                <div className="grid-wrap">
                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th style={{ width: '3rem' }}>Sl</th>
                        <th>Terms &amp; condition</th>
                        <th style={{ width: '9rem' }}>Category</th>
                        <th style={{ width: '14rem' }}>Compliance</th>
                        <th style={{ width: '12rem' }}>Feeds</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sec.rows.map((r) => {
                        const key = `${r.block}:${r.sl}`;
                        const inj = injectionIndex[key];
                        const fired = firedSl.has(key);
                        return (
                          <tr key={key}>
                            <td>{r.sl}</td>
                            <td>
                              {r.clause}
                              {inj && (
                                <div className={`field-hint-inline ${fired ? '' : ''}`}>
                                  <span className={`pill ${fired ? 'pill-warning' : 'pill-neutral'}`}>
                                    {fired ? 'requires' : 'may require'}
                                  </span>{' '}
                                  {inj.authority}
                                </div>
                              )}
                            </td>
                            <td>
                              {r.category === 'T' && <span className="pill pill-info">Technical</span>}
                              {r.category === 'C' && <span className="pill pill-neutral">Commercial</span>}
                            </td>
                            <td>
                              <input
                                className="field-input"
                                value={answers[key] ?? ''}
                                placeholder="YES / NA / value"
                                onChange={(e) => setAnswer(r.block, r.sl, e.target.value)}
                              />
                            </td>
                            <td>
                              {r.consumed_by === 'tender+tec_report' && <span className="tag">TEC Report</span>}
                              {r.consumed_by === 'tender+comm_eval' && <span className="tag">Commercial Eval</span>}
                              {r.consumed_by === 'indentor' && <span className="tag">Provisioning</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        <aside className="ef-right-panel">
          <h2 className="section-heading">Who this obliges</h2>
          <p className="field-hint">
            Recomputed from your answers, quoting the clause that requires each one.
          </p>

          {preview && (
            <div className="metric-cards">
              <div className="metric-card">
                <div className="metric-value">{preview.injected.length}</div>
                <div className="metric-label">authorities obliged</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{preview.dopLevel ?? '—'}</div>
                <div className="metric-label">DOP level (sl 11)</div>
              </div>
            </div>
          )}

          <div className="grant-list">
            {(preview?.injected ?? []).map((i) => (
              <div className="stub-card" key={`${i.block}:${i.sl}`}>
                <div>
                  <strong>{i.authority}</strong>{' '}
                  {i.external && <span className="pill pill-danger">outside HAL</span>}
                </div>
                <div className="field-hint">
                  sl {i.sl} answered “{i.answer || '(blank)'}” — {i.trigger} trigger
                </div>
                <div className="field-hint">{i.why?.slice(0, 190)}</div>
              </div>
            ))}
            {preview && !preview.injected.length && (
              <div className="grid-empty">Nothing beyond the base chain.</div>
            )}
          </div>

          <div className="form-actions">
            {canAct ? (
              <>
                <button className="btn btn-secondary" onClick={doPlan} disabled={busy || !dept}>
                  Resolve the chain
                </button>
                <button className="btn" onClick={doStart} disabled={busy || !dept || committeeNote}>
                  Start the file
                </button>
              </>
            ) : (
              <p className="field-hint" style={{ color: 'var(--color-warning, #b45309)', fontWeight: 600 }}>
                Your role ({role}) can view the checklist but cannot start approval files.
              </p>
            )}
          </div>
          {!dept && <p className="field-hint">Pick a requisitioning department first.</p>}

          {plan && (
            <>
              <h2 className="section-heading">Resolved chain — {plan.slots.length} positions</h2>
              <p className="field-hint">
                {plan.unresolved} unresolved · {plan.ambiguousCount} ambiguous ·{' '}
                {plan.externalCount} outside HAL
              </p>
              <ol className="roadmap-list">
                {plan.slots.map((s, i) => (
                  <li key={i}>
                    <strong>{s.title}</strong>
                    <div className="field-hint">
                      {s.external
                        ? 'outside HAL — must be obtained on paper'
                        : s.person
                          ? `${s.person.name} (${s.person.grade}) · ${s.person.dept}`
                          : 'UNRESOLVED in the directory'}
                    </div>
                    {s.caveats?.map((c) => (
                      <div className="field-hint" key={c}>⚠ {c}</div>
                    ))}
                  </li>
                ))}
              </ol>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
