import { useState, useMemo } from 'react';

export default function MemberPickerModal({
  isOpen,
  onClose,
  members,
  onSelect,
  title = 'Select Member'
}) {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'hierarchy'
  const [deptFilter, setDeptFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [search, setSearch] = useState('');

  // Hierarchy drill-down state
  const [selectedComplex, setSelectedComplex] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

  // Always sanitize members to a valid array
  const safeMembers = useMemo(() => {
    return Array.isArray(members) ? members.filter(Boolean) : [];
  }, [members]);

  // Extract parsed hierarchy paths: Corporate > Complex > Division > Dept > Section
  const parsedMembers = useMemo(() => {
    return safeMembers.map((m) => {
      const parts = (m.unit_path || m.unit || '').split(' › ').map((s) => s.trim());
      return {
        ...m,
        corporate: parts[0] || 'HAL Corporate Office',
        complex: parts[1] || 'Corporate',
        division: parts[2] || parts[1] || 'Division',
        department: parts[3] || parts[2] || 'Department',
        section: parts[4] || parts[3] || 'Section'
      };
    });
  }, [safeMembers]);

  // Extract unique sorted Complexes, Divisions, Departments, Sections
  const hierarchyOptions = useMemo(() => {
    const complexes = new Set();
    const divisions = new Set();
    const departments = new Set();
    const sections = new Set();

    for (const m of parsedMembers) {
      if (m.complex) complexes.add(m.complex);
      if (!selectedComplex || m.complex === selectedComplex) {
        if (m.division) divisions.add(m.division);
        if (!selectedDivision || m.division === selectedDivision) {
          if (m.department) departments.add(m.department);
          if (!selectedDepartment || m.department === selectedDepartment) {
            if (m.section) sections.add(m.section);
          }
        }
      }
    }

    return {
      complexes: Array.from(complexes).sort(),
      divisions: Array.from(divisions).sort(),
      departments: Array.from(departments).sort(),
      sections: Array.from(sections).sort()
    };
  }, [parsedMembers, selectedComplex, selectedDivision, selectedDepartment]);

  // Extract unique sorted Departments / Units for flat filter
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
    return parsedMembers.filter((m) => {
      if (!m) return false;

      if (viewMode === 'hierarchy') {
        if (selectedComplex && m.complex !== selectedComplex) return false;
        if (selectedDivision && m.division !== selectedDivision) return false;
        if (selectedDepartment && m.department !== selectedDepartment) return false;
        if (selectedSection && m.section !== selectedSection) return false;
      } else {
        if (deptFilter && (m.unit_path || m.unit) !== deptFilter) return false;
        if (gradeFilter && m.grade !== gradeFilter) return false;
      }

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
  }, [parsedMembers, viewMode, selectedComplex, selectedDivision, selectedDepartment, selectedSection, deptFilter, gradeFilter, search]);

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
    setSelectedComplex('');
    setSelectedDivision('');
    setSelectedDepartment('');
    setSelectedSection('');
    setSearch('');
  };

  return (
    <div className="ef-modal-overlay" onClick={onClose}>
      <div className="ef-modal" style={{ maxWidth: 860 }} onClick={(e) => e.stopPropagation()}>
        <div className="ef-modal-header">
          <span>{title}</span>
          <button type="button" className="ef-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="ef-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Mode Switcher */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn btn-inline ${viewMode === 'list' ? '' : 'btn-secondary'}`}
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setViewMode('list')}
              >
                Direct Search &amp; Filter
              </button>
              <button
                type="button"
                className={`btn btn-inline ${viewMode === 'hierarchy' ? '' : 'btn-secondary'}`}
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setViewMode('hierarchy')}
              >
                Nesting Sequence (Corporate › Complex › Division › Dept › Section)
              </button>
            </div>
          </div>

          {/* Nesting Sequence Drill-down View */}
          {viewMode === 'hierarchy' ? (
            <div
              style={{
                background: 'var(--accent-soft)',
                padding: 12,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>
                Hierarchical Drill-down Sequence: Corporate Office ➔ Complex ➔ Division ➔ Department ➔ Section ➔ Individual User
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>
                    1. Complex
                  </label>
                  <select
                    className="field-input"
                    style={{ width: '100%', fontSize: 11 }}
                    value={selectedComplex}
                    onChange={(e) => {
                      setSelectedComplex(e.target.value);
                      setSelectedDivision('');
                      setSelectedDepartment('');
                      setSelectedSection('');
                    }}
                  >
                    <option value="">All Complexes ({hierarchyOptions.complexes.length})</option>
                    {hierarchyOptions.complexes.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>
                    2. Division
                  </label>
                  <select
                    className="field-input"
                    style={{ width: '100%', fontSize: 11 }}
                    value={selectedDivision}
                    onChange={(e) => {
                      setSelectedDivision(e.target.value);
                      setSelectedDepartment('');
                      setSelectedSection('');
                    }}
                  >
                    <option value="">All Divisions ({hierarchyOptions.divisions.length})</option>
                    {hierarchyOptions.divisions.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>
                    3. Department
                  </label>
                  <select
                    className="field-input"
                    style={{ width: '100%', fontSize: 11 }}
                    value={selectedDepartment}
                    onChange={(e) => {
                      setSelectedDepartment(e.target.value);
                      setSelectedSection('');
                    }}
                  >
                    <option value="">All Departments ({hierarchyOptions.departments.length})</option>
                    {hierarchyOptions.departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>
                    4. Section
                  </label>
                  <select
                    className="field-input"
                    style={{ width: '100%', fontSize: 11 }}
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                  >
                    <option value="">All Sections ({hierarchyOptions.sections.length})</option>
                    {hierarchyOptions.sections.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* Dropdown Filters Bar */
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
                  Department / Unit
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
                  Grade / Designation
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
                  Select Officer by Name
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
          )}

          {/* Search Bar & Clear Button */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              className="ef-search-input"
              style={{ flex: 1 }}
              placeholder="🔍 Search officer by Name, PB No, Designation, Unit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {(deptFilter || gradeFilter || search || selectedMemberId || selectedComplex || selectedDivision || selectedDepartment || selectedSection) && (
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
            {(deptFilter || gradeFilter || selectedDepartment || selectedSection) && (
              <span>
                Filtered by: {deptFilter || selectedDepartment ? `[Dept: ${deptFilter || selectedDepartment}] ` : ''}
                {selectedSection ? `[Sec: ${selectedSection}] ` : ''}
                {gradeFilter ? `[Grade: ${gradeFilter}]` : ''}
              </span>
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
                    <th>Department / Unit Hierarchy</th>
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
