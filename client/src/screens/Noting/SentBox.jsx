import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Pagination from '../../components/Pagination.jsx';
import { fetchSentBox, retractNote } from '../../lib/notingApi.js';

function PriorityBadge({ value }) {
  const cls = value === 'High' ? 'ef-priority-high' : value === 'Medium' ? 'ef-priority-medium' : 'ef-priority-low';
  return <span className={cls}>{value || 'Medium'}</span>;
}

export default function SentBox() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('sentbox');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = () => {
    fetchSentBox()
      .then((d) => setRows(d.sentbox))
      .catch((err) => setError(err.message));
  };

  useEffect(() => { load(); }, []);

  // Reset page on search or tab change
  useEffect(() => {
    setPage(1);
  }, [search, tab]);

  const handleRetract = async (txnId) => {
    if (busy) return;
    setBusy(txnId);
    try {
      await retractNote(txnId);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const filtered = rows?.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.title || '').toLowerCase().includes(q) ||
      (r.ref_no || '').toLowerCase().includes(q) ||
      (r.sent_to_name || '').toLowerCase().includes(q) ||
      (r.file_id || '').toLowerCase().includes(q)
    );
  });

  const totalFiltered = filtered?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginated = filtered?.slice((safePage - 1) * pageSize, safePage * pageSize) || [];

  return (
    <section className="screen">
      <h1 className="screen-title">SENTBOX</h1>

      <div className="ef-tabs">
        <button type="button" className={`ef-tab${tab === 'sentbox' ? ' active' : ''}`} onClick={() => setTab('sentbox')}>
          SENTBOX {rows && <span className="nav-badge">{rows.length}</span>}
        </button>
        <button type="button" className={`ef-tab${tab === 'delegated' ? ' active' : ''}`} onClick={() => setTab('delegated')}>
          DELEGATED SENTBOX <span className="nav-badge">0</span>
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div className="ef-legend">
          <span className="ef-legend-item"><span className="ef-legend-dot delivered" /> Delivered ✓</span>
          <span className="ef-legend-item"><span className="ef-legend-dot read" /> Read ✓</span>
        </div>
        <div className="ef-search-bar" style={{ flex: '0 1 380px', marginBottom: 0 }}>
          <input
            className="ef-search-input"
            placeholder="Search on Subject/Ref No/Sent To"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {!filtered ? (
        <div className="grid-empty">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="grid-empty">Your sentbox is empty.</div>
      ) : (
        <div className="grid-container">
          <div className="grid-wrap">
            <table className="ef-inbox-table">
              <thead>
                <tr>
                  <th>SL</th>
                  <th>SENT DATE</th>
                  <th>File Ref.No</th>
                  <th>SENT TO</th>
                  <th>SUBJECT</th>
                  <th>ORIGINATOR</th>
                  <th>Currently With</th>
                  <th>PRIORITY</th>
                  <th>Status</th>
                  <th>FILE ID</th>
                  <th>Retract File</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r, i) => {
                  const p = r.priority || 'Medium';
                  const rowCls = p === 'High' ? 'ef-row-high' : p === 'Medium' ? 'ef-row-medium' : 'ef-row-low';
                  const isRead = r.state === 'opened' || r.state === 'actioned';
                  const isDelivered = r.state === 'sent';
                  const sl = (safePage - 1) * pageSize + i + 1;
                  return (
                    <tr key={r.step_id || i} className={rowCls}>
                      <td>{sl}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>
                        {r.sent_at ? new Date(r.sent_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td>{r.ref_no}</td>
                      <td style={{ fontSize: 11 }}>{r.sent_to_name || '—'}</td>
                      <td style={{ maxWidth: 280 }}>
                        <Link to={`/noting/note/${r.txn_id}`} className="subject-link">
                          {r.title}
                        </Link>
                      </td>
                      <td style={{ fontSize: 11 }}>{r.initiator_name || '—'}</td>
                      <td style={{ fontSize: 11 }}>{r.custodian_name || '—'}</td>
                      <td><PriorityBadge value={p} /></td>
                      <td>
                        {isRead && <span className="ef-status-icon read">✓✓ Read</span>}
                        {isDelivered && <span className="ef-status-icon delivered">✓ Delivered</span>}
                        {!isRead && !isDelivered && <span style={{ fontSize: 11, color: '#5c6b7a' }}>{r.state}</span>}
                      </td>
                      <td><span className="ef-file-id">#{r.file_id || r.txn_id}</span></td>
                      <td>
                        {r.can_retract && (
                          <button
                            type="button"
                            className="ef-retract-btn"
                            disabled={busy === r.txn_id}
                            onClick={() => handleRetract(r.txn_id)}
                          >
                            {busy === r.txn_id ? '…' : 'Retract'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid-footer">
            <Pagination
              currentPage={safePage}
              totalItems={totalFiltered}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[20, 50, 100]}
            />
          </div>
        </div>
      )}
    </section>
  );
}
