import { useState, useMemo } from 'react';

export default function StampingModal({ isOpen, onClose, members = [], onConfirm }) {
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [file, setFile] = useState(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const safeMembers = useMemo(() => {
    return Array.isArray(members) ? members.filter(Boolean) : [];
  }, [members]);

  const departments = useMemo(() => {
    const set = new Set();
    for (const m of safeMembers) {
      const u = m.unit_path || m.unit || m.department;
      if (u) set.add(u);
    }
    return Array.from(set).sort();
  }, [safeMembers]);

  const filteredMembers = useMemo(() => {
    return safeMembers.filter((m) => {
      if (deptFilter && (m.unit_path || m.unit || m.department) !== deptFilter) {
        return false;
      }
      const q = (appliedSearch || search).trim().toLowerCase();
      if (!q) return true;
      return (
        (m.name || '').toLowerCase().includes(q) ||
        (m.designation || '').toLowerCase().includes(q) ||
        (m.pb || '').toLowerCase().includes(q) ||
        (m.unit_path || m.unit || '').toLowerCase().includes(q)
      );
    });
  }, [safeMembers, appliedSearch, search, deptFilter]);

  if (!isOpen) return null;

  const toggleMember = (id) => {
    setSelectedMembers((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault?.();
    setAppliedSearch(search);
  };

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setDeptFilter('');
  };

  return (
    <div className="ef-modal-overlay" onClick={onClose}>
      <div className="ef-modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="ef-modal-header">
          <span>Document Stamping Authority Setup</span>
          <button type="button" className="ef-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ef-modal-body">
          {/* File Upload Box */}
          <div style={{ marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <label className="field-label" style={{ fontWeight: 600 }}>
              Upload Document for Stamping (PDF only) <span className="req">*</span>
            </label>
            <input
              type="file"
              accept=".pdf"
              className="field-input"
              style={{ width: '100%', marginTop: 4 }}
              onChange={(e) => setFile(e.target.files[0])}
            />
            {file && (
              <div style={{ fontSize: 11, color: '#1e7d43', marginTop: 4, fontWeight: 600 }}>
                ✓ Selected file: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>

          {/* Search and Filters Bar */}
          <div style={{ marginBottom: 12 }}>
            <label className="field-label" style={{ fontWeight: 600 }}>
              Select Stamping Authorities (Officers whose digital stamp will be applied):
            </label>

            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <input
                className="field-input"
                style={{ flex: 1, minWidth: 200 }}
                placeholder="Search officer by Name, PB No, Designation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="field-input"
                style={{ width: 180, fontSize: 12 }}
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="">All Departments ({departments.length})</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button type="submit" className="btn btn-inline" style={{ padding: '6px 14px' }}>
                Search
              </button>
              {(search || appliedSearch || deptFilter) && (
                <button type="button" className="btn btn-secondary btn-inline" onClick={handleClear}>
                  Clear
                </button>
              )}
            </form>
          </div>

          {/* Stamping Authority Selection List */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
            <span>Showing <strong>{filteredMembers.length}</strong> matching officers</span>
            <span><strong>{selectedMembers.size}</strong> stamping authorit{selectedMembers.size === 1 ? 'y' : 'ies'} selected</span>
          </div>

          <ul className="ef-stamping-list" style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 4 }}>
            {filteredMembers.length === 0 ? (
              <li style={{ padding: 12, textAlign: 'center', color: 'var(--muted)' }}>
                No officers match your search. Try changing your search query or department filter.
              </li>
            ) : (
              filteredMembers.map((m) => (
                <li
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border)',
                    background: selectedMembers.has(m.id) ? 'var(--accent-soft)' : 'transparent',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleMember(m.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(m.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleMember(m.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: 'var(--foreground)' }}>{m.name}</strong>
                    <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 6 }}>
                      ({m.pb}) · {m.designation}
                    </span>
                    <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2 }}>
                      {m.unit_path || m.unit || 'HAL Nashik'}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="ef-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn"
            disabled={!file || selectedMembers.size === 0}
            onClick={() => {
              onConfirm({ file, memberIds: Array.from(selectedMembers) });
              onClose();
            }}
          >
            Confirm Stamping Setup ({selectedMembers.size} Authorities)
          </button>
        </div>
      </div>
    </div>
  );
}
