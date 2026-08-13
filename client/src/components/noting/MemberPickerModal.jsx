import { useState, useMemo } from 'react';

export default function MemberPickerModal({
  isOpen,
  onClose,
  members,
  onSelect,
  title = 'Select Member'
}) {
  const [deptFilter, setDeptFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [search, setSearch] = useState('');

  // Always sanitize members to a valid array
  const safeMembers = useMemo(() => {
    return Array.isArray(members) ? members.filter(Boolean) : [];
  }, [members]);

  // Extract unique sorted Departments / Units
  const departments = useMemo(() => {
    const set = new Set();
    for (const m of safeMembers) {
      const u = m.unit_path || m.unit;
      if (u) set.add(u);
    }
    return Array.from(set).sort();
  }, [safeMembers]);

  // Extract unique sorted Grades
  const grades = useMemo(() => {
    const set = new Set();
    for (const m of safeMembers) {
      if (m.grade) set.add(m.grade);
    }
    return Array.from(set).sort();
  }, [safeMembers]);

  // Filter members based on dropdowns & search
  const filtered = useMemo(() => {
    return safeMembers.filter((m) => {
      if (!m) return false;
      // Dept filter
      if (deptFilter && (m.unit_path || m.unit) !== deptFilter) return false;
      // Grade filter
      if (gradeFilter && m.grade !== gradeFilter) return false;
      // Text search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          (m.name || '').toLowerCase().includes(q) ||
          (m.designation || '').toLowerCase().includes(q) ||
          (m.grade || '').toLowerCase().includes(q) ||
          (m.pb || '').toLowerCase().includes(q) ||
          (m.unit_path || m.unit || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [safeMembers, deptFilter, gradeFilter, search]);

  if (!isOpen) return null;

  const handleSelectMember = (member) => {
    if (!member) return;
    onSelect(member);
    onClose();
  };

  const handleDropdownSelect = (e) => {
    const id = e.target.value;
    setSelectedMemberId(id);
    if (id) {
      const found = safeMembers.find((m) => String(m.id) === String(id));
      if (found) {
        handleSelectMember(found);
      }
    }
  };

  const clearFilters = () => {
    setDeptFilter('');
    setGradeFilter('');
    setSelectedMemberId('');
    setSearch('');
  };

  return (
    <div className="ef-modal-overlay" onClick={onClose}>
      <div className="ef-modal" style={{ maxWidth: 840 }} onClick={(e) => e.stopPropagation()}>
        <div className="ef-modal-header">
          <span>👥 {title}</span>
          <button type="button" className="ef-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="ef-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Dropdown Filters Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
              background: 'var(--accent-soft)',
              padding: 12,
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)'
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--accent)' }}>
                🏢 Department / Unit
              </label>
              <select
                className="field-input"
                style={{ width: '100%', fontSize: 12 }}
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setSelectedMemberId('');
                }}
              >
                <option value="">All Departments / Units ({departments.length})</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--accent)' }}>
                🎖️ Grade / Designation
              </label>
              <select
                className="field-input"
                style={{ width: '100%', fontSize: 12 }}
                value={gradeFilter}
                onChange={(e) => {
                  setGradeFilter(e.target.value);
                  setSelectedMemberId('');
                }}
              >
                <option value="">All Grades ({grades.length})</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--accent)' }}>
                👤 Select Officer by Name
              </label>
              <select
                className="field-input"
                style={{ width: '100%', fontSize: 12 }}
                value={selectedMemberId}
                onChange={handleDropdownSelect}
              >
                <option value="">— Select Officer ({filtered.length}) —</option>
                {filtered.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.pb}) — {m.designation}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Bar & Clear Button */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              className="ef-search-input"
              style={{ flex: 1 }}
              placeholder="🔍 Search officer by Name, PB No, Designation, Unit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {(deptFilter || gradeFilter || search || selectedMemberId) && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Results Summary */}
          <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Showing <strong>{filtered.length}</strong> of {safeMembers.length} total officers</span>
            {(deptFilter || gradeFilter) && (
              <span>Filtered by: {deptFilter ? `[Dept: ${deptFilter}] ` : ''}{gradeFilter ? `[Grade: ${gradeFilter}]` : ''}</span>
            )}
          </div>

          {/* Results Table */}
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            {filtered.length === 0 ? (
              <div className="grid-empty">No members match your search criteria. Try clearing filters.</div>
            ) : (
              <table className="ef-routing-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>PB No</th>
                    <th>Name</th>
                    <th>Grade / Designation</th>
                    <th>Department / Unit</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr
                      key={m.id}
                      style={String(m.id) === String(selectedMemberId) ? { background: 'var(--accent-soft)' } : {}}
                    >
                      <td style={{ fontWeight: 600 }}>{m.pb}</td>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td style={{ color: 'var(--muted)' }}>
                        {m.grade && m.grade !== m.designation ? `${m.grade} · ${m.designation}` : m.designation}
                      </td>
                      <td style={{ fontSize: 11 }}>{m.unit_path || m.unit || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '3px 10px', fontSize: 11 }}
                          onClick={() => handleSelectMember(m)}
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
