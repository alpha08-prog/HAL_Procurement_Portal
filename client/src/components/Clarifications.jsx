import { useCallback, useEffect, useState } from 'react';
import { fetchClarifications, raiseClarification, replyClarification } from '../lib/notingApi.js';

// Clarification side-window for a note: threads visible only to the asker, the asked
// member and the initiator. Not part of the note body, but travels with the note.
export default function Clarifications({ txnId, me, people }) {
  const [list, setList] = useState([]);
  const [raise, setRaise] = useState({ toMemberId: '', body: '' });
  const [replies, setReplies] = useState({});
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchClarifications(txnId).then((d) => setList(d.clarifications)).catch(() => setList([]));
  }, [txnId]);
  useEffect(() => load(), [load]);

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
    });

  const doReply = (id) =>
    wrap(async () => {
      await replyClarification(id, { body: replies[id] });
      setReplies((r) => ({ ...r, [id]: '' }));
    });

  const others = (people || []).filter((p) => p.id !== me?.id);

  return (
    <div className="clarify">
      <div className="form-section">
        <div className="form-section-title">Raise a clarification</div>
        <div className="form-grid">
          <label>
            <span className="field-label">Ask</span>
            <select className="field-input" value={raise.toMemberId} onChange={(e) => setRaise({ ...raise, toMemberId: e.target.value })}>
              <option value="">— select member —</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-wide">
            <span className="field-label">Question</span>
            <input className="field-input" value={raise.body} onChange={(e) => setRaise({ ...raise, body: e.target.value })} placeholder="e.g. Please confirm the sanctioned estimate" />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" disabled={busy || !raise.toMemberId || !raise.body.trim()} onClick={doRaise}>
            Raise
          </button>
          <span className="action-note">Visible only to you, the member asked, and the initiator.</span>
        </div>
        {err && <div className="banner banner-error">{err}</div>}
      </div>

      {list.length === 0 ? (
        <div className="grid-empty">No clarifications.</div>
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
    </div>
  );
}
