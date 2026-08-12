import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchUpcoming } from '../../lib/notingApi.js';

export default function UpcomingFiles() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchUpcoming()
      .then((d) => !cancelled && setRows(d.upcoming))
      .catch((err) => !cancelled && setError(err.message));
    return () => { cancelled = true; };
  }, []);

  const filtered = rows?.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.title || '').toLowerCase().includes(q) ||
      (r.ref_no || '').toLowerCase().includes(q) ||
      (r.custodian_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <section className="screen">
      <h1 className="screen-title">
        <span style={{ marginRight: 8 }}>⏳</span> UPCOMING FILES
      </h1>
      <p className="screen-sub">
        Files currently in workflow that are routed to pass through you in future steps.
      </p>

      <div className="ef-search-bar" style={{ maxWidth: 400, marginBottom: 16 }}>
        <input
          className="ef-search-input"
          placeholder="Search on Subject / Ref No / Current Holder"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error ? (
        <div className="grid-empty">Could not load upcoming files: {error}</div>
      ) : !filtered ? (
        <div className="grid-empty">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="grid-empty">No upcoming files found in your workflow pipeline.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="ef-inbox-table">
            <thead>
              <tr>
                <th>SL</th>
                <th>File Ref.No</th>
                <th>SUBJECT</th>
                <th>Currently With</th>
                <th>Received On</th>
                <th>Current Routing Position</th>
                <th>Your Position</th>
                <th>FILE ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.txn_id || i}>
                  <td>{i + 1}</td>
                  <td>{r.ref_no}</td>
                  <td style={{ maxWidth: 300 }}>
                    <Link to={`/noting/note/${r.txn_id}`} className="subject-link">
                      {r.title}
                    </Link>
                  </td>
                  <td style={{ fontSize: 11 }}>{r.custodian_name || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>Step #{r.current_step || 1}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--accent)' }}>Step #{r.your_step || 2}</td>
                  <td><span className="ef-file-id">#{r.file_id || r.txn_id}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
