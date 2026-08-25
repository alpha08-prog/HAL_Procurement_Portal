import { useCallback, useEffect, useState, useRef } from 'react';
import { addAttachment, fetchAttachments } from '../lib/notingApi.js';

const KIND_LABEL = {
  doc: 'Reference / Document',
  stamping: 'Stamping Document',
  dop: 'DoP Reference',
  pm: 'PM Reference'
};

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return ` (${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]})`;
}

function parseJsonSafe(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export default function Attachments({ txnId, isInitiator, canAdd }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ kind: 'doc', name: '', ref: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [viewingAnnexure, setViewingAnnexure] = useState(null);
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    fetchAttachments(txnId).then((d) => setList(d.attachments)).catch(() => setList([]));
  }, [txnId]);

  useEffect(() => load(), [load]);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!form.name.trim()) {
        setForm((prev) => ({ ...prev, name: file.name }));
      }
    }
  };

  const add = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (selectedFile) {
        const data = new FormData();
        data.append('file', selectedFile);
        data.append('kind', form.kind);
        data.append('name', form.name || selectedFile.name);
        if (form.ref) data.append('ref', form.ref);
        await addAttachment(txnId, data);
      } else {
        await addAttachment(txnId, form);
      }
      setForm({ kind: 'doc', name: '', ref: '' });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const kinds = isInitiator ? ['doc', 'stamping', 'dop'] : ['doc'];

  return (
    <div className="attachments" style={{ width: '100%', overflow: 'hidden' }}>
      {list.length === 0 ? (
        <div className="grid-empty">No attachments.</div>
      ) : (
        <ul className="attach-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {list.map((a) => {
            const parsedRef = parseJsonSafe(a.ref);
            return (
              <li
                key={a.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border)',
                  background: '#fff',
                  borderRadius: 'var(--radius)',
                  marginBottom: '8px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                    <span className={`tag tag-attach-${a.kind}`} style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                      {KIND_LABEL[a.kind] || a.kind}
                    </span>
                    <strong
                      style={{
                        fontSize: '12px',
                        color: 'var(--accent)',
                        wordBreak: 'break-word',
                        maxWidth: '100%'
                      }}
                    >
                      {a.name}
                    </strong>
                    {a.file_size_bytes ? (
                      <span style={{ color: 'var(--color-muted, #64748b)', fontSize: '0.8em' }}>
                        {formatBytes(a.file_size_bytes)}
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {a.has_file && (
                      <a
                        href={`/api/noting/notes/${encodeURIComponent(txnId)}/attachments/${a.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-xs btn-outline"
                        style={{ textDecoration: 'none', padding: '2px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid currentColor' }}
                      >
                        ⬇ Download
                      </a>
                    )}
                    {parsedRef && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                        onClick={() => setViewingAnnexure({ title: a.name, data: parsedRef })}
                      >
                        👁️ View Annexure
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-info: Reference tag and uploaded by */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', gap: 8, flexWrap: 'wrap' }}>
                  {a.ref && !parsedRef && (
                    <span
                      style={{
                        fontFamily: 'Consolas, monospace',
                        background: '#f1f5f9',
                        padding: '1px 6px',
                        borderRadius: 3,
                        maxWidth: '220px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={a.ref}
                    >
                      Ref: {a.ref}
                    </span>
                  )}
                  {parsedRef && (
                    <span className="tag" style={{ fontSize: '9px', background: '#ecfdf5', color: '#065f46' }}>
                      ✓ Structured Annexure Format
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto' }}>
                    By: <strong>{a.uploaded_by || 'System'}</strong>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canAdd && (
        <div className="attach-form" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: 10, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              className="field-input"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              style={{ minWidth: '130px', flex: 1 }}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileChange}
              style={{ display: 'none' }}
              id={`file-upload-${txnId}`}
            />
            <label
              htmlFor={`file-upload-${txnId}`}
              className="btn btn-secondary"
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 12 }}
            >
              📎 {selectedFile ? (selectedFile.name.length > 18 ? selectedFile.name.slice(0, 15) + '…' : selectedFile.name) : 'Choose File'}
            </label>
          </div>

          <input
            className="field-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Display document name"
            style={{ width: '100%', boxSizing: 'border-box' }}
          />

          <input
            className="field-input"
            value={form.ref}
            onChange={(e) => setForm({ ...form, ref: e.target.value })}
            placeholder="Reference code (optional)"
            style={{ width: '100%', boxSizing: 'border-box' }}
          />

          <button
            type="button"
            className="btn"
            disabled={busy || (!form.name.trim() && !selectedFile)}
            onClick={add}
            style={{ width: '100%', fontSize: 12 }}
          >
            {busy ? 'Uploading…' : 'Upload Attachment'}
          </button>
        </div>
      )}

      {err && <div className="banner banner-error" style={{ marginTop: '8px' }}>{err}</div>}

      {/* Annexure JSON / Data Viewer Modal */}
      {viewingAnnexure && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 640, maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>📑 Annexure Details: {viewingAnnexure.title}</h2>
              <button type="button" className="btn-close" onClick={() => setViewingAnnexure(null)}>✕</button>
            </div>
            <div className="modal-body">
              <pre style={{ fontSize: 11, background: '#f8fafc', padding: 12, borderRadius: 4, overflowX: 'auto', border: '1px solid var(--border)' }}>
                {JSON.stringify(viewingAnnexure.data, null, 2)}
              </pre>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setViewingAnnexure(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
