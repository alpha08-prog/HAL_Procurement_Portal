import { useState, useMemo } from 'react';

const HAL_DOP_2025_MATRIX = [
  {
    annexure: 'Annexure 3(B)(1)',
    para: 'Para 1.1',
    goodsType: 'Goods / Consumables',
    approvalType: 'Purchase Concurrence & Sanction',
    subCategory: 'General Stores & Consumables (< ₹5 Lakhs)',
    approxVal: '₹5,00,000',
    fca: 'FCA (Finance)',
    cfa: 'CFA: HOD (IMM)'
  },
  {
    annexure: 'Annexure 3(B)(2)',
    para: 'Para 1.2',
    goodsType: 'Goods / Stores',
    approvalType: 'Purchase Proposal Approval (DPC)',
    subCategory: 'Spares & Production Materials (₹5L – ₹25L)',
    approxVal: '₹25,00,000',
    fca: 'FCA (Finance / IMM-OH)',
    cfa: 'CFA: AGM (IMM-OH)'
  },
  {
    annexure: 'Annexure 3(A)(1)',
    para: 'Para 2.1',
    goodsType: 'Capital Goods',
    approvalType: 'Plant & Machinery / Tools Sanction',
    subCategory: 'High Value Machinery / Tools (₹25L – ₹1 Cr)',
    approxVal: '₹1,00,00,000',
    fca: 'FCA (Finance / GM-Fin)',
    cfa: 'CFA: GM (AOD)'
  },
  {
    annexure: 'Annexure 3(A)(2)',
    para: 'Para 2.2',
    goodsType: 'Proprietary Spares',
    approvalType: 'Single Tender Sanction (PAC / Proprietary)',
    subCategory: 'OEM / Proprietary Overhaul Spares (> ₹10L)',
    approxVal: '₹50,00,000',
    fca: 'FCA (Finance / IMM)',
    cfa: 'CFA: GM (AOD)'
  },
  {
    annexure: 'Annexure 3(C)(1)',
    para: 'Para 3.1',
    goodsType: 'Services / AMC',
    approvalType: 'Service Contract Sanction',
    subCategory: 'Maintenance / Equipment AMC / Calibrations (< ₹10L)',
    approxVal: '₹10,00,000',
    fca: 'FCA (Finance)',
    cfa: 'CFA: DGM (IMM / Maint)'
  },
  {
    annexure: 'Annexure 3(C)(2)',
    para: 'Para 3.2',
    goodsType: 'Turnkey Overhaul / IT',
    approvalType: 'Major Technical Sanction & Consultancy',
    subCategory: 'Turnkey Services / Software Licences (> ₹50L)',
    approxVal: '₹75,00,000',
    fca: 'FCA (Finance / Dir-Fin)',
    cfa: 'CFA: Executive Director / Director'
  },
  {
    annexure: 'Annexure 1(A)',
    para: 'Para 4.1',
    goodsType: 'Emergency / Fast-Track',
    approvalType: 'Operational Sanction (AOG / Aircraft On Ground)',
    subCategory: 'Urgent Overhaul Aircraft Spares & Services',
    approxVal: '₹20,00,000',
    fca: 'FCA (Finance)',
    cfa: 'CFA: General Manager (AOD)'
  },
  {
    annexure: 'Annexure 2(B)',
    para: 'Para 5.1',
    goodsType: 'Rate Contract',
    approvalType: 'Annual Rate Contract Finalisation',
    subCategory: 'Standard Consumables / Fasteners / Hardware',
    approxVal: '₹1,50,00,000',
    fca: 'FCA (Corporate Finance)',
    cfa: 'CFA: Executive Director (IMM)'
  }
];

export default function DopModal({ isOpen, onClose, onSave }) {
  const [selectedRow, setSelectedRow] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredRows = useMemo(() => {
    return HAL_DOP_2025_MATRIX.filter((row) => {
      if (categoryFilter === 'goods' && !row.goodsType.toLowerCase().includes('goods') && !row.goodsType.toLowerCase().includes('spares')) return false;
      if (categoryFilter === 'services' && !row.goodsType.toLowerCase().includes('service') && !row.goodsType.toLowerCase().includes('turnkey')) return false;
      if (categoryFilter === 'emergency' && !row.goodsType.toLowerCase().includes('emergency')) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          row.annexure.toLowerCase().includes(q) ||
          row.para.toLowerCase().includes(q) ||
          row.goodsType.toLowerCase().includes(q) ||
          row.approvalType.toLowerCase().includes(q) ||
          row.subCategory.toLowerCase().includes(q) ||
          row.approxVal.toLowerCase().includes(q) ||
          row.fca.toLowerCase().includes(q) ||
          row.cfa.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [search, categoryFilter]);

  if (!isOpen) return null;

  const currentSelected = filteredRows[selectedRow] || filteredRows[0] || HAL_DOP_2025_MATRIX[0];

  return (
    <div className="ef-modal-overlay" onClick={onClose}>
      <div className="ef-modal" style={{ maxWidth: 880 }} onClick={(e) => e.stopPropagation()}>
        <div className="ef-modal-header">
          <span>📜 Delegation of Powers (DOP-2025) Matrix</span>
          <button type="button" className="ef-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ef-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="screen-sub" style={{ margin: 0 }}>
            Select the applicable HAL DOP-2025 clause to automatically assign FCA (Financial Concurring Authority) and CFA (Competent Financial Authority).
          </p>

          {/* Filter and Search Bar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'all', label: 'All Clauses' },
                { id: 'goods', label: '📦 Goods & Spares' },
                { id: 'services', label: '🛠️ Services & Turnkey' },
                { id: 'emergency', label: '⚡ Emergency (AOG)' }
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

            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <input
                className="ef-search-input"
                style={{ width: '100%', fontSize: 12, paddingLeft: 26 }}
                placeholder="🔍 Search clause by Annexure, Category, Value, CFA..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedRow(0);
                }}
              />
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none', fontSize: 12 }}>
                🔍
              </span>
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
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                      No DOP clauses match your search "{search}".
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr
                      key={idx}
                      onClick={() => setSelectedRow(idx)}
                      style={{
                        background: selectedRow === idx ? 'var(--accent-soft)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <td>
                        <input
                          type="radio"
                          name="dop_selection"
                          checked={selectedRow === idx}
                          onChange={() => setSelectedRow(idx)}
                        />
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

