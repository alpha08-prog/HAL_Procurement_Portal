import { useCallback, useEffect, useState } from 'react';
import { addAttachment, fetchAttachments } from '../lib/notingApi.js';

const KIND_LABEL = { doc: 'Reference / document', stamping: 'Stamping document', dop: 'DoP reference', pm: 'PM reference' };

// Typed attachments on a note. Everyone routed can add reference docs; only the
// initiator can add stamping docs and the DoP reference; the PM reference is automatic.
export default function Attachments({ txnId, isInitiator, canAdd }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ kind: 'doc', name: '', ref: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchAttachments(txnId).then((d) => setList(d.attachments)).catch(() => setList([]));
  }, [txnId]);
  useEffect(() => load(), [load]);

  const add = async () => {
    setBusy(true);
    setErr(null);
    try {
      await addAttachment(txnId, form);
      setForm({ kind: 'doc', name: '', ref: '' });
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
            <li key={a.id}>
              <span className={`tag tag-attach-${a.kind}`}>{KIND_LABEL[a.kind]}</span>
              <span className="attach-name">{a.name}</span>
              {a.ref && <span className="attach-ref">{a.ref}</span>}
              <span className="attach-by">{a.uploaded_by || 'System'}</span>
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <div className="attach-form">
          <select className="field-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="File / document name" />
          <input className="field-input" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="Reference (optional)" />
          <button type="button" className="btn btn-secondary" disabled={busy || !form.name.trim()} onClick={add}>
            Attach
          </button>
        </div>
      )}
      {err && <div className="banner banner-error">{err}</div>}
    </div>
  );
}
