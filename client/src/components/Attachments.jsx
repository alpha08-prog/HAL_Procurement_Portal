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

// Typed attachments on a note. Everyone routed can add reference docs; only the
// initiator can add stamping docs and the DoP reference; the PM reference is automatic.
export default function Attachments({ txnId, isInitiator, canAdd }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ kind: 'doc', name: '', ref: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
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

  // Options depend on who I am: initiator-only kinds are gated; PM is never manual.
  const kinds = isInitiator ? ['doc', 'stamping', 'dop'] : ['doc'];

  return (
    <div className="attachments">
      {list.length === 0 ? (
        <div className="grid-empty">No attachments.</div>
      ) : (
        <ul className="attach-list">
          {list.map((a) => (
            <li key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <span className={`tag tag-attach-${a.kind}`}>{KIND_LABEL[a.kind] || a.kind}</span>
                <span className="attach-name" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.name}
                  {a.file_size_bytes ? <span style={{ color: 'var(--color-muted, #64748b)', fontSize: '0.85em', fontWeight: 'normal' }}>{formatBytes(a.file_size_bytes)}</span> : null}
                </span>
                {a.ref && <span className="attach-ref">[{a.ref}]</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="attach-by" style={{ fontSize: '0.85em', color: 'var(--color-muted, #64748b)' }}>{a.uploaded_by || 'System'}</span>
                {a.has_file ? (
                  <a
                    href={`/api/noting/notes/${encodeURIComponent(txnId)}/attachments/${a.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-xs btn-outline"
                    style={{ textDecoration: 'none', padding: '2px 8px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid currentColor' }}
                  >
                    ⬇ View / Download
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <div className="attach-form" style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <select className="field-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
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
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            📎 {selectedFile ? selectedFile.name : 'Choose File'}
          </label>
          <input
            className="field-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Display document name"
            style={{ flex: 1, minWidth: '150px' }}
          />
          <input
            className="field-input"
            value={form.ref}
            onChange={(e) => setForm({ ...form, ref: e.target.value })}
            placeholder="Reference code (optional)"
            style={{ width: '180px' }}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || (!form.name.trim() && !selectedFile)}
            onClick={add}
          >
            {busy ? 'Uploading...' : 'Upload Attachment'}
          </button>
        </div>
      )}
      {err && <div className="banner banner-error" style={{ marginTop: '8px' }}>{err}</div>}
    </div>
  );
}
