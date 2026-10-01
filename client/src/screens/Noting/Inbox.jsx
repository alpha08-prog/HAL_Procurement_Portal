import { useEffect, useMemo, useState } from 'react';
import DataGrid from '../../components/DataGrid.jsx';
import { INBOX_COLUMNS } from '../../config/notingColumns.jsx';
import { cancelDelegation, delegateAuthority, fetchDelegations, fetchInbox, fetchMembers } from '../../lib/notingApi.js';

// Inbox: everything sitting with me (and what I hold as somebody's delegate), on the shared
// DataGrid with INBOX_COLUMNS from config/notingColumns.jsx, plus the delegation panel.
export default function Inbox() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('inbox');
  const [search, setSearch] = useState('');
  const [showDelegation, setShowDelegation] = useState(false);
  const [delegationForm, setDelegationForm] = useState({ fromDate: '', toDate: '', toMemberId: '', reason: '' });
  const [members, setMembers] = useState([]);
  const [delegationMsg, setDelegationMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [delegations, setDelegations] = useState({ given: [], received: [] });

  const reloadAll = () => {
    fetchInbox()
      .then((d) => setRows(d.inbox))
      .catch((err) => setError(err.message));
    fetchDelegations()
      .then((d) => setDelegations({ given: d.given || [], received: d.received || [] }))
      .catch(() => {});
  };

  useEffect(() => {
    let cancelled = false;
    reloadAll();
    fetchMembers()
      .then((d) => !cancelled && setMembers(d.members))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === 'delegated' ? !r.delegated : r.delegated) return false;
      return !q || `${r.title || ''} ${r.ref_no || ''} ${r.initiator_name || ''} ${r.file_id || ''}`.toLowerCase().includes(q);
    });
  }, [rows, tab, search]);

  const handleDelegate = async () => {
    if (!delegationForm.toMemberId || !delegationForm.fromDate || !delegationForm.toDate) return;
    setBusy(true);
    try {
      await delegateAuthority(delegationForm);
      setDelegationMsg('Delegation applied successfully.');
      setDelegationForm({ fromDate: '', toDate: '', toMemberId: '', reason: '' });
      reloadAll();
    } catch (err) {
      setDelegationMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancelDelegation = async (id) => {
    setBusy(true);
    try {
      await cancelDelegation(id);
      setDelegationMsg('Delegation cancelled successfully.');
      reloadAll();
    } catch (err) {
      setDelegationMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const ok = /successfully/i.test(delegationMsg);

  return (
    <section className="screen">
      <h1 className="screen-title">INBOX</h1>

      <div className="ef-tabs">
        <button type="button" className={`ef-tab${tab === 'inbox' ? ' active' : ''}`} onClick={() => setTab('inbox')}>
          INBOX {rows && <span className="nav-badge">{rows.filter((r) => !r.delegated).length}</span>}
        </button>
        <button type="button" className={`ef-tab${tab === 'delegated' ? ' active' : ''}`} onClick={() => setTab('delegated')}>
          DELEGATED INBOX <span className="nav-badge">{rows ? rows.filter((r) => r.delegated).length : 0}</span>
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div className="ef-legend">
          <span className="ef-legend-item"><span className="ef-legend-dot clarification" />Clarifications open / total</span>
          <span className="ef-legend-item"><span className="ef-legend-dot inbox-file" />Days since the note reached you</span>
        </div>
        <div className="ef-search-bar" style={{ flex: '0 1 380px', marginBottom: 0 }}>
          <input className="ef-search-input" placeholder="Search on subject / ref no / sender / file id" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error ? (
        <div className="grid-empty">Could not load inbox: {error}</div>
      ) : (
        <DataGrid columns={INBOX_COLUMNS} rows={filtered} rowKey="txn_id" pageSize={20} emptyMessage={tab === 'delegated' ? 'Nothing is held for you under a delegation.' : 'Your inbox is empty.'} />
      )}

      <div className="ef-delegation-panel">
        <div className="panel-title">
          Delegation Panel
          <button type="button" className="ef-mark-btn" style={{ marginLeft: 16 }} onClick={() => setShowDelegation((v) => !v)}>
            Delegate Authority
          </button>
        </div>

        {showDelegation && (
          <div className="ef-delegation-form" style={{ marginTop: 12 }}>
            <label>
              <span className="field-label">From Date</span>
              <input type="date" className="field-input" value={delegationForm.fromDate} onChange={(e) => setDelegationForm({ ...delegationForm, fromDate: e.target.value })} />
            </label>
            <label>
              <span className="field-label">To Date</span>
              <input type="date" className="field-input" value={delegationForm.toDate} onChange={(e) => setDelegationForm({ ...delegationForm, toDate: e.target.value })} />
            </label>
            <label>
              <span className="field-label">Select Officiating Person</span>
              <select className="field-input" value={delegationForm.toMemberId} onChange={(e) => setDelegationForm({ ...delegationForm, toMemberId: e.target.value })}>
                <option value="">— select member —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.designation}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-wide">
              <span className="field-label">Reasons For Delegation</span>
              <textarea className="field-input" rows={2} value={delegationForm.reason} onChange={(e) => setDelegationForm({ ...delegationForm, reason: e.target.value })} placeholder="Reasons For Delegation" />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" disabled={busy} onClick={handleDelegate}>
                {busy ? 'Delegating…' : 'Delegate'}
              </button>
            </div>
          </div>
        )}

        {(delegations.given.length > 0 || delegations.received.length > 0) && (
          <div style={{ marginTop: 12, fontSize: 12 }}>
            {delegations.given.length > 0 && (
              <div>
                <strong>Delegations you have given</strong>
                <ul style={{ margin: '4px 0 8px 16px', padding: 0 }}>
                  {delegations.given.map((d) => (
                    <li key={d.id}>
                      {d.to_name} ({d.to_designation}) · {d.from_date} → {d.to_date}{' '}
                      <span className={`pill ${d.active ? 'pill-success' : 'pill-neutral'}`}>{d.cancelled_at ? 'cancelled' : d.active ? 'active' : 'inactive'}</span>
                      {!d.cancelled_at && (
                        <button type="button" className="link-button" style={{ marginLeft: 8 }} disabled={busy} onClick={() => handleCancelDelegation(d.id)}>
                          Cancel
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {delegations.received.length > 0 && (
              <div>
                <strong>Delegations you hold</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {delegations.received.map((d) => (
                    <li key={d.id}>
                      from {d.from_name} ({d.from_designation}) · {d.from_date} → {d.to_date}{' '}
                      <span className={`pill ${d.active ? 'pill-success' : 'pill-neutral'}`}>{d.cancelled_at ? 'cancelled' : d.active ? 'active' : 'inactive'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {delegationMsg && (
          <div className="ef-delegation-notice" style={{ color: ok ? '#1e7d43' : '#b3261e', background: ok ? '#e2f4e8' : '#fbe5e3' }}>
            {delegationMsg}
          </div>
        )}
      </div>
    </section>
  );
}
