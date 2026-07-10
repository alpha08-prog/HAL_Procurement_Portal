import { useEffect, useState } from 'react';
import DataGrid from '../../components/DataGrid.jsx';
import { INBOX_COLUMNS } from '../../config/notingColumns.jsx';
import { fetchInbox } from '../../lib/notingApi.js';

// Everything currently with me and awaiting action (drafts, checks, routed notes).
export default function Inbox() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchInbox()
      .then((d) => !cancelled && setRows(d.inbox))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="screen">
      <h1 className="screen-title">Inbox</h1>
      <p className="screen-sub">Notes waiting with you — open one to act, forward, send back or decide.</p>
      {error ? (
        <div className="grid-empty">Could not load inbox: {error}</div>
      ) : (
        <DataGrid columns={INBOX_COLUMNS} rows={rows} rowKey="txn_id" emptyMessage="Your inbox is empty." />
      )}
    </section>
  );
}
