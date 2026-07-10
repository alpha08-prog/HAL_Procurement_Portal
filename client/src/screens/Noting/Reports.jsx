import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DataGrid from '../../components/DataGrid.jsx';
import {
  LIFECYCLE_COLUMNS,
  LIVE_STATUS_COLUMNS,
  STAGE_TIME_COLUMNS
} from '../../config/notingColumns.jsx';
import { fetchReport } from '../../lib/notingApi.js';

const TABS = [
  { id: 'lifecycle', label: 'Lifecycle summary', columns: LIFECYCLE_COLUMNS, rowKey: 'id' },
  { id: 'stage-time', label: 'Stage & time', columns: STAGE_TIME_COLUMNS, rowKey: 'ref_no' },
  { id: 'tree', label: 'Parent–child tree' },
  { id: 'live-status', label: 'Live status', columns: LIVE_STATUS_COLUMNS, rowKey: 'file_id' }
];

// Recursively renders the file pipeline: one MPR/CAR/SPR can spawn many PP.
function FileNode({ file }) {
  return (
    <li className="org-node">
      <span className="org-node-label">
        <Link to={`/noting/note/${file.first_txn}`}>{file.file_id}</Link>
        <span>{file.title}</span>
        {file.car_no && <span className="org-code">{file.car_no}</span>}
      </span>
      {file.children?.length > 0 && (
        <ul className="org-children">
          {file.children.map((c) => (
            <FileNode key={c.id} file={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Reports() {
  const [tab, setTab] = useState('lifecycle');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetchReport(tab)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const active = TABS.find((t) => t.id === tab);

  return (
    <section className="screen">
      <h1 className="screen-title">Reports</h1>
      <p className="screen-sub">Procurement pipeline oversight — for User, Section Head, Department Head and GM.</p>

      <div className="ai-doc-modes report-tabs" role="group" aria-label="Report">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={'btn' + (tab === t.id ? '' : ' btn-secondary')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="grid-empty">Could not load report: {error}</div>
      ) : tab === 'tree' ? (
        !data ? (
          <div className="grid-empty">Loading…</div>
        ) : (
          <ul className="org-tree">
            {data.tree.map((f) => (
              <FileNode key={f.id} file={f} />
            ))}
          </ul>
        )
      ) : (
        <DataGrid columns={active.columns} rows={data?.rows} rowKey={active.rowKey} emptyMessage="No data." />
      )}
    </section>
  );
}
