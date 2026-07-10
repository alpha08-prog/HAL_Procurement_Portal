import { useEffect, useState } from 'react';
import DataGrid from '../../components/DataGrid.jsx';
import { CABINET_COLUMNS } from '../../config/notingColumns.jsx';
import { fetchCabinet } from '../../lib/notingApi.js';

// Closed files filed into my cabinet. The deciding authority can retrieve one back to
// their inbox from the note screen.
export default function Cabinet() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchCabinet()
      .then((d) => !cancelled && setRows(d.cabinet))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="screen">
      <h1 className="screen-title">Cabinet</h1>
      <p className="screen-sub">Approved/rejected files you initiated, routed or decided — retained after closure.</p>
      {error ? (
        <div className="grid-empty">Could not load cabinet: {error}</div>
      ) : (
        <DataGrid columns={CABINET_COLUMNS} rows={rows} rowKey="file_pk" emptyMessage="Your cabinet is empty." />
      )}
    </section>
  );
}
