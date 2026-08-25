import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { fetchClarifications, raiseClarification, replyClarification } from '../lib/notingApi.js';
import MemberPickerModal from './noting/MemberPickerModal.jsx';

// Clarification side-window for a note: threads visible only to the asker, the asked
// member and the initiator. Not part of the note body, but travels with the note.
export default function Clarifications({ txnId, me, people }) {
  const [list, setList] = useState([]);
  const [raise, setRaise] = useState({ toMemberId: '', body: '' });
  const [replies, setReplies] = useState({});
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  // Search box state for selecting officer
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showHierarchyModal, setShowHierarchyModal] = useState(false);
  const dropdownRef = useRef(null);

  const load = useCallback(() => {
    fetchClarifications(txnId).then((d) => setList(d.clarifications)).catch(() => setList([]));
  }, [txnId]);
  useEffect(() => load(), [load]);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const wrap = async (fn) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doRaise = () =>
    wrap(async () => {
      await raiseClarification(txnId, { toMemberId: Number(raise.toMemberId), body: raise.body });
      setRaise({ toMemberId: '', body: '' });
      setSearchQuery('');
    });

  const doReply = (id) =>
    wrap(async () => {
      await replyClarification(id, { body: replies[id] });
      setReplies((r) => ({ ...r, [id]: '' }));
    });

  const others = useMemo(() => {
    return (Array.isArray(people) ? people : []).filter((p) => p && p.id !== me?.id);
  }, [people, me]);

  const selectedOfficer = useMemo(() => {
    return others.find((p) => String(p.id) === String(raise.toMemberId));
  }, [others, raise.toMemberId]);

  const filteredOfficers = useMemo(() => {
    if (!searchQuery.trim()) return others;
    const q = searchQuery.toLowerCase().trim();
    return others.filter((p) => {
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const pbMatch = (p.pb || '').toLowerCase().includes(q);
      const desigMatch = (p.designation || '').toLowerCase().includes(q);
      const gradeMatch = (p.grade || '').toLowerCase().includes(q);
      const unitMatch = (p.unit_path || p.unit || '').toLowerCase().includes(q);
      return nameMatch || pbMatch || desigMatch || gradeMatch || unitMatch;
    });
  }, [others, searchQuery]);

  return (
    <div className="clarify">
      <div className="form-section">
        <div className="form-section-title">Raise a clarification</div>
        
        <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
          {/* Searchable Officer Selector */}
          <div className="clarify-officer-select-container" ref={dropdownRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span className="field-label" style={{ margin: 0 }}>Ask Officer / Member</span>
              <button
                type="button"
                className="btn-text-action"
                style={{
                  fontSize: 11,
                  color: 'var(--accent)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
                onClick={() => setShowHierarchyModal(true)}
              >
                👥 Browse Directory / Hierarchy
              </button>
            </div>

            {selectedOfficer ? (
              <div className="clarify-selected-officer-card">
                <div className="clarify-selected-officer-info">
                  <div className="officer-badge">
                    👤 <strong>{selectedOfficer.name}</strong>
                    {selectedOfficer.pb && <span className="officer-pb-tag">{selectedOfficer.pb}</span>}
                  </div>
                  <div className="officer-sub">
                    {selectedOfficer.designation || selectedOfficer.grade || 'Officer'}
                    {(selectedOfficer.unit_path || selectedOfficer.unit) && (
                      <span> · {selectedOfficer.unit_path || selectedOfficer.unit}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => {
                    setRaise({ ...raise, toMemberId: '' });
                    setSearchQuery('');
                    setIsDropdownOpen(true);
                  }}
                >
                  ✕ Change
                </button>
              </div>
            ) : (
              <div className="clarify-search-wrapper" style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="field-input"
                  style={{ width: '100%', paddingLeft: 30, fontSize: 13 }}
                  placeholder="🔍 Search officer by name, PB, designation, dept…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                />
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}>
                  🔍
                </span>

                {isDropdownOpen && (
                  <div className="clarify-officer-dropdown">
                    <div className="clarify-dropdown-header">
                      <span>{filteredOfficers.length} officer{filteredOfficers.length === 1 ? '' : 's'} found</span>
                      {searchQuery && (
                        <button
                          type="button"
                          style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => setSearchQuery('')}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="clarify-dropdown-list">
                      {filteredOfficers.length === 0 ? (
                        <div className="clarify-dropdown-empty">
                          No matching officers found for "{searchQuery}". Try browsing directory.
                        </div>
                      ) : (
                        filteredOfficers.slice(0, 40).map((officer) => (
                          <div
                            key={officer.id}
                            className="clarify-dropdown-item"
                            onClick={() => {
                              setRaise({ ...raise, toMemberId: officer.id });
                              setIsDropdownOpen(false);
                              setSearchQuery('');
                            }}
                          >
                            <div className="clarify-item-top">
                              <span className="clarify-item-name">{officer.name}</span>
                              {officer.pb && <span className="clarify-item-pb">{officer.pb}</span>}
                            </div>
                            <div className="clarify-item-bottom">
                              <span>{officer.designation || officer.grade || 'Officer'}</span>
                              {(officer.unit_path || officer.unit) && (
                                <span className="clarify-item-unit"> · {officer.unit_path || officer.unit}</span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Question Body Input */}
          <div>
            <span className="field-label">Question / Clarification Details</span>
            <textarea
              className="field-input"
              style={{ width: '100%', minHeight: 70, resize: 'vertical' }}
              value={raise.body}
              onChange={(e) => setRaise({ ...raise, body: e.target.value })}
              placeholder="e.g. Please clarify the sanctioned budget estimate and PAC justification."
            />
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn" disabled={busy || !raise.toMemberId || !raise.body.trim()} onClick={doRaise}>
            Raise Clarification
          </button>
          <span className="action-note">Visible only to you, the member asked, and the initiator.</span>
        </div>
        {err && <div className="banner banner-error">{err}</div>}
      </div>

      {list.length === 0 ? (
        <div className="grid-empty">No clarifications raised yet.</div>
      ) : (
        <ul className="clarify-list">
          {list.map((c) => {
            const party = me && (me.id === c.asked_by_id || me.id === c.asked_to_id);
            return (
              <li key={c.id} className="clarify-thread">
                <div className="clarify-head">
                  <span>
                    {c.asked_by} → {c.asked_to}
                  </span>
                  <span className={`tag ${c.status === 'answered' ? 'tag-note-approved' : 'tag-note-in_check'}`}>
                    {c.status === 'answered' ? 'Answered' : 'Open'}
                  </span>
                </div>
                <ol className="clarify-msgs">
                  {c.messages.map((m, i) => (
                    <li key={i} className={m.author_id === me?.id ? 'mine' : ''}>
                      <span className="clarify-author">{m.author}</span>
                      <span className="clarify-body">{m.body}</span>
                      <span className="clarify-date">{m.created_at}</span>
                    </li>
                  ))}
                </ol>
                {party && (
                  <div className="clarify-reply">
                    <input
                      className="field-input"
                      value={replies[c.id] || ''}
                      onChange={(e) => setReplies({ ...replies, [c.id]: e.target.value })}
                      placeholder="Reply…"
                    />
                    <button type="button" className="btn btn-secondary" disabled={busy || !replies[c.id]?.trim()} onClick={() => doReply(c.id)}>
                      Send
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Directory / Hierarchy Modal */}
      <MemberPickerModal
        isOpen={showHierarchyModal}
        onClose={() => setShowHierarchyModal(false)}
        members={others}
        onSelect={(m) => {
          setRaise({ ...raise, toMemberId: m.id });
          setShowHierarchyModal(false);
          setSearchQuery('');
        }}
        title="Select Officer to Ask Clarification"
      />
    </div>
  );
}

