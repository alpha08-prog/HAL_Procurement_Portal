import { useEffect, useMemo, useState } from 'react';
import { fetchDop } from '../../lib/toolsApi.js';

// DoP picker on the noting Initiate screen. Rows come from /api/formats/dop (ai/dop2025.json);
// the value bands are pending from HAL, so every row is flagged unverified and the banner says
// so. The chosen row is stored on the note as a DoP reference — nothing is derived from it.
export default function DopModal({ isOpen, onClose, onSave }) {
  const [dop, setDop] = useState(null);
  const [error, setError] = useState(null);
  const [selectedRow, setSelectedRow] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    if (!isOpen || dop) return;
    fetchDop()
      .then(setDop)
      .catch((e) => setError(e.message));
  }, [isOpen, dop]);

  const rows = dop?.rows ?? [];
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const g = row.goodsType.toLowerCase();
      if (categoryFilter === 'goods' && !g.includes('goods') && !g.includes('spares')) return false;
      if (categoryFilter === 'services' && !g.includes('service') && !g.includes('turnkey')) return false;
      if (categoryFilter === 'emergency' && !g.includes('emergency')) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return [row.annexure, row.para, row.goodsType, row.approvalType, row.subCategory, row.approxVal, row.fca, row.cfa].some((v) =>
          String(v).toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, search, categoryFilter]);

  if (!isOpen) return null;

  const currentSelected = filteredRows[selectedRow] || filteredRows[0] || null;
  const pending = !dop || dop._status !== 'ok' || !dop.bands?.length;

  return (
    <div className="ef-modal-overlay" onClick={onClose}>
      <div className="ef-modal" style={{ maxWidth: 880 }} onClick={(e) => e.stopPropagation()}>
        <div className="ef-modal-header">
          <span>Delegation of Powers (DOP-2025) Matrix</span>
          <button type="button" className="ef-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ef-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="screen-sub" style={{ margin: 0 }}>
            Select the applicable HAL DOP-2025 clause to record the FCA (Financial Concurring Authority) and CFA (Competent Financial Authority) on the note.
          </p>
          {pending && (
            <div className="banner banner-restricted" style={{ margin: 0 }}>
              <strong>Value bands pending from HAL</strong> — the rows below are illustrative (ai/dop2025.json, every row verified:false). The CFA level on the note comes from the indentor checklist, never from this table.
            </div>
          )}
          {error && <div className="banner banner-error" style={{ margin: 0 }}>Could not load the DoP table: {error}</div>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'all', label: 'All Clauses' },
                { id: 'goods', label: 'Goods & Spares' },
                { id: 'services', label: 'Services & Turnkey' },
                { id: 'emergency', label: 'Emergency (AOG)' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`btn btn-inline ${categoryFilter === tab.id ? '' : 'btn-secondary'}`}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => {
                    setCategoryFilter(tab.id);
                    setSelectedRow(0);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                className="ef-search-input"
                style={{ width: '100%', fontSize: 12, paddingLeft: 12 }}
                placeholder="Search clause by Annexure, Category, Value, CFA..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedRow(0);
                }}
              />
            </div>
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table className="ef-dop-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Select</th>
                  <th>Annexure</th>
                  <th>Para</th>
                  <th>Classification / Scope</th>
                  <th>Approval Band</th>
                  <th>FCA Authority</th>
                  <th>CFA Authority</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {!dop ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Loading…</td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                      No DOP clauses match your search "{search}".
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr
                      key={`${row.annexure}-${row.para}`}
                      onClick={() => setSelectedRow(idx)}
                      style={{ background: selectedRow === idx ? 'var(--accent-soft)' : 'none', cursor: 'pointer' }}
                    >
                      <td>
                        <input type="radio" name="dop_selection" checked={selectedRow === idx} onChange={() => setSelectedRow(idx)} />
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{row.annexure}</td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>{row.para}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{row.goodsType}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{row.subCategory}</div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{row.approxVal}</td>
                      <td style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>{row.fca}</td>
                      <td style={{ color: '#1e7d43', fontWeight: 600, fontSize: 12 }}>{row.cfa}</td>
                      <td>
                        <span className={`tag ${row.verified ? 'tag-fmt-verified' : 'tag-fmt-pending'}`}>{row.verified ? 'verified' : 'pending'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {currentSelected && (
            <div style={{ background: 'var(--bg)', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 12 }}>
              <strong>Selected: </strong>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{currentSelected.annexure}</span> ({currentSelected.para}) —{' '}
              <span>{currentSelected.subCategory}</span> | Band: <strong>{currentSelected.approxVal}</strong> |{' '}
              FCA: <span style={{ color: 'var(--accent)' }}>{currentSelected.fca}</span> |{' '}
              CFA: <span style={{ color: '#1e7d43', fontWeight: 700 }}>{currentSelected.cfa}</span>
            </div>
          )}
        </div>
        <div className="ef-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn"
            disabled={!currentSelected}
            onClick={() => {
              onSave(currentSelected);
              onClose();
            }}
          >
            Apply Selected DOP Clause
          </button>
        </div>
      </div>
    </div>
  );
}
