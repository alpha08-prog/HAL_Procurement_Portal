import { useEffect, useMemo, useState } from 'react';
import DataGrid from '../../components/DataGrid.jsx';
import { HISTORY_COLUMNS, libraryColumns, matrixColumns } from '../../config/contractColumns.jsx';
import { amendClause, fetchClauseHistory, fetchLibrary } from '../../lib/contractsApi.js';
import { useRole } from '../../context/RoleContext.jsx';

// The General Library of Contract Terms & Conditions (72 STC + the clauses matrix).
// Readable by everyone; AMENDING a clause is admin-only — the server checks the real
// account role, and every amendment records the superseded text, the person and the
// legal-vetting reference doc. Amendments never change already-generated contracts.
export default function ClauseLibrary() {
  const { role } = useRole();
  const isAdmin = role === 'admin';
  const [tab, setTab] = useState('clauses');
  const [lib, setLib] = useState(null); // { contractTypes, clauses, cells }
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [amend, setAmend] = useState(null); // { body, changeNote, referenceDoc } | null
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetchLibrary()
      .then(setLib)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const open = (clause) => {
    setSelected(clause);
    setAmend(null);
    setHistory(null);
    fetchClauseHistory(clause.id)
      .then((d) => setHistory(d.versions))
      .catch(() => setHistory([]));
  };

  const matrixRows = useMemo(() => {
    if (!lib) return null;
    const byClause = new Map();
    for (const c of lib.cells) {
      if (!byClause.has(c.clause_id)) byClause.set(c.clause_id, {});
      byClause.get(c.clause_id)[c.contract_type_id] = c.value;
    }
    return lib.clauses
      .filter((c) => c.matrix_no != null)
      .map((c) => ({ ...c, cells: byClause.get(c.id) || {} }));
  }, [lib]);

  const submitAmend = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await amendClause(selected.id, amend);
      setAmend(null);
      setSelected(res.clause);
      await load();
      open(res.clause);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="screen">
      <h1 className="screen-title">Contract Terms &amp; Conditions Library</h1>
      <p className="screen-sub">
        The general library of Standard Contract Terms &amp; Conditions and the Contract
        Clauses Matrix that drives auto-selection by type of contract.
      </p>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="ai-doc-modes" role="group" aria-label="Library view">
        <button type="button" className={'btn' + (tab === 'clauses' ? '' : ' btn-secondary')} onClick={() => setTab('clauses')}>
          Clauses
        </button>
        <button type="button" className={'btn' + (tab === 'matrix' ? '' : ' btn-secondary')} onClick={() => setTab('matrix')}>
          Matrix
        </button>
      </div>

      {tab === 'clauses' && (
        <>
          {!isAdmin && (
            <div className="banner banner-restricted">
              🔒 Standard clauses are amended only by an authorised admin after legal vetting.
              You have read-only access.
            </div>
          )}
          <DataGrid columns={libraryColumns(open)} rows={lib?.clauses} emptyMessage="Library not seeded." />

          {selected && (
            <div className="form-section clause-drawer">
              <div className="form-section-title">
                Clause {selected.matrix_no ?? '—'} · {selected.title} <span className="tag">v{selected.version}</span>
                {selected.boilerplate ? <span className="tag">Boilerplate</span> : null}
              </div>
              {selected.guideline && (
                <p className="field-hint">
                  <strong>Guideline / circular reference:</strong> {selected.guideline}
                </p>
              )}
              <pre className="clause-body">{selected.body}</pre>

              {isAdmin && !amend && (
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setAmend({ body: selected.body, changeNote: '', referenceDoc: '' })}
                  >
                    Amend clause
                  </button>
                  <span className="action-note">Requires a change note and a legal-vetting reference doc.</span>
                </div>
              )}

              {amend && (
                <form onSubmit={submitAmend} className="form-grid" style={{ marginTop: 'var(--space-3)' }}>
                  <label className="field-wide">
                    <span className="field-label">
                      Amended clause text <span className="req">*</span>
                    </span>
                    <textarea
                      className="field-input"
                      rows={10}
                      value={amend.body}
                      onChange={(e) => setAmend({ ...amend, body: e.target.value })}
                    />
                  </label>
                  <label>
                    <span className="field-label">
                      Change note <span className="req">*</span>
                    </span>
                    <input
                      className="field-input"
                      value={amend.changeNote}
                      onChange={(e) => setAmend({ ...amend, changeNote: e.target.value })}
                      placeholder="What changed and why"
                    />
                  </label>
                  <label>
                    <span className="field-label">
                      Reference doc for change <span className="req">*</span>
                    </span>
                    <input
                      className="field-input"
                      value={amend.referenceDoc}
                      onChange={(e) => setAmend({ ...amend, referenceDoc: e.target.value })}
                      placeholder="e.g. Legal Vetting Ref LGL/2026/021"
                    />
                  </label>
                  <div className="form-actions field-wide">
                    <button type="submit" className="btn" disabled={busy}>
                      {busy ? 'Saving…' : 'Save amendment'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setAmend(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="form-section-title" style={{ marginTop: 'var(--space-4)' }}>
                Amendment history
              </div>
              <DataGrid
                columns={HISTORY_COLUMNS}
                rows={history}
                emptyMessage="No amendments — this clause is at its original version."
              />
            </div>
          )}
        </>
      )}

      {tab === 'matrix' && lib && (
        <DataGrid columns={matrixColumns(lib.contractTypes)} rows={matrixRows} rowKey="id" emptyMessage="Matrix not seeded." />
      )}
    </section>
  );
}
