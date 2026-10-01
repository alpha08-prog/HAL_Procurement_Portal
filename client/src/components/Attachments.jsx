import { useCallback, useEffect, useRef, useState } from 'react';
import { addAttachment, fetchAttachments } from '../lib/notingApi.js';
import { fetchFormats, renderFormat } from '../lib/toolsApi.js';
import FormatDocument from './formats/FormatDocument.jsx';

// Typed attachments on a stage file. Files are real uploads (server/storage.js). Two kinds
// carry no file: `annexure` (a Module F computed format, JSON fields) and `format` (a
// standard format rendered by the server from the linked requisition), both drawn here.
const KIND_LABEL = {
  doc: 'Reference / Document',
  stamping: 'Stamping Document',
  dop: 'DoP Reference',
  pm: 'PM Reference',
  annexure: 'AI Annexure',
  format: 'Standard Format'
};

function formatBytes(bytes) {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return ` (${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]})`;
}

const fmtValue = (v) => (Array.isArray(v) ? (v.length ? v.join(', ') : '—') : v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function AnnexureTable({ data }) {
  const rows = Object.entries(data).filter(([k]) => !['format', 'id'].includes(k));
  return (
    <div className="grid-wrap">
      <table className="grid annex-grid">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{k.replace(/_/g, ' ')}</th>
              <td>{fmtValue(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Attachments({ txnId, isInitiator, canAdd, requisitionId = null }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ kind: 'doc', name: '', ref: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(null); // { title, kind, payload }
  const [library, setLibrary] = useState([]);
  const [formatId, setFormatId] = useState('');
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    fetchAttachments(txnId).then((d) => setList(d.attachments)).catch(() => setList([]));
  }, [txnId]);
  useEffect(() => load(), [load]);
  useEffect(() => {
    if (!canAdd) return;
    fetchFormats().then((d) => setLibrary(d.formats)).catch(() => setLibrary([]));
  }, [canAdd]);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!form.name.trim()) setForm((prev) => ({ ...prev, name: file.name }));
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

  // Render a library format on the server (pre-filled from the linked requisition) and file
  // the rendered blocks on the note as a `format` attachment.
  const attachFormat = async () => {
    if (!formatId) return;
    setBusy(true);
    setErr(null);
    try {
      const rendered = await renderFormat(formatId, { fields: {}, requisitionId: requisitionId || undefined });
      await addAttachment(txnId, { kind: 'format', name: `${rendered.code} — ${rendered.title}`, ref: rendered.id, payload: rendered });
      setFormatId('');
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
          {list.map((a) => (
            <li key={a.id} className="attach-row">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                  <span className={`tag tag-attach-${a.kind}`} style={{ fontSize: 10, textTransform: 'uppercase' }}>
                    {KIND_LABEL[a.kind] || a.kind}
                  </span>
                  <strong style={{ fontSize: 12, color: 'var(--accent)', wordBreak: 'break-word' }}>{a.name}</strong>
                  {a.file_size_bytes ? <span style={{ color: 'var(--muted)', fontSize: '0.8em' }}>{formatBytes(a.file_size_bytes)}</span> : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {a.has_file && (
                    <a href={`/api/noting/notes/${encodeURIComponent(txnId)}/attachments/${a.id}/download`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                      ⬇ Download
                    </a>
                  )}
                  {a.payload && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setViewing({ title: a.name, kind: a.kind, payload: a.payload })}>
                      👁️ View
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', gap: 8, flexWrap: 'wrap' }}>
                {a.ref && (
                  <span className="attach-ref" title={a.ref}>
                    Ref: {a.ref}
                  </span>
                )}
                {a.kind === 'annexure' && <span className="tag" style={{ fontSize: 9, background: '#ecfdf5', color: '#065f46' }}>computed by the pipeline — no file</span>}
                {a.kind === 'format' && <span className="tag" style={{ fontSize: 9, background: '#eef2ff', color: '#3730a3' }}>rendered from the formats library</span>}
                <span style={{ marginLeft: 'auto' }}>
                  By: <strong>{a.uploaded_by || 'System'}</strong>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <div className="attach-form">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="field-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={{ minWidth: 130, flex: 1 }}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <input type="file" ref={fileInputRef} onChange={onFileChange} style={{ display: 'none' }} id={`file-upload-${txnId}`} />
            <label htmlFor={`file-upload-${txnId}`} className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              📎 {selectedFile ? (selectedFile.name.length > 18 ? selectedFile.name.slice(0, 15) + '…' : selectedFile.name) : 'Choose File'}
            </label>
          </div>
          <input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Display document name" style={{ width: '100%', boxSizing: 'border-box' }} />
          <input className="field-input" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="Reference code (optional)" style={{ width: '100%', boxSizing: 'border-box' }} />
          <button type="button" className="btn" disabled={busy || (!form.name.trim() && !selectedFile)} onClick={add} style={{ width: '100%', fontSize: 12 }}>
            {busy ? 'Uploading…' : 'Upload Attachment'}
          </button>

          <div className="attach-format-row">
            <select className="field-input" value={formatId} onChange={(e) => setFormatId(e.target.value)} style={{ flex: 1 }}>
              <option value="">— attach a standard format from the library —</option>
              {library.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} · {f.title}{f.verified ? '' : ' (pending from HAL)'}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary" disabled={busy || !formatId} onClick={attachFormat}>
              Render &amp; attach
            </button>
          </div>
          <div className="field-hint">The format is rendered on the server{requisitionId ? ' from the linked requisition' : ''} and filed on this note as blocks, not a file.</div>
        </div>
      )}

      {err && <div className="banner banner-error" style={{ marginTop: 8 }}>{err}</div>}

      {viewing && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 820, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>📑 {viewing.title}</h2>
              <button type="button" className="btn-close" onClick={() => setViewing(null)}>✕</button>
            </div>
            <div className="modal-body">
              {viewing.kind === 'format' && viewing.payload?.blocks ? (
                <div className="note-print-area">
                  <FormatDocument rendered={viewing.payload} />
                </div>
              ) : viewing.payload && typeof viewing.payload === 'object' ? (
                <>
                  {viewing.payload.format && <p className="fmt-note">{viewing.payload.format}</p>}
                  <AnnexureTable data={viewing.payload} />
                </>
              ) : (
                <pre style={{ fontSize: 11 }}>{JSON.stringify(viewing.payload, null, 2)}</pre>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>
              {viewing.kind === 'format' && (
                <button type="button" className="btn" onClick={() => window.print()}>Print</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
