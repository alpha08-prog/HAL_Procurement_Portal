import { useEffect, useState } from 'react';
import DataGrid from '../DataGrid.jsx';
import { TRACKER_COLUMNS } from '../../config/trackerColumns.jsx';
import { fetchTracker } from '../../lib/toolsApi.js';

// One fixture-backed tracker (Portal Hub CON-02/04/05/06/07/09/10, PAY-06): rows, columns
// and the source line all come from /api/trackers/:name + config/trackerColumns.jsx.
export default function TrackerTable({ name }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetchTracker(name)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [name]);

  const spec = TRACKER_COLUMNS[name];
  if (!spec) return <div className="banner banner-error">No columns configured for tracker "{name}" (config/trackerColumns.jsx).</div>;
  if (error) return <div className="banner banner-error">Could not load the tracker: {error}</div>;

  return (
    <div className="doc-section">
      <div className="doc-banner">
        <strong>{data ? data.title.toUpperCase() : 'LOADING…'}</strong>
        <span>{data ? `${data.hub} · ${data.count} rows · as of ${data.asOf}` : ''}</span>
      </div>
      {data?.note && <p className="field-hint" style={{ marginTop: 0 }}>{data.note}</p>}
      <DataGrid columns={spec.columns} rows={data?.rows ?? null} rowKey={spec.rowKey} pageSize={20} emptyMessage="Nothing to track in the fixture." />
      {data && <p className="tracker-source">Source: {data.source}</p>}
    </div>
  );
}
