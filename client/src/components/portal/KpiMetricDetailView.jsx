import { useEffect, useState } from 'react';
import DataGrid from '../DataGrid.jsx';
import { formatKpiValue, kpiStatusLabel, kpiTone, seriesColumns } from '../../config/kpiColumns.jsx';
import { fetchKpi } from '../../lib/kpisApi.js';

// One computed KPI (Portal Hub KPI cards and the KPI suite). The metric arrives from
// /api/kpis — value, target, per-month series, source and definition note — or is passed in
// by the suite that already fetched the set. Nothing here is a literal.
export default function KpiMetricDetailView({ item, metric: given = null, months = 6 }) {
  const [metric, setMetric] = useState(given);
  const [window, setWindow] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (given) {
      setMetric(given);
      return;
    }
    let cancelled = false;
    fetchKpi(item.code, months)
      .then((d) => {
        if (cancelled) return;
        setMetric(d.metric);
        setWindow(d.window);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [item.code, given, months]);

  if (error) return <div className="banner banner-error">Could not compute {item.code}: {error}</div>;
  if (!metric) return <div className="grid-empty">Computing…</div>;
  const tone = kpiTone(metric);

  return (
    <div className="doc-section">
      <div className="doc-banner">
        <strong>{metric.code} — {metric.title}</strong>
        <span>{window ? `${window[0]} – ${window[window.length - 1]}` : `last ${months} months`}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
        <div className="kpi-card-box">
          <div className="kpi-card-lbl">Value</div>
          <div className="kpi-card-val">{formatKpiValue(metric)}</div>
          <span className={`pill pill-${tone}`}>{kpiStatusLabel(metric)}</span>
        </div>
        <div className="kpi-card-box">
          <div className="kpi-card-lbl">Target / benchmark</div>
          <div className="kpi-card-val" style={{ fontSize: 14 }}>{metric.target != null ? `${metric.unit === 'days' ? '≤ ' : '≥ '}${metric.target}${metric.unit === 'pct' ? '%' : metric.unit === 'days' ? ' days' : ''}` : 'None stated'}</div>
          <span className="kpi-card-sub">{metric.targetSource || 'No statutory target for this metric in the spec'}</span>
        </div>
        <div className="kpi-card-box">
          <div className="kpi-card-lbl">Definition</div>
          <div className="kpi-card-val" style={{ fontSize: 12, fontWeight: 500 }}>{item.desc}</div>
        </div>
      </div>
      {metric.detail?.vendors?.length > 0 && (
        <p className="field-hint">Vendors counted: {metric.detail.vendors.join(', ')} — {metric.detail.poCount} of {metric.detail.totalPoCount} POs on file.</p>
      )}
      <DataGrid columns={seriesColumns(metric)} rows={metric.series} rowKey="month" pagination={false} emptyMessage="No monthly series." />
      <p className="tracker-source">Source: {metric.source}{metric.note ? ` · ${metric.note}` : ''}</p>
    </div>
  );
}
