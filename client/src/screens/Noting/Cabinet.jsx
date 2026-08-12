import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addNote, fetchCabinet } from '../../lib/notingApi.js';

function PriorityBadge({ value }) {
  const cls = value === 'High' ? 'ef-priority-high' : value === 'Medium' ? 'ef-priority-medium' : 'ef-priority-low';
  return <span className={cls}>{value || 'Medium'}</span>;
}

export default function Cabinet() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [filterTab, setFilterTab] = useState('open'); // 'open' | 'closed_unread' | 'closed_read'
  const [subTab, setSubTab] = useState('approved'); // 'approved' | 'rejected' | 'closed' | 'transferred'
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetchCabinet()
      .then((d) => setRows(d.cabinet))
      .catch((err) => setError(err.message));

  useEffect(() => {
    load();
  }, []);

  const advance = async (row) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await addNote(row.file_pk, { stageId: row.next_stage, title: row.next_stage_title });
      navigate(`/noting/note/${r.txn_id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const filtered = rows?.filter((r) => {
    // Filter by subTab decision
    if (subTab === 'approved' && r.status !== 'approved' && r.file_status !== 'closed') return true; // keep approved or cabinet rows
    if (subTab === 'rejected' && r.status !== 'rejected') return false;
    
    // Search filter
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.title || '').toLowerCase().includes(q) ||
      (r.file_id || '').toLowerCase().includes(q) ||
      (r.initiator_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <section className="screen">
      <h1 className="screen-title">
        <span style={{ marginRight: 8 }}>🗄️</span> CABINET
      </h1>
      <p className="screen-sub">
        Files you initiated, routed or decided — retained after closure.
      </p>

      {/* Top Filter Tabs (Open / Closed) */}
      <div className="ef-filter-tabs">
        <button
          type="button"
          className={`ef-filter-tab tab-open${filterTab === 'open' ? ' active' : ''}`}
          onClick={() => setFilterTab('open')}
        >
          Open Files ({rows ? rows.filter(r => r.file_status === 'open').length : 0})
        </button>
        <button
          type="button"
          className={`ef-filter-tab tab-closed-unread${filterTab === 'closed_unread' ? ' active' : ''}`}
          onClick={() => setFilterTab('closed_unread')}
        >
          Closed &amp; Unread Files (0)
        </button>
        <button
          type="button"
          className={`ef-filter-tab tab-closed-read${filterTab === 'closed_read' ? ' active' : ''}`}
          onClick={() => setFilterTab('closed_read')}
        >
          Closed &amp; Read Files ({rows ? rows.filter(r => r.file_status !== 'open').length : 0})
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="ef-tabs">
        <button
          type="button"
          className={`ef-tab${subTab === 'approved' ? ' active' : ''}`}
          onClick={() => setSubTab('approved')}
        >
          APPROVED FILES
        </button>
        <button
          type="button"
          className={`ef-tab${subTab === 'rejected' ? ' active' : ''}`}
          onClick={() => setSubTab('rejected')}
        >
          REJECTED FILES
        </button>
        <button
          type="button"
          className={`ef-tab${subTab === 'closed' ? ' active' : ''}`}
          onClick={() => setSubTab('closed')}
        >
          CLOSED FILES
        </button>
        <button
          type="button"
          className={`ef-tab${subTab === 'transferred' ? ' active' : ''}`}
          onClick={() => setSubTab('transferred')}
        >
          TRANSFERRED FILES
        </button>
      </div>

      {/* Search Bar */}
      <div className="ef-search-bar" style={{ maxWidth: 400 }}>
        <input
          className="ef-search-input"
          placeholder="Search on Subject / Ref No / Initiator"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {!filtered ? (
        <div className="grid-empty">Loading cabinet…</div>
      ) : filtered.length === 0 ? (
        <div className="grid-empty">Your cabinet is empty for this view.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="ef-inbox-table">
            <thead>
              <tr>
                <th>SL</th>
                <th>Closed / Placed Date</th>
                <th>File Ref.No</th>
                <th>SUBJECT</th>
                <th>ORIGINATOR</th>
                <th>PRIORITY</th>
                <th>Status</th>
                <th>Action / Next Note</th>
                <th>FILE ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.file_pk || i}>
                  <td>{i + 1}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>
                    {r.placed_at ? new Date(r.placed_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td>{r.file_id}</td>
                  <td style={{ maxWidth: 280 }}>
                    <Link to={`/noting/note/${r.txn_id}`} className="subject-link">
                      {r.title}
                    </Link>
                  </td>
                  <td style={{ fontSize: 11 }}>{r.initiator_name || '—'}</td>
                  <td><PriorityBadge value={r.priority || 'Medium'} /></td>
                  <td>
                    <span className={`tag ${r.status === 'approved' ? 'tag-note-approved' : r.status === 'rejected' ? 'tag-note-rejected' : 'tag-note-routed'}`}>
                      {r.status || 'Closed'}
                    </span>
                  </td>
                  <td>
                    {r.next_stage ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        disabled={busy}
                        onClick={() => advance(r)}
                      >
                        + Create {r.next_stage_title || r.next_stage}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Archived</span>
                    )}
                  </td>
                  <td><span className="ef-file-id">#{r.file_id}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
