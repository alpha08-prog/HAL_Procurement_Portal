import { useState } from 'react';

export default function StampingModal({ isOpen, onClose, members, onConfirm }) {
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [file, setFile] = useState(null);

  if (!isOpen) return null;

  const toggleMember = (id) => {
    setSelectedMembers((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="ef-modal-overlay" onClick={onClose}>
      <div className="ef-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ef-modal-header">
          <span>🔏 Document Stamping Authority</span>
          <button type="button" className="ef-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ef-modal-body">
          <div style={{ marginBottom: 16 }}>
            <label className="field-label">Upload Document for Stamping (PDF only)</label>
            <input
              type="file"
              accept=".pdf"
              className="field-input"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>

          <label className="field-label">Select Stamping Authorities (Officers whose stamp will be applied):</label>
          <ul className="ef-stamping-list" style={{ maxHeight: 220, overflowY: 'auto' }}>
            {members.map((m) => (
              <li key={m.id}>
                <input
                  type="checkbox"
                  checked={selectedMembers.has(m.id)}
                  onChange={() => toggleMember(m.id)}
                />
                <div>
                  <strong>{m.name}</strong> — {m.designation} ({m.pb})
                </div>
              </li>
            ))}
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
            Confirm Stamping Setup
          </button>
        </div>
      </div>
    </div>
  );
}
