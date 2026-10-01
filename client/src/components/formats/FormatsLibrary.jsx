import { useEffect, useMemo, useState } from 'react';
import DataGrid from '../DataGrid.jsx';
import { FORMAT_KIND_LABELS, formatColumns } from '../../config/formatColumns.jsx';
import { fetchFormats } from '../../lib/toolsApi.js';
import FormatFiller from './FormatFiller.jsx';

// The whole standard-formats library (Portal Hub PRO-19): a filterable register from
// /api/formats with verified / pending badges, and the chosen entry opened in FormatFiller.
export default function FormatsLibrary({ initialId = null }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [kind, setKind] = useState('all');
  const [selected, setSelected] = useState(initialId);

  useEffect(() => {
    fetchFormats()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const rows = useMemo(() => {
    if (!data) return null;
    const q = filter.trim().toLowerCase();
    return data.formats.filter(
      (f) =>
        (kind === 'all' || f.kind === kind) &&
        (!q || `${f.code} ${f.title} ${f.category} ${f.kind}`.toLowerCase().includes(q))
    );
  }, [data, filter, kind]);

  if (error) return <div className="banner banner-error">Could not load the formats library: {error}</div>;

  if (selected) {
    const entry = data?.formats.find((f) => f.id === selected);
    return (
      <div>
        <div className="fmt-lib-bar no-print">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>
            ← All formats
          </button>
          {entry && (
            <span className="field-hint">
              {entry.code} · {FORMAT_KIND_LABELS[entry.kind] || entry.kind} · {entry.category}
            </span>
          )}
        </div>
        <FormatFiller id={selected} />
      </div>
    );
  }

  return (
    <div className="doc-section">
      <div className="doc-banner">
        <strong>HAL STANDARD FORMATS LIBRARY</strong>
        <span>
          {data ? `${data.summary.total} formats · ${data.summary.verified} transcribed from HAL documents · ${data.summary.pending} pending from HAL` : 'Loading…'}
        </span>
      </div>
      <div className="fmt-lib-filters no-print">
        <input type="text" className="field-input" placeholder="Search code, title or category…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <select className="field-input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">All kinds</option>
          {Object.entries(FORMAT_KIND_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <DataGrid columns={formatColumns(setSelected)} rows={rows} rowKey="id" pageSize={50} emptyMessage="No formats match." />
      {data && <p className="field-hint">{data.note}</p>}
    </div>
  );
}
