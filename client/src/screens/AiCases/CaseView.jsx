import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchBlock1, fetchCase, fetchNoteForm, handOver, raiseNote
} from '../../lib/aiCasesApi.js';

// One procurement file, walking the cascade.
//
// Whether the action panel appears at all is decided by custody: the sheet names one
// agency per stage as the only one that may raise its notes, so a position from the other
// agency gets a read-only file and a "take it over" button instead. That check is enforced
// server-side — this screen only reflects it.
export default function CaseView() {
  const { id } = useParams();
  const [kase, setKase] = useState(null);
  const [block1, setBlock1] = useState(null);
  const [pick, setPick] = useState(null);        // the note being raised
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState({});
  const [openNote, setOpenNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null);  // an advisory rule points elsewhere
  const [last, setLast] = useState(null);        // what the last raise produced

  const load = () => fetchCase(id).then((d) => setKase(d.case)).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    fetchBlock1().then((d) => setBlock1(d.checklist)).catch(() => {});
  }, [id]);

  const choose = async (noteId) => {
    setError(null);
    setConfirm(null);
    setPick(noteId);
    setForm(null);
    try {
      const f = await fetchNoteForm(id, noteId);
      setForm(f);
      setFields(Object.fromEntries(f.fields.map((x) => [x.key, x.value])));
    } catch (e) {
      setError(e.message);
      setPick(null);
    }
  };

  const submit = async (override = false) => {
    setBusy(true);
    setError(null);
    try {
      const out = await raiseNote(id, { noteId: pick, fields, override });
      setKase(out.case);
      setLast(out.skipped
        ? { skipped: true, branch: out.branch }
        : { ...out.result, handoverNeeded: out.handoverNeeded });
      setPick(null);
      setForm(null);
      setConfirm(null);
    } catch (e) {
      if (e.needsOverride) setConfirm({ message: e.message, advised: e.advised });
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const take = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await handOver(id);
      setKase(out.case);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !kase) return <section className="screen"><div className="banner banner-error">{error}</div></section>;
  if (!kase) return <section className="screen"><div className="grid-empty">Loading the file…</div></section>;

  const p = kase.permissions;

  return (
    <section className="screen">
      <Link className="back-link" to="/ai-cases">← All cases</Link>
      <h1 className="screen-title">{kase.caseRef} — {kase.title}</h1>
      <p className="screen-sub">{kase.node?.title}</p>

      <div className="note-idbar">
        <span className="id-chip">
          <span className="id-chip-label">Stage</span>
          <span className="id-chip-value">{kase.node?.stageNo ?? '—'}</span>
        </span>
        <span className="id-chip">
          <span className="id-chip-label">Held by</span>
          <span className="id-chip-value">{kase.holdingAgency}</span>
        </span>
        <span className="id-chip">
          <span className="id-chip-label">Notes</span>
          <span className="id-chip-value">{kase.notes.length}</span>
        </span>
        <span className="id-chip">
          <span className="id-chip-label">Hand-overs</span>
          <span className="id-chip-value">{kase.handovers}</span>
        </span>
        <span className={`pill ${kase.status === 'closed' ? 'pill-danger' : 'pill-info'}`}>
          {kase.status === 'closed' ? 'Closed' : 'Open'}
        </span>
        {kase.isFixture && <span className="pill pill-warning">fabricated data</span>}
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {/* ---- custody ---- */}
      <div className={`banner ${p.canAct ? 'banner-success' : 'banner-restricted'}`}>
        <strong>{p.roleLabel}</strong> — {p.reason}
        {p.canHandOver && (
          <>
            {' '}
            <button className="btn btn-inline" onClick={take} disabled={busy}>
              {p.bothAgencies
                ? `Move the file to the ${p.stageOwner && p.stageOwner !== p.holdingAgency ? p.stageOwner : 'other'} Agency`
                : 'Take the file over'}
            </button>
          </>
        )}
      </div>
      {p.stageElsewhere && (
        <p className="screen-note">
          The sheet assigns stage {kase.node?.stageNo} to the <strong>{p.stageOwner}</strong>{' '}
          Agency, and the file is held by <strong>{p.holdingAgency}</strong>. That crossing is
          the hand-over the responsibility sheet forces — it is counted, and it is why this
          file shows {kase.handovers} so far.
        </p>
      )}

      {kase.node?.description && <p className="screen-note">{kase.node.description}</p>}

      {/* ---- what just happened ---- */}
      {last && !last.skipped && (
        <div className="banner banner-success">
          <strong>{last.title ?? pick} raised.</strong>{' '}
          The model drafted {last.newSection?.length ?? 0} characters;{' '}
          {last.carryChars > 0
            ? `${last.carryChars} characters of the previous note were carried forward in code (from ${last.carryFrom}).`
            : 'this note starts a fresh chain.'}
          {last.formatsBuilt?.length > 0 && ` ${last.formatsBuilt.length} annexure(s) computed.`}
          {last.overridden && ` Advisory overridden: ${last.overridden}.`}
          {!last.slm?.ok && ` ⚠ ${last.slm?.error ?? 'the model was unavailable'} — the section is marked.`}
          {last.handoverNeeded && (
            <> The next stage belongs to the <strong>{last.handoverNeeded}</strong> Agency.</>
          )}
        </div>
      )}
      {last?.skipped && (
        <div className="banner banner-info">
          Skipped — the branch rule <code>{last.branch?.rule}</code> came out false, so this
          note does not apply to this case.
        </div>
      )}

      {/* ---- the action panel ---- */}
      {p.canAct && kase.status === 'open' && !pick && (
        <div className="form-section">
          <h2 className="form-section-title">Notes the sheet allows here</h2>
          <p className="field-hint">
            Only these. The spreadsheet lists which notes are possible at each stage and who
            may raise them — it never says when to prefer one, so any of these is selectable.
          </p>
          <div className="clause-plan">
            {kase.options.map((o) => (
              <div className="stub-card" key={o.noteId}>
                <div>
                  <strong>{o.label}</strong>
                  {o.advice?.advised && <span className="pill pill-warning">advised — {o.advice.rule}()</span>}
                  {o.advice && !o.advice.advised && !o.advice.undecided && (
                    <span className="pill pill-neutral">{o.advice.rule}() = false</span>
                  )}
                  {o.advice?.undecided && <span className="pill pill-neutral">{o.advice.rule}() undecided</span>}
                  {o.terminal && <span className="pill pill-danger">closes the file</span>}
                  {o.needBased && <span className="tag">need-based</span>}
                </div>
                {o.advice && <div className="field-hint">{o.advice.note}</div>}
                {o.formats?.length > 0 && (
                  <div className="field-hint">Produces: {o.formats.join(', ')}</div>
                )}
                <button className="btn btn-inline" onClick={() => choose(o.noteId)}>
                  Raise this note
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- the note form ---- */}
      {p.canAct && pick && (
        <div className="form-section">
          <h2 className="form-section-title">{form?.title ?? pick}</h2>
          {!form ? <div className="grid-empty">Loading the form…</div> : (
            <>
              <p className="field-hint">{form.hint}</p>
              {form.carryFrom && (
                <p className="field-hint">
                  This note carries <code>{form.carryFrom}</code> forward — that prose is moved
                  in code and never re-drafted.
                </p>
              )}
              {form.prereqWarnings?.length > 0 && (
                <div className="banner banner-info">
                  Prerequisite formats not yet on file (warning only — the sheet's "Required
                  for" column):
                  <ul>
                    {form.prereqWarnings.map((w) => (
                      <li key={w.id}>{w.title} — owned by the {w.owner} Agency
                        {w.required ? '' : ' (if applicable)'}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="form-grid">
                {form.fields.map((f) => (
                  <label className="field-label field-wide" key={f.key}>
                    {f.label}
                    {f.seeded && <span className="tag">seeded</span>}
                    {f.list ? (
                      <textarea
                        className="field-input"
                        rows={2}
                        value={fields[f.key] ?? ''}
                        placeholder="semicolons separate list items"
                        onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                      />
                    ) : (
                      <input
                        className="field-input"
                        value={fields[f.key] ?? ''}
                        onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                      />
                    )}
                  </label>
                ))}
              </div>

              {confirm && (
                <div className="banner banner-restricted">
                  {confirm.message}
                  <div className="form-actions">
                    <button className="btn" onClick={() => submit(true)} disabled={busy}>
                      Raise it anyway (recorded as an override)
                    </button>
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button className="btn" onClick={() => submit(false)} disabled={busy}>
                  {busy ? 'Generating — the model can take a moment…' : 'Generate the note'}
                </button>
                <button className="btn btn-secondary" onClick={() => { setPick(null); setForm(null); setConfirm(null); }} disabled={busy}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---- the file ---- */}
      <h2 className="section-heading">The file as it stands ({kase.notes.length} note{kase.notes.length === 1 ? '' : 's'})</h2>
      {!kase.notes.length ? (
        <div className="grid-empty">Nothing raised yet.</div>
      ) : (
        <div className="route-log">
          {kase.notes.map((n) => (
            <div className="route-step" key={n.seq}>
              <div className="route-step-head">
                <strong>N{n.seq}</strong> {n.title}
                <span className={`pill ${n.agency === 'Indenting' ? 'pill-warning' : 'pill-info'}`}>
                  {n.agency}
                </span>
                <span className="officer-pb-tag">{n.raisedByName} · {n.raisedByRole}</span>
                {!n.slmOk && <span className="pill pill-danger">model unavailable</span>}
                {n.overridden && <span className="pill pill-warning">override</span>}
                <button className="link-btn" onClick={() => setOpenNote(openNote === n.seq ? null : n.seq)}>
                  {openNote === n.seq ? 'hide' : 'read'}
                </button>
              </div>
              <div className="field-hint">
                {n.carryChars > 0
                  ? `carried ${n.carryChars} chars forward from ${n.carryFrom}, added ${n.newSection?.length ?? 0}`
                  : `fresh note, ${n.newSection?.length ?? 0} chars`}
                {n.deltaKeys?.length > 0 && ` · new fields: ${n.deltaKeys.join(', ')}`}
              </div>
              {openNote === n.seq && (
                <>
                  <h3 className="note-heading">New section (drafted)</h3>
                  <pre className="note-body">{n.newSection}</pre>
                  {n.carryChars > 0 && (
                    <>
                      <h3 className="note-heading">Full note as it reads on file</h3>
                      <pre className="note-body">{n.fullOutput}</pre>
                    </>
                  )}
                  {n.formatsBuilt?.length > 0 && (
                    <>
                      <h3 className="note-heading">Annexures (computed, not drafted)</h3>
                      {n.formatsBuilt.map((f) => (
                        <pre className="note-body" key={f.id}>{JSON.stringify(f, null, 1)}</pre>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---- formats and trail ---- */}
      {kase.formatsOnFile.length > 0 && (
        <>
          <h2 className="section-heading">Formats on file</h2>
          <div className="grid-wrap">
            <table className="mini-table">
              <thead><tr><th>Annexure</th><th>Owned by</th></tr></thead>
              <tbody>
                {kase.formatsOnFile.map((f) => (
                  <tr key={f.id}>
                    <td>{f.title}</td>
                    <td>{f.owner ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="section-heading">Custody trail</h2>
      <div className="timeline">
        {kase.events.map((e, i) => (
          <div className="timeline-step" key={i}>
            <span className="timeline-dot" />
            <div className="timeline-content">
              <span className="timeline-action">{e.kind}</span>
              <span className="timeline-remark">{e.detail}</span>
              {e.fromAgency && e.toAgency && (
                <span className="timeline-remark">{e.fromAgency} → {e.toAgency}</span>
              )}
              <span className="timeline-actor">{e.actorName ?? '—'}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="screen-note">
        Responsibility split so far: {Object.entries(kase.responsibilitySplit)
          .map(([a, n]) => `${a} ${n}`).join(' · ') || 'nothing raised'} ·{' '}
        {kase.handovers} hand-over{kase.handovers === 1 ? '' : 's'}.
      </p>

      {kase.node?.checklist && block1 && (
        <>
          <h2 className="section-heading">Inputs for tender document generation</h2>
          <p className="field-hint">
            Block 1 of the responsibility sheet — each line owned by one agency. Warning
            only; the note can be raised with them pending.
          </p>
          {block1.map((g) => (
            <div key={g.group}>
              <h3 className="note-heading">{g.group}</h3>
              <ul>
                {g.items.map((it) => (
                  <li key={it.label}>
                    {it.label}{' '}
                    <span className={`pill ${it.owner === kase.holdingAgency ? 'pill-success' : 'pill-neutral'}`}>
                      {it.owner}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
