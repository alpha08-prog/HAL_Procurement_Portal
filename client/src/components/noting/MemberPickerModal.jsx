import { useState } from 'react';

export default function MemberPickerModal({ isOpen, onClose, members, onSelect, title = 'Select Member' }) {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = members.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.designation || '').toLowerCase().includes(q) ||
      (m.pb || '').toLowerCase().includes(q) ||
      (m.unit_path || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="ef-modal-overlay" onClick={onClose}>
      <div className="ef-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ef-modal-header">
          <span>👥 {title}</span>
          <button type="button" className="ef-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ef-modal-body">
          <input
            className="ef-search-input"
            style={{ width: '100%', marginBottom: 12 }}
            placeholder="Search by name, designation, PB no, department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div className="grid-empty">No members match your search.</div>
            ) : (
              <table className="ef-routing-table">
                <thead>
                  <tr>
                    <th>PB No</th>
                    <th>Name</th>
                    <th>Designation</th>
                    <th>Department / Unit</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.pb}</td>
                      <td>{m.name}</td>
                      <td style={{ color: 'var(--muted)' }}>{m.designation}</td>
                      <td style={{ fontSize: 11 }}>{m.unit_path || m.unit || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '3px 10px', fontSize: 11 }}
                          onClick={() => {
                            onSelect(m);
                            onClose();
                          }}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="ef-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
