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

// Recursively renders the file pipeline: one MPR/CAR/SPR can spawn many PP (line-wise L1 agencies).
function FileNode({ file, depth = 0 }) {
  const isParent = file.children && file.children.length > 0;
  const linkPath = file.first_txn ? `/noting/note/${file.first_txn}` : '/noting/files';

  return (
    <li className={`org-node ${isParent ? 'org-node-parent' : ''}`} style={{ marginBottom: 12 }}>
      <div
        className="org-node-card"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          background: depth === 0 ? 'var(--surface)' : 'var(--neutral-bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '8px 14px',
          boxShadow: 'var(--shadow-sm)',
          flexWrap: 'wrap'
        }}
      >
        <span style={{ fontSize: depth === 0 ? 11 : 12, color: depth === 0 ? 'var(--accent)' : 'var(--muted)', fontWeight: 700 }}>
          {depth === 0 ? '●' : '↳'}
        </span>

        <Link
          to={linkPath}
          style={{ fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}
        >
          {file.file_id}
        </Link>

        <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
          {file.title}
        </span>

        {file.kind && (
          <span className="tag" style={{ fontSize: 10, textTransform: 'uppercase' }}>
            {file.kind}
          </span>
        )}

        {file.car_no && (
          <span className="org-code" style={{ fontSize: 11, background: 'var(--accent-soft)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 3 }}>
            {file.car_no}
          </span>
        )}

        {file.line_no && (
          <span className="tag tag-note-routed" style={{ fontSize: 11, fontWeight: 700 }}>
            {file.line_no}
          </span>
        )}

        <span
          className={`tag ${file.status === 'open' ? 'tag-cls-normal' : 'tag-note-approved'}`}
          style={{ fontSize: 10, textTransform: 'uppercase' }}
        >
          {file.status || 'open'}
        </span>

        {isParent && (
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
            ({file.children.length} child {file.children.length === 1 ? 'case' : 'cases'})
          </span>
        )}
      </div>

      {isParent && (
        <ul className="org-children" style={{ marginTop: 8, paddingLeft: 24, borderLeft: '2px dashed var(--accent)', listStyle: 'none' }}>
          {file.children.map((c) => (
            <FileNode key={c.id} file={c} depth={depth + 1} />
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setLoading(true);

    fetchReport(tab)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  const active = TABS.find((t) => t.id === tab);
  const treeList = Array.isArray(data?.tree) ? data.tree : [];

  return (
    <section className="screen">
      <h1 className="screen-title">Reports</h1>
      <p className="screen-sub">
        Procurement pipeline oversight — shows the files you initiated, routed, or supervise as a unit head.
      </p>

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

      {loading ? (
        <div className="grid-empty">Loading report data…</div>
      ) : error ? (
        <div className="banner banner-error">Could not load report: {error}</div>
      ) : tab === 'tree' ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Showing <strong>{treeList.length}</strong> top-level procurement pipelines and their line-wise child Purchase Proposals.
            </div>
            <Link to="/noting/initiate" className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>
              + Initiate Line-wise Child File
            </Link>
          </div>

          {treeList.length === 0 ? (
            <div className="grid-empty" style={{ background: 'var(--surface)', padding: 32, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              No parent-child files found for your supervised units. You can initiate child line-wise Purchase Proposals from the <strong>Initiate</strong> screen.
            </div>
          ) : (
            <ul className="org-tree" style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', listStyle: 'none' }}>
              {treeList.map((f) => (
                <FileNode key={f.id} file={f} depth={0} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <DataGrid
          columns={active.columns}
          rows={data?.rows || []}
          rowKey={active.rowKey}
          emptyMessage="No data available for this report."
        />
      )}
    </section>
  );
}
