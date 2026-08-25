import { useEffect, useState } from 'react';
import DataGrid from '../../components/DataGrid.jsx';
import { COMMITTEE_COLUMNS } from '../../config/approvalColumns.jsx';
import {
  createCommittee, fetchCommittee, fetchCommittees, fetchMeta, signCommitteeMember
} from '../../lib/approvalsApi.js';

// Some stages are decided by a panel, not a queue.
//
// Annexure 21A wants a members table — signature, designation, date — and since
// Amendment 1 of 29-01-2024, a conflict-of-interest declaration from every member. One
// missing declaration blocks the report, which is what makes this different from a chain:
// order does not matter, completeness does.
//
// The PNC composition is real: the sample note F5 names it. The TEC's is not in any
// source document, so the server refuses to generate one and asks for it by hand.
export default function Committees() {
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState(null);
  const [active, setActive] = useState(null);
  const [noteId, setNoteId] = useState('pnc_req');
  const [division, setDivision] = useState('DIV9');
  const [caseRef, setCaseRef] = useState('CAR/26/118');
  const [manual, setManual] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = () => fetchCommittees().then((d) => setRows(d.committees)).catch((e) => setError(e.message));

  useEffect(() => {
    fetchMeta().then(setMeta).catch(() => {});
    reload();
  }, []);

  const committeeNotes = (meta?.notes ?? []).filter((n) => n.mode === 'committee');

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const specs = manual.split('\n').map((s) => s.trim()).filter(Boolean);
      const d = await createCommittee({ noteId, division, caseRef, specs });
      setActive(d.committee);
      setManual('');
      reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const open = async (id) => {
    setError(null);
    try {
      const d = await fetchCommittee(id);
      setActive(d.committee);
    } catch (e) {
      setError(e.message);
    }
  };

  const sign = async (memberId, coiDeclared) => {
    setBusy(true);
    setError(null);
    try {
      const d = await signCommitteeMember(active.id, memberId, { coiDeclared, remark: '' });
      setActive(d.committee);
      reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="screen">
      <h1 className="screen-title">Committees — TEC &amp; PNC</h1>
      <p className="screen-sub">
        Stages decided by a panel. Every member signs and declares no conflict of interest
        with any bidder; until all of them have, the report cannot be raised.
      </p>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="form-section">
        <h2 className="form-section-title">Constitute a committee</h2>
        <div className="form-grid">
          <label className="field-label">
            Note
            <select className="field-input" value={noteId} onChange={(e) => setNoteId(e.target.value)}>
              {committeeNotes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </label>
          <label className="field-label">
            Unit
            <select className="field-input" value={division} onChange={(e) => setDivision(e.target.value)}>
              {(meta?.divisions ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="field-label">
            Requisition
            <input className="field-input" value={caseRef} onChange={(e) => setCaseRef(e.target.value)} />
          </label>
          <label className="field-label field-wide">
            Members, one per line (leave blank to use the composition named in the sample note)
            <textarea
              className="field-input"
              rows={4}
              value={manual}
              placeholder={'AGM(QA) - Chairman\nDGM(Plant Maint.) - Member\nCM(IMM) - Member Secretary'}
              onChange={(e) => setManual(e.target.value)}
            />
          </label>
        </div>
        <p className="field-hint">
          {noteId === 'tec_report'
            ? 'No document in sampleData states who sits on a TEC, so this one must be named by hand.'
            : 'The PNC composition comes from the sample note F5 — leave the box blank to use it.'}
        </p>
        <div className="form-actions">
          <button className="btn" onClick={create} disabled={busy}>Constitute</button>
        </div>
      </div>

      {active && (
        <>
          <h2 className="section-heading">
            {active.noteId} · {active.division}
            {' '}
            <span className={`pill ${active.complete ? 'pill-success' : 'pill-warning'}`}>
              {active.complete ? 'can be raised' : 'blocked'}
            </span>
          </h2>
          <p className="field-hint">Source: {active.source}</p>
          <div className="banner banner-info">
            Each member must sign this declaration: “{active.declaration}”
          </div>

          <div className="grid-wrap">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Member</th><th>Resolved to</th><th>Signed</th><th>Declared</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {active.members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.spec}
                      <div className="field-hint">{m.role}</div>
                    </td>
                    <td>
                      {m.person
                        ? <>{m.person.name}<div className="field-hint">{m.person.grade}</div></>
                        : <span className="pill pill-warning">unresolved</span>}
                      {m.caveats?.map((c) => <div className="field-hint" key={c}>⚠ {c}</div>)}
                    </td>
                    <td>
                      <span className={`pill ${m.signed ? 'pill-success' : 'pill-neutral'}`}>
                        {m.signed ? m.date : 'no'}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${m.coiDeclared ? 'pill-success' : 'pill-danger'}`}>
                        {m.coiDeclared ? 'no conflict' : 'not declared'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-inline" disabled={busy} onClick={() => sign(m.id, true)}>
                        Sign &amp; declare
                      </button>
                      <button className="btn btn-inline btn-secondary" disabled={busy} onClick={() => sign(m.id, false)}>
                        Sign without declaring
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!active.complete && (
            <div className="banner banner-restricted">
              Cannot raise the report:
              <ul>{active.blockedBy.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
        </>
      )}

      <h2 className="section-heading">All committees</h2>
      <DataGrid
        columns={COMMITTEE_COLUMNS}
        rows={rows}
        emptyMessage="No committees constituted yet."
      />
      {rows?.length > 0 && (
        <p className="field-hint">
          {rows.map((r) => (
            <button key={r.id} className="link-btn" onClick={() => open(r.id)}>
              open #{r.id}
            </button>
          ))}
        </p>
      )}
    </section>
  );
}
