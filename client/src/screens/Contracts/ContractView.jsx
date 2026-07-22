import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ContractDocument from '../../components/contracts/ContractDocument.jsx';
import { CONTRACT_CLASSIFICATIONS, ContractClassificationBadge, ContractStatusBadge } from '../../config/contractColumns.jsx';
import {
  fetchClausePlan, fetchContract, fetchFormats, finaliseContract, patchContract, verifyContract
} from '../../lib/contractsApi.js';

// One contract: the printable document plus a .no-print action rail. Draft → edit
// selections / finalise; finalised → verify integrity + print. The document itself is
// isolated in .note-print-area so window.print() yields the HAL contract alone.
export default function ContractView() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [verify, setVerify] = useState(null);
  const [edit, setEdit] = useState(null); // draft edit form state | null
  const [plan, setPlan] = useState(null);
  const [allFormats, setAllFormats] = useState([]);

  const load = () =>
    fetchContract(id)
      .then((d) => {
        setDoc(d);
        setVerify(null);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    setDoc(null);
    load();
  }, [id]);

  const c = doc?.contract;

  const openEdit = async () => {
    try {
      const [p, f] = await Promise.all([fetchClausePlan(c.contract_type_id), fetchFormats()]);
      setPlan(p);
      setAllFormats(f.formats);
      setEdit({
        classification: c.classification,
        description: c.description || '',
        validity: c.validity || '',
        periodFrom: c.period_from || '',
        periodTo: c.period_to || '',
        smartContract: !!c.smart_contract,
        extras: new Set(doc.clauses.filter((x) => x.source === 'extra').map((x) => x.clause_id)),
        customs: doc.clauses.filter((x) => x.source === 'custom').map((x) => ({ title: x.title, body: x.body })),
        formats: new Set(doc.formats.map((x) => x.format_id))
      });
    } catch (e) {
      setError(e.message);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await patchContract(c.id, {
        classification: edit.classification,
        description: edit.description,
        validity: edit.validity,
        periodFrom: edit.periodFrom || null,
        periodTo: edit.periodTo || null,
        smartContract: edit.smartContract,
        extraClauseIds: [...edit.extras],
        customClauses: edit.customs,
        formatIds: [...edit.formats]
      });
      setDoc(d);
      setEdit(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const doFinalise = async () => {
    if (!window.confirm('Finalise this contract? It locks the content, computes the SHA-256 integrity hash and stamps the QR with your credentials. This cannot be undone.')) return;
    setBusy(true);
    setError(null);
    try {
      setDoc(await finaliseContract(c.id));
      setEdit(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const doVerify = async () => {
    try {
      setVerify(await verifyContract(c.id));
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleSet = (key, value) =>
    setEdit((f) => {
      const next = new Set(f[key]);
      next.has(value) ? next.delete(value) : next.add(value);
      return { ...f, [key]: next };
    });

  if (error && !doc) return <section className="screen"><div className="banner banner-error">{error}</div></section>;
  if (!doc) return <section className="screen"><div className="grid-empty">Loading…</div></section>;

  const sim = c.smart_contract_sim;

  return (
    <section className="screen">
      <div className="no-print">
        <div className="pa-doc-toolbar">
          <h1 className="screen-title" style={{ margin: 0 }}>
            {c.contract_no} <ContractStatusBadge value={c.status} /> <ContractClassificationBadge value={c.classification} />
          </h1>
          <div className="pill-row">
            {c.status === 'draft' && (
              <>
                <button type="button" className="btn btn-secondary" onClick={edit ? () => setEdit(null) : openEdit}>
                  {edit ? 'Close editor' : 'Edit selections'}
                </button>
                <button type="button" className="btn" onClick={doFinalise} disabled={busy}>
                  Finalise & stamp
                </button>
              </>
            )}
            {c.status === 'finalised' && (
              <button type="button" className="btn btn-secondary" onClick={doVerify}>
                Verify integrity
              </button>
            )}
            <button type="button" className="btn" onClick={() => window.print()}>
              Download PDF
            </button>
          </div>
        </div>

        {error && <div className="banner banner-error">{error}</div>}
        {verify && (
          <div className={'banner ' + (verify.match ? 'banner-success' : 'banner-error')}>
            {verify.match
              ? `Integrity verified — the stored content matches SHA-256 ${verify.storedHash.slice(0, 20)}…`
              : 'INTEGRITY FAILURE — the stored content no longer matches its finalisation hash.'}
          </div>
        )}
        {sim && (
          <div className="banner banner-restricted">
            ⛓ Smart-contract anchor (<strong>{sim.network}</strong> — this is a demo simulation, not a real
            blockchain): block #{sim.block}, tx {sim.txHash.slice(0, 24)}…, anchored {sim.anchoredAt?.slice(0, 19).replace('T', ' ')} UTC.
          </div>
        )}

        {edit && (
          <form onSubmit={saveEdit} className="form-section">
            <div className="form-section-title">Edit draft selections</div>
            <div className="form-grid">
              <label>
                <span className="field-label">Classification</span>
                <select className="field-input" value={edit.classification} onChange={(e) => setEdit({ ...edit, classification: e.target.value })}>
                  {CONTRACT_CLASSIFICATIONS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </label>
              <label className="field-wide">
                <span className="field-label">Description</span>
                <input className="field-input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              </label>
              <label>
                <span className="field-label">Period from</span>
                <input className="field-input" type="date" value={edit.periodFrom} onChange={(e) => setEdit({ ...edit, periodFrom: e.target.value })} />
              </label>
              <label>
                <span className="field-label">Period to</span>
                <input className="field-input" type="date" value={edit.periodTo} onChange={(e) => setEdit({ ...edit, periodTo: e.target.value })} />
              </label>
              <label className="field-wide">
                <span className="field-label">Validity</span>
                <input className="field-input" value={edit.validity} onChange={(e) => setEdit({ ...edit, validity: e.target.value })} />
              </label>
              <label className="field-wide clause-tick">
                <input type="checkbox" checked={edit.smartContract} onChange={(e) => setEdit({ ...edit, smartContract: e.target.checked })} />
                <span>Encrypt for Smart Contract — anchor the finalised hash to a <em>simulated</em> blockchain (demo)</span>
              </label>
            </div>

            {plan && (
              <>
                <div className="form-section-title">Extra standard clauses</div>
                <div className="clause-plan">
                  <div className="clause-group">
                    {[...plan.offered, ...plan.excluded].map((x) => (
                      <label key={x.clauseId} className="clause-tick">
                        <input type="checkbox" checked={edit.extras.has(x.clauseId)} onChange={() => toggleSet('extras', x.clauseId)} />
                        <span>
                          <strong>{x.clauseNo != null ? `${x.clauseNo}. ` : ''}{x.title}</strong>
                          {x.matrixValue && <em className="clause-cond"> — {x.matrixValue}</em>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="form-section-title">Additional clauses</div>
            {edit.customs.map((x, i) => (
              <div className="form-grid custom-clause-row" key={i}>
                <label>
                  <span className="field-label">Clause title</span>
                  <input className="field-input" value={x.title} onChange={(e) => setEdit({ ...edit, customs: edit.customs.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)) })} />
                </label>
                <label className="field-wide">
                  <span className="field-label">Clause text</span>
                  <textarea className="field-input" rows={3} value={x.body} onChange={(e) => setEdit({ ...edit, customs: edit.customs.map((y, j) => (j === i ? { ...y, body: e.target.value } : y)) })} />
                </label>
                <div>
                  <button type="button" className="btn btn-secondary btn-inline" onClick={() => setEdit({ ...edit, customs: edit.customs.filter((_, j) => j !== i) })}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-inline" onClick={() => setEdit({ ...edit, customs: [...edit.customs, { title: '', body: '' }] })}>
              + Add additional clause
            </button>

            <div className="form-section-title" style={{ marginTop: 'var(--space-4)' }}>Annexed proformas</div>
            <div className="format-picks">
              {allFormats.map((f) => (
                <label key={f.id} className="clause-tick">
                  <input type="checkbox" checked={edit.formats.has(f.id)} onChange={() => toggleSet('formats', f.id)} />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        )}
      </div>

      <div className="note-print-area">
        <ContractDocument doc={doc} />
      </div>
    </section>
  );
}
