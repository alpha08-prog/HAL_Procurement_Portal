import { useEffect, useMemo, useState } from 'react';
import DataGrid from '../../components/DataGrid.jsx';
import { DIRECTORY_COLUMNS } from '../../config/approvalColumns.jsx';
import { fetchDirectory, fetchHead, fetchMeta } from '../../lib/approvalsApi.js';

// The personnel directory the approval chain resolves approvers against — and, more
// usefully, the "who heads this unit?" lookup, which is where the source data runs out.
//
// The HR extract has no head-of-unit column. Where several officers share the top grade
// in a unit, the answer genuinely is not in the data, and this screen says so instead of
// picking one.
export default function Directory() {
  const [meta, setMeta] = useState(null);
  const [data, setData] = useState(null);
  const [division, setDivision] = useState('');
  const [dept, setDept] = useState('');
  const [q, setQ] = useState('');
  const [head, setHead] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMeta().then(setMeta).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    let dead = false;
    fetchDirectory({ division, dept, q })
      .then((d) => !dead && setData(d))
      .catch((e) => !dead && setError(e.message));
    return () => { dead = true; };
  }, [division, dept, q]);

  useEffect(() => {
    if (!division) { setHead(null); return; }
    let dead = false;
    fetchHead(division, dept || undefined)
      .then((h) => !dead && setHead(h))
      .catch(() => !dead && setHead(null));
    return () => { dead = true; };
  }, [division, dept]);

  const depts = useMemo(() => meta?.unitTree?.[division] ?? [], [meta, division]);
  const s = data?.summary;

  return (
    <section className="screen">
      <h1 className="screen-title">Personnel Directory</h1>
      <p className="screen-sub">
        Who exists, at what grade, and in which unit. Authority in the approval chain comes
        from grade: 4 Manager → 6 Chief Manager → 7 DGM → 8 AGM → 9 GM → 10 ED.
      </p>

      {error && <div className="banner banner-error">{error}</div>}

      {s && (
        <div className="metric-cards">
          <div className="metric-card">
            <div className="metric-value">{s.people}</div>
            <div className="metric-label">officers</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{s.units}</div>
            <div className="metric-label">units</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{s.deptsCanonical}</div>
            <div className="metric-label">departments <span className="field-hint">({s.deptsRaw} raw spellings)</span></div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{s.ambiguousHeads}</div>
            <div className="metric-label">of {s.unitDeptPairs} units with no identifiable head</div>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <label className="field-label">
          Unit
          <select className="field-input" value={division} onChange={(e) => { setDivision(e.target.value); setDept(''); }}>
            <option value="">All</option>
            {(meta?.divisions ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="field-label">
          Department
          <select className="field-input" value={dept} onChange={(e) => setDept(e.target.value)} disabled={!division}>
            <option value="">All</option>
            {depts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="field-label filter-search">
          Search
          <input
            className="field-input"
            value={q}
            placeholder="name, PB no, department, grade"
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      {head && (
        <>
          <h2 className="section-heading">Who heads {head.unit}?</h2>
          {head.ambiguous ? (
            <div className="banner banner-restricted">
              <strong>Not answerable from the data.</strong> {head.note}
              <ul>
                {head.candidates.map((c) => (
                  <li key={c.pb}>{c.name} — {c.grade} — PB {c.pb}</li>
                ))}
              </ul>
            </div>
          ) : head.person ? (
            <div className="banner banner-success">
              {head.person.name} — {head.person.grade} — {head.person.deptRaw} — PB {head.person.pb}
            </div>
          ) : (
            <div className="banner banner-info">Nobody found in this unit.</div>
          )}
        </>
      )}

      <h2 className="section-heading">
        Officers {data ? `(${data.total}${data.truncated ? ', showing first 500' : ''})` : ''}
      </h2>
      <DataGrid
        columns={DIRECTORY_COLUMNS}
        rows={data?.people ?? null}
        rowKey="pb"
        emptyMessage="No officers match that filter."
      />

      {meta?.limits && (
        <p className="screen-note">{meta.limits.headOfUnit}</p>
      )}
    </section>
  );
}
