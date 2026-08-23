import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchInbox, fetchMembers, delegateAuthority, cancelDelegation } from '../../lib/notingApi.js';

function PriorityBadge({ value }) {
  const cls = value === 'High' ? 'ef-priority-high' : value === 'Medium' ? 'ef-priority-medium' : 'ef-priority-low';
  return <span className={cls}>{value || 'Medium'}</span>;
}

function DaysBadge({ days }) {
  return <span className={`ef-days-badge${days > 7 ? ' overdue' : ''}`}>{days}</span>;
}

export default function Inbox() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('inbox');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [showDelegation, setShowDelegation] = useState(false);
  const [delegationForm, setDelegationForm] = useState({ fromDate: '', toDate: '', toMemberId: '', reason: '' });
  const [members, setMembers] = useState([]);
  const [delegationMsg, setDelegationMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchInbox()
      .then((d) => !cancelled && setRows(d.inbox))
      .catch((err) => !cancelled && setError(err.message));
    fetchMembers()
      .then((d) => !cancelled && setMembers(d.members))
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const filtered = rows?.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.title || '').toLowerCase().includes(q) ||
      (r.ref_no || '').toLowerCase().includes(q) ||
      (r.initiator_name || '').toLowerCase().includes(q) ||
      (r.file_id || '').toLowerCase().includes(q)
    );
  });

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (!filtered) return;
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.txn_id)));
  };

  const handleDelegate = async () => {
    if (!delegationForm.toMemberId || !delegationForm.fromDate || !delegationForm.toDate) return;
    setBusy(true);
    try {
      await delegateAuthority(delegationForm);
      setDelegationMsg('Delegation applied successfully.');
      setDelegationForm({ fromDate: '', toDate: '', toMemberId: '', reason: '' });
    } catch (err) {
      setDelegationMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancelDelegation = async () => {
    setBusy(true);
    try {
      await cancelDelegation();
      setDelegationMsg('Delegation Removed Successfully');
    } catch (err) {
      setDelegationMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const daysSince = (dateStr) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  };

  return (
    <section className="screen">
      <h1 className="screen-title">INBOX</h1>

      {/* Tabs */}
      <div className="ef-tabs">
        <button
          type="button"
          className={`ef-tab${tab === 'inbox' ? ' active' : ''}`}
          onClick={() => setTab('inbox')}
        >
          INBOX {rows && <span className="nav-badge">{rows.length}</span>}
        </button>
        <button
          type="button"
          className={`ef-tab${tab === 'delegated' ? ' active' : ''}`}
          onClick={() => setTab('delegated')}
        >
          DELEGATED INBOX <span className="nav-badge">0</span>
        </button>
      </div>

      {/* Legend + Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="ef-legend">
          <span className="ef-legend-item">
            <span className="ef-legend-dot clarification" />
            Clarification
          </span>
          <span className="ef-legend-item">
            <span className="ef-legend-dot inbox-file" />
            Inbox File
          </span>
        </div>
        <div className="ef-search-bar" style={{ flex: '0 1 380px', marginBottom: 0 }}>
          <input
            className="ef-search-input"
            placeholder="Search on Subject/Ref No/Sender"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <div className="grid-empty">Could not load inbox: {error}</div>
      ) : !filtered ? (
        <div className="grid-empty">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="grid-empty">Your inbox is empty.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="ef-inbox-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} />
                </th>
                <th>SL</th>
                <th>DAYS</th>
                <th>File Ref.No</th>
                <th>SENDER</th>
                <th>SUBJECT</th>
                <th>Initiator Dept</th>
                <th>RECEIVED ON</th>
                <th>PRIORITY</th>
                <th>Approval Sought Summary</th>
                <th>Clarifications</th>
                <th>Mark Unread</th>
                <th>FILE ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const p = r.priority || 'Medium';
                const rowCls = p === 'High' ? 'ef-row-high' : p === 'Medium' ? 'ef-row-medium' : 'ef-row-low';
                const days = daysSince(r.created_at);
                return (
                  <tr key={r.txn_id} className={rowCls}>
                    <td>
                      <input type="checkbox" checked={selected.has(r.txn_id)} onChange={() => toggleSelect(r.txn_id)} />
                    </td>
                    <td>{i + 1}</td>
                    <td><DaysBadge days={days} /></td>
                    <td style={{ maxWidth: 160 }}>{r.ref_no}</td>
                    <td style={{ fontSize: 11 }}>{r.initiator_name || '—'}</td>
                    <td style={{ maxWidth: 280 }}>
                      <Link
                        to={`/noting/note/${r.txn_id}`}
                        className={`subject-link${p === 'High' ? ' urgent' : ''}`}
                      >
                        {r.title}
                      </Link>
                    </td>
                    <td style={{ fontSize: 11 }}>{r.department || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td><PriorityBadge value={p} /></td>
                    <td style={{ maxWidth: 200, fontSize: 11 }}>
                      {r.body ? (r.body.length > 80 ? r.body.slice(0, 80) + '…' : r.body) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>0/0</td>
                    <td><button type="button" className="ef-mark-btn">Mark</button></td>
                    <td>
                      <span className="ef-file-id">#{r.file_id || r.txn_id}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delegation Panel */}
      <div className="ef-delegation-panel">
        <div className="panel-title">
          Delegation Panel
          <label style={{ marginLeft: 16, fontWeight: 400, fontSize: 12 }}>
            <input type="checkbox" checked={selected.size === (filtered?.length || 0) && (filtered?.length || 0) > 0} onChange={selectAll} />
            {' '}Select ALL Files
          </label>
          <button type="button" className="ef-mark-btn" style={{ marginLeft: 16 }} onClick={() => setShowDelegation((v) => !v)}>
            Delegate Authority
          </button>
        </div>

        {showDelegation && (
          <div className="ef-delegation-form" style={{ marginTop: 12 }}>
            <label>
              <span className="field-label">From Date</span>
              <input
                type="date"
                className="field-input"
                value={delegationForm.fromDate}
                onChange={(e) => setDelegationForm({ ...delegationForm, fromDate: e.target.value })}
              />
            </label>
            <label>
              <span className="field-label">To Date</span>
              <input
                type="date"
                className="field-input"
                value={delegationForm.toDate}
                onChange={(e) => setDelegationForm({ ...delegationForm, toDate: e.target.value })}
              />
            </label>
            <label>
              <span className="field-label">Select Officiating Person</span>
              <select
                className="field-input"
                value={delegationForm.toMemberId}
                onChange={(e) => setDelegationForm({ ...delegationForm, toMemberId: e.target.value })}
              >
                <option value="">— select member —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} — {m.designation}</option>
                ))}
              </select>
            </label>
            <label className="field-wide">
              <span className="field-label">Reasons For Delegation</span>
              <textarea
                className="field-input"
                rows={2}
                value={delegationForm.reason}
                onChange={(e) => setDelegationForm({ ...delegationForm, reason: e.target.value })}
                placeholder="Reasons For Delegation"
              />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" disabled={busy} onClick={handleDelegate}>
                {busy ? 'Delegating…' : 'Delegate'}
              </button>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={handleCancelDelegation}>
                Cancel Delegate
              </button>
            </div>
          </div>
        )}

        {delegationMsg && (
          <div className="ef-delegation-notice" style={{ color: delegationMsg.includes('Successfully') || delegationMsg.includes('successfully') ? '#1e7d43' : '#b3261e', background: delegationMsg.includes('Successfully') || delegationMsg.includes('successfully') ? '#e2f4e8' : '#fbe5e3' }}>
            {delegationMsg}
          </div>
        )}
      </div>
    </section>
  );
}
