import { useEffect, useState } from 'react';
import { fetchDop } from '../../lib/toolsApi.js';

// DoP-2025 lookup (Portal Hub PRV-11). Everything comes from /api/formats/dop, which serves
// ai/dop2025.json: the clause map, the value bands (empty until HAL supplies Annexure-3) and
// the illustrative picker rows, each flagged verified:false. Nothing here is hard-coded.
export default function DopLookup() {
  const [dop, setDop] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDop()
      .then(setDop)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="banner banner-error">Could not load the DoP table: {error}</div>;
  if (!dop) return <div className="grid-empty">Loading…</div>;

  const pending = dop._status !== 'ok' || !dop.bands?.length;
  return (
    <div className="doc-section">
      <div className="doc-banner">
        <strong>DOP-2025 — DELEGATION OF POWERS LOOKUP</strong>
        <span>ai/dop2025.json · status: {dop._status}</span>
      </div>
      {pending && (
        <div className="banner banner-restricted" style={{ marginBottom: 12 }}>
          <strong>Value bands pending from HAL.</strong> DOP-2025 Annexure-3 is not in the sample data, so the portal never derives a CFA level from a
          value: the level is taken from the indentor checklist. The rows below are illustrative and unverified.
        </div>
      )}

      <h4 className="fmt-list-title">Clauses the AI pipeline can derive (from the number of valid offers)</h4>
      <table className="portal-mini-table">
        <thead>
          <tr>
            <th>Clause</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {(dop.clauses || []).map((c) => (
            <tr key={c.clause}>
              <td>{c.clause}</td>
              <td>{c.when}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="fmt-list-title">Level → designation</h4>
      <table className="portal-mini-table">
        <tbody>
          {Object.entries(dop.levelDesig || {}).map(([lvl, d]) => (
            <tr key={lvl}>
              <td>{lvl}</td>
              <td>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="fmt-list-title">Value bands</h4>
      {dop.bands?.length ? (
        <table className="portal-mini-table">
          <thead>
            <tr>
              <th>Min (₹)</th>
              <th>Max (₹)</th>
              <th>Tender type</th>
              <th>Level</th>
              <th>CFA</th>
            </tr>
          </thead>
          <tbody>
            {dop.bands.map((b, i) => (
              <tr key={i}>
                <td>{b.min ?? '—'}</td>
                <td>{b.max ?? 'no ceiling'}</td>
                <td>{b.tenderType ?? 'any'}</td>
                <td>{b.level}</td>
                <td>{b.cfa ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="fmt-note">No value bands on file. Expected shape: {JSON.stringify(dop.bandsShape)}</p>
      )}

      <h4 className="fmt-list-title">Illustrative picker rows (unverified)</h4>
      <table className="portal-mini-table">
        <thead>
          <tr>
            <th>Annexure</th>
            <th>Para</th>
            <th>Scope</th>
            <th>Approval band</th>
            <th>FCA</th>
            <th>CFA</th>
            <th>Verified</th>
          </tr>
        </thead>
        <tbody>
          {(dop.rows || []).map((r, i) => (
            <tr key={i}>
              <td>{r.annexure}</td>
              <td>{r.para}</td>
              <td>
                <div style={{ fontWeight: 600 }}>{r.goodsType}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.subCategory}</div>
              </td>
              <td>{r.approxVal}</td>
              <td>{r.fca}</td>
              <td>{r.cfa}</td>
              <td>
                <span className={`tag ${r.verified ? 'tag-fmt-verified' : 'tag-fmt-pending'}`}>{r.verified ? 'verified' : 'pending'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="field-hint">{dop._note}</p>
    </div>
  );
}
