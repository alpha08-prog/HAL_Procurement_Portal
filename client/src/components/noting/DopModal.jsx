import { useState } from 'react';

const MOCK_DOP_ROWS = [
  { annexure: 'Annexure A', para: 'Para 1.2', goodsType: 'Goods', approvalType: 'Financial Approval', subCategory: 'General Stores', approxVal: '₹5,00,000', fca: 'FCA (Finance)', cfa: 'CFA (General Manager)' },
  { annexure: 'Annexure B', para: 'Para 3.4', goodsType: 'Services', approvalType: 'Technical Sanction', subCategory: 'Consultancy', approxVal: '₹12,00,000', fca: 'FCA (Finance)', cfa: 'CFA (Director)' }
];

export default function DopModal({ isOpen, onClose, onSave }) {
  const [selectedRow, setSelectedRow] = useState(0);

  if (!isOpen) return null;

  return (
    <div className="ef-modal-overlay" onClick={onClose}>
      <div className="ef-modal" style={{ maxWidth: 750 }} onClick={(e) => e.stopPropagation()}>
        <div className="ef-modal-header">
          <span>📜 Delegation of Powers (DOP) Matrix</span>
          <button type="button" className="ef-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ef-modal-body">
          <p className="screen-sub" style={{ marginBottom: 12 }}>
            Select the applicable DOP clause to automatically assign FCA (Financial Concurring Authority) and CFA (Competent Financial Authority).
          </p>

          <table className="ef-dop-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Annexure</th>
                <th>Para</th>
                <th>Goods/Services</th>
                <th>Approval Type</th>
                <th>Approx Value</th>
                <th>FCA</th>
                <th>CFA</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_DOP_ROWS.map((row, idx) => (
                <tr key={idx} style={{ background: selectedRow === idx ? 'var(--accent-soft)' : 'none' }}>
                  <td>
                    <input
                      type="radio"
                      name="dop_selection"
                      checked={selectedRow === idx}
                      onChange={() => setSelectedRow(idx)}
                    />
                  </td>
                  <td>{row.annexure}</td>
                  <td>{row.para}</td>
                  <td>{row.goodsType}</td>
                  <td>{row.approvalType}</td>
                  <td style={{ fontWeight: 600 }}>{row.approxVal}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{row.fca}</td>
                  <td style={{ color: '#1e7d43', fontWeight: 600 }}>{row.cfa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ef-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              onSave(MOCK_DOP_ROWS[selectedRow]);
              onClose();
            }}
          >
            Apply Selected DOP
          </button>
        </div>
      </div>
    </div>
  );
}
