import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DataGrid from '../../components/DataGrid.jsx';
import { AI_CASE_COLUMNS } from '../../config/aiCaseColumns.jsx';
import { fetchCases, fetchMyPosition, fetchSlmHealth, fetchSources, openCase } from '../../lib/aiCasesApi.js';

// The queue. A case is a shared file held by one of the two agencies at a time, so the
// first thing this screen answers is "which of these is waiting on me?".
export default function AiCases() {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [slm, setSlm] = useState(null);
  const [sources, setSources] = useState([]);
  const [caseRef, setCaseRef] = useState('CAR/25/229');
  const [title, setTitle] = useState('Procurement of Night Vision Binoculars');
  const [sourceCase, setSourceCase] = useState('nvb');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('mine');

  const reload = () => fetchCases().then(setData).catch((e) => setError(e.message));

  useEffect(() => {
    fetchMyPosition().then(setMe).catch((e) => setError(e.message));
    fetchSlmHealth().then(setSlm).catch(() => {});
    fetchSources().then((s) => setSources(s.sources)).catch(() => {});
    reload();
  }, []);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await openCase({ caseRef, title, sourceCase });
      await reload();
      setFilter('all');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const rows = (data?.cases ?? []).filter((c) => {
    if (filter === 'mine') return c.withMe;
    if (filter === 'open') return c.status === 'open';
    if (filter === 'closed') return c.status === 'closed';
    return true;
  });

  return (
    <section className="screen">
      <h1 className="screen-title">AI Procurement Cases</h1>
      <p className="screen-sub">
        Each case is one procurement file walking the responsibility cascade. A file sits
        with either the Indenting or the Tendering agency, and only positions belonging to
        that agency can raise its next note — everyone else sees it read-only.
      </p>

      {error && <div className="banner banner-error">{error}</div>}

      {me && (
        <div className="banner banner-info">
          You are signed in as <strong>{me.roleLabel}</strong>, acting for{' '}
          <strong>{me.agencies.length ? me.agencies.join(' and ') : 'no agency'}</strong>.
          {me.readOnly && ' This is a downstream position — you can read files but not raise notes.'}
          {!me.canCreate && !me.readOnly && ' A case starts with the indent, so only the Indenting side can open one.'}
        </div>
      )}

      {slm && !slm.up && (
        <div className="banner banner-restricted">
          The language model is not reachable — {slm.reason}. You can still walk the cascade;
          each note's drafted section will come back marked <code>[SLM_UNAVAILABLE]</code>
          instead of prose. Everything computed (annexures, figures, carry-forward) is unaffected.
        </div>
      )}
      {slm?.up && !slm.modelPresent && (
        <div className="banner banner-restricted">{slm.reason}</div>
      )}

      <div className="metric-cards">
        <div className="metric-card">
          <div className="metric-value">{data ? data.mine : '—'}</div>
          <div className="metric-label">waiting on you</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{data ? data.open : '—'}</div>
          <div className="metric-label">open files</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{data ? data.cases.length : '—'}</div>
          <div className="metric-label">cases in all</div>
        </div>
      </div>

      {me?.canCreate && (
        <div className="form-section">
          <h2 className="form-section-title">Open a new file</h2>
          <p className="field-hint">
            The facts are seeded from a case file under <code>ai/</code>; the notes are
            generated as you walk the cascade.
          </p>
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
              Seed the facts from
              <select className="field-input" value={sourceCase} onChange={(e) => setSourceCase(e.target.value)}>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>
          {sources.find((s) => s.id === sourceCase)?.fixture && (
            <p className="field-hint">
              ⚠ This case is seeded from fabricated bid data — see ai/fixtures/.
            </p>
          )}
          <div className="form-actions">
            <button className="btn" onClick={create} disabled={busy}>
              {busy ? 'Opening…' : 'Open the file'}
            </button>
          </div>
        </div>
      )}

      <div className="ef-filter-tabs">
        {[
          ['mine', `With me${data ? ` (${data.mine})` : ''}`],
          ['open', 'Open'],
          ['closed', 'Closed'],
          ['all', 'All']
        ].map(([id, label]) => (
          <button
            key={id}
            className={`ef-filter-tab${filter === id ? ' active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <DataGrid
        columns={AI_CASE_COLUMNS}
        rows={data ? rows : null}
        emptyMessage={
          filter === 'mine'
            ? 'Nothing is waiting on you. Switch to "All" to see files held by the other agency.'
            : 'No cases yet.'
        }
      />

      <p className="screen-note">
        Read-only output from the Python CLI still lives on the{' '}
        <Link to="/ai-documents">AI Documents</Link> screen. This screen is the live one —
        notes here are generated in the browser, by whoever holds the file.
      </p>
    </section>
  );
}
