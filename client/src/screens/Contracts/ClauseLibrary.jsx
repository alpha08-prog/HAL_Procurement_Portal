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
  const [copied, setCopied] = useState(false);

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
    setCopied(false);
    fetchClauseHistory(clause.id)
      .then((d) => setHistory(d.versions))
      .catch(() => setHistory([]));
  };

  const close = () => {
    setSelected(null);
    setAmend(null);
    setHistory(null);
    setCopied(false);
  };

  const copyClauseText = () => {
    if (!selected?.body) return;
    navigator.clipboard.writeText(selected.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          Clauses ({lib?.clauses?.length || 72})
        </button>
        <button type="button" className={'btn' + (tab === 'matrix' ? '' : ' btn-secondary')} onClick={() => setTab('matrix')}>
          Matrix ({matrixRows?.length || 71})
        </button>
      </div>

      {tab === 'clauses' && (
        <>
          {!isAdmin && (
            <div className="banner banner-restricted">
              🔒 Standard clauses are amended only by an authorised admin after legal vetting.
              You have read-only access. Click any clause to view its details.
            </div>
          )}
          <DataGrid columns={libraryColumns(open)} rows={lib?.clauses} emptyMessage="Library not seeded." />
        </>
      )}

      {tab === 'matrix' && lib && (
        <DataGrid
          columns={matrixColumns(lib.contractTypes, open)}
          rows={matrixRows}
          rowKey="id"
          emptyMessage="Matrix not seeded."
        />
      )}

      {/* Small Popup Window / Modal for Clause Details & Actions */}
      {selected && (
        <div className="modal-overlay" onClick={close}>
          <div
            className="modal"
            style={{
              maxWidth: 820,
              width: '94%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.35)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                background: 'linear-gradient(135deg, #0e4474, #0b3d6b)',
                color: '#fff',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.01em' }}>
                  Clause {selected.matrix_no ?? '—'} · {selected.title}
                </span>
                <span className="tag" style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}>
                  v{selected.version}
                </span>
                {selected.boilerplate ? (
                  <span className="tag" style={{ background: '#ffd27a', color: '#082c4e' }}>
                    Boilerplate
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: 20,
                  cursor: 'pointer',
                  padding: '2px 8px',
                  opacity: 0.85
                }}
                onClick={close}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div
              className="modal-body"
              style={{
                padding: '20px',
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}
            >
              {selected.guideline && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'var(--accent-soft)',
                    border: '1px solid #c9d9eb',
                    borderRadius: 'var(--radius)',
                    fontSize: 12,
                    color: 'var(--accent)'
                  }}
                >
                  <strong>Guideline / Circular Reference:</strong> {selected.guideline}
                </div>
              )}

              {/* Clause Body View */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="field-label" style={{ margin: 0, fontWeight: 700, fontSize: 12 }}>
                    Clause Content &amp; Standard Verbiage
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-inline"
                      onClick={copyClauseText}
                    >
                      {copied ? '✓ Copied!' : '📋 Copy Text'}
                    </button>
                    {isAdmin && !amend && (
                      <button
                        type="button"
                        className="btn btn-inline"
                        onClick={() => setAmend({ body: selected.body, changeNote: '', referenceDoc: '' })}
                      >
                        ✏️ Amend Clause
                      </button>
                    )}
                  </div>
                </div>
                <pre
                  className="clause-body"
                  style={{
                    maxHeight: 280,
                    margin: 0,
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    background: '#f8fafc',
                    border: '1px solid var(--border)'
                  }}
                >
                  {selected.body}
                </pre>
              </div>

              {/* In-window Amendment Form */}
              {amend && (
                <form
                  onSubmit={submitAmend}
                  style={{
                    background: '#fff8f0',
                    border: '1px solid #fed7aa',
                    borderRadius: 'var(--radius)',
                    padding: 16
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#c2410c',
                      marginBottom: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <span>✏️</span> Amend Standard Clause (Admin Action)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label>
                      <span className="field-label">
                        Amended Clause Text <span className="req">*</span>
                      </span>
                      <textarea
                        className="field-input"
                        rows={8}
                        value={amend.body}
                        onChange={(e) => setAmend({ ...amend, body: e.target.value })}
                        required
                      />
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <label>
                        <span className="field-label">
                          Change Note <span className="req">*</span>
                        </span>
                        <input
                          className="field-input"
                          value={amend.changeNote}
                          onChange={(e) => setAmend({ ...amend, changeNote: e.target.value })}
                          placeholder="What changed and why"
                          required
                        />
                      </label>
                      <label>
                        <span className="field-label">
                          Reference Doc for Change <span className="req">*</span>
                        </span>
                        <input
                          className="field-input"
                          value={amend.referenceDoc}
                          onChange={(e) => setAmend({ ...amend, referenceDoc: e.target.value })}
                          placeholder="e.g. Legal Vetting Ref LGL/2026/021"
                          required
                        />
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        type="submit"
                        className="btn"
                        disabled={busy || !amend.body.trim() || !amend.changeNote.trim() || !amend.referenceDoc.trim()}
                      >
                        {busy ? 'Saving…' : 'Save Amendment'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setAmend(null)}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* In-window Amendment History */}
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--muted)',
                    marginBottom: 8
                  }}
                >
                  Superseded Versions &amp; Audit Trail {history && `(${history.length})`}
                </div>
                <DataGrid
                  columns={HISTORY_COLUMNS}
                  rows={history}
                  emptyMessage="No amendments — this clause is at its original version."
                  pageSize={5}
                  showPageSizeSelect={false}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '12px 20px',
                background: '#f8fafc',
                borderTop: '1px solid var(--border)',
                flexShrink: 0
              }}
            >
              <button type="button" className="btn btn-secondary" onClick={close}>
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
