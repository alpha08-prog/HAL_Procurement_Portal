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
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'open' | 'closed'
  const [subTab, setSubTab] = useState('all'); // 'all' | 'approved' | 'rejected'
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetchCabinet()
      .then((d) => setRows(d.cabinet || []))
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

  const safeRows = Array.isArray(rows) ? rows : [];

  const filtered = safeRows.filter((r) => {
    // Filter by Top Tab (open / closed / all)
    if (filterTab === 'open' && r.file_status !== 'open') return false;
    if (filterTab === 'closed' && r.file_status === 'open') return false;

    // Filter by Sub Tab (approved / rejected / all)
    if (subTab === 'approved' && r.status === 'rejected') return false;
    if (subTab === 'rejected' && r.status !== 'rejected') return false;

    // Search filter
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.title || '').toLowerCase().includes(q) ||
      (r.file_id || '').toLowerCase().includes(q) ||
      (r.initiator_name || '').toLowerCase().includes(q) ||
      (r.reason || '').toLowerCase().includes(q)
    );
  });

  const openCount = safeRows.filter((r) => r.file_status === 'open').length;
  const closedCount = safeRows.filter((r) => r.file_status !== 'open').length;

  return (
    <section className="screen">
      <h1 className="screen-title">
        <span style={{ marginRight: 8 }}>🗄️</span> CABINET
      </h1>
      <p className="screen-sub">
        Files you initiated, routed or decided — retained after closure.
      </p>

      {/* Top Filter Tabs (All / Open / Closed) */}
      <div className="ef-filter-tabs">
        <button
          type="button"
          className={`ef-filter-tab${filterTab === 'all' ? ' active' : ''}`}
          onClick={() => setFilterTab('all')}
        >
          All Cabinet Files ({safeRows.length})
        </button>
        <button
          type="button"
          className={`ef-filter-tab tab-open${filterTab === 'open' ? ' active' : ''}`}
          onClick={() => setFilterTab('open')}
        >
          Open Cases ({openCount})
        </button>
        <button
          type="button"
          className={`ef-filter-tab tab-closed-read${filterTab === 'closed' ? ' active' : ''}`}
          onClick={() => setFilterTab('closed')}
        >
          Closed Cases ({closedCount})
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="ef-tabs" style={{ marginTop: 12 }}>
        <button
          type="button"
          className={`ef-tab${subTab === 'all' ? ' active' : ''}`}
          onClick={() => setSubTab('all')}
        >
          ALL ({safeRows.length})
        </button>
        <button
          type="button"
          className={`ef-tab${subTab === 'approved' ? ' active' : ''}`}
          onClick={() => setSubTab('approved')}
        >
          APPROVED FILES ({safeRows.filter((r) => r.status !== 'rejected').length})
        </button>
        <button
          type="button"
          className={`ef-tab${subTab === 'rejected' ? ' active' : ''}`}
          onClick={() => setSubTab('rejected')}
        >
          REJECTED FILES ({safeRows.filter((r) => r.status === 'rejected').length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="ef-search-bar" style={{ maxWidth: 400, marginTop: 12 }}>
        <input
          className="ef-search-input"
          placeholder="Search on Subject / Ref No / Initiator"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {!rows ? (
        <div className="grid-empty">Loading cabinet…</div>
      ) : filtered.length === 0 ? (
        <div className="grid-empty">Your cabinet is empty for this view.</div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table className="ef-inbox-table">
            <thead>
              <tr>
                <th>SL</th>
                <th>Closed / Placed Date</th>
                <th>File Ref.No</th>
                <th>SUBJECT</th>
                <th>ORIGINATOR</th>
                <th>ROLE IN FILE</th>
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
                    <Link to={`/noting/note/${r.txn_id || r.last_txn}`} className="subject-link">
                      {r.title}
                    </Link>
                  </td>
                  <td style={{ fontSize: 11 }}>{r.initiator_name || '—'}</td>
                  <td>
                    <span className="tag" style={{ textTransform: 'capitalize', fontSize: 10 }}>
                      {r.reason || 'Participant'}
                    </span>
                  </td>
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
