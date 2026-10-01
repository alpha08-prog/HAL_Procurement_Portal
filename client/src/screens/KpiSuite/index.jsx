import { useEffect, useState } from 'react';
import PortalItemModal from '../../components/portal/PortalItemModal.jsx';
import { PORTAL_TABS } from '../../config/portalStructure.js';
import { KPI_SECTIONS, formatKpiValue, kpiTone } from '../../config/kpiColumns.jsx';
import { fetchKpis } from '../../lib/kpisApi.js';

const KPI_TAB = PORTAL_TABS.find((t) => t.id === 'kpi');
const itemByCode = Object.fromEntries(KPI_TAB.items.map((i) => [i.code, i]));
const WINDOWS = [
  [3, 'Last 3 months'],
  [6, 'Last 6 months'],
  [12, 'Last 12 months']
];

// The executive KPI dashboard: every figure is a metric from /api/kpis, computed on the server
// from the requisition register, noting stage files, PO/RV/PA fixtures and the vendor master.
export default function KpiSuiteWorkspace() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetchKpis(months)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [months]);

  const byCode = Object.fromEntries((data?.metrics || []).map((m) => [m.code, m]));
  const mis = byCode['KPI-01'];

  return (
    <section className="screen">
      <div className="screen-header no-print" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: '#9333EA', boxShadow: '0 0 0 4px #F3E8FF' }} />
          <div>
            <h1 className="screen-title" style={{ margin: 0 }}>EXECUTIVE PROCUREMENT KPI &amp; MIS DASHBOARD</h1>
            <p className="screen-subtitle" style={{ margin: 0, color: '#64748B', fontSize: 13 }}>
              HAL Nashik Division · 16 KPIs computed from the portal’s own records{data ? ` · ${data.window[0]} – ${data.window[data.window.length - 1]} · as of ${data.asOf}` : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="field-input" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {WINDOWS.map(([n, l]) => (
              <option key={n} value={n}>
                {l}
              </option>
            ))}
          </select>
          <button type="button" className="btn" style={{ background: '#9333EA', color: '#FFF', fontWeight: 600 }} onClick={() => window.print()}>
            🖨️ Print MIS report
          </button>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {mis && (
        <div className="kpi-mis-strip">
          {mis.series.map((row) => (
            <div key={row.month} className="kpi-mis-cell">
              <div className="kpi-mis-month">{row.month}</div>
              <div>{row.requisitions} req · {row.posPlaced} PO · {row.billsCleared} bills</div>
            </div>
          ))}
          <div className="kpi-mis-cell kpi-mis-note">KPI-01 MIS: {data.counts.requisitions} requisitions, {data.counts.pos} POs, {data.counts.pas} payment advices on file</div>
        </div>
      )}

      {KPI_SECTIONS.map((section) => (
        <div key={section.id} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#0F172A', fontWeight: 700 }}>{section.title.toUpperCase()}</h3>
            <span className={`pill pill-${section.tone}`}>{section.tag}</span>
          </div>
          <div className="kpi-grid">
            {section.codes.map((code) => {
              const item = itemByCode[code];
              const m = byCode[code];
              return (
                <div key={code} className="kpi-interactive-card" onClick={() => item && setActive({ item, metric: m })}>
                  <div className="kpi-card-code">{code}</div>
                  <div className="kpi-card-name">{item?.name || m?.title || code}</div>
                  <div className="kpi-card-metric" style={{ color: m ? (kpiTone(m) === 'danger' ? '#b3261e' : kpiTone(m) === 'success' ? '#047857' : '#0e4474') : 'var(--muted)' }}>
                    {data ? formatKpiValue(m) : '…'}
                  </div>
                  <p className="kpi-card-desc">{item?.desc}</p>
                  <div className="kpi-card-action">{m?.source ? 'View monthly series →' : ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {data && <p className="tracker-source">Definitions and sources are stated per metric (open a card). Windows are calendar months ending this month.</p>}

      {active && <PortalItemModal item={active.item} tab={KPI_TAB} context={{ metric: active.metric, months }} onClose={() => setActive(null)} />}
    </section>
  );
}
