import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataGrid from '../../components/DataGrid.jsx';
import { registerColumns, registerCsvColumns } from '../../config/registerColumns.jsx';
import { statusMeta } from '../../config/statusColors.js';
import { downloadCsv, toCsv } from '../../lib/csv.js';

const EMPTY_FILTERS = { fy: '', status: '', officer: '', q: '' };

// Screen 6 — Payment Record & History Register. Strictly read-only: metric cards +
// filters drive the server-side /register query; "View" opens the read-only advice.
export default function PaymentRegister() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    let cancelled = false;
    fetch(`/api/payment-advices/register?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const onView = (row) =>
    navigate(`/payment-advice?pa=${encodeURIComponent(row.paNo)}&back=/payment-register&view=1`);

  const rows = data?.rows ?? null;
  const summary = data?.summary;
  const options = data?.options ?? { fys: [], statuses: [], officers: [] };

  const onExport = () => {
    const tag = filters.fy || 'all';
    downloadCsv(`payment-register-${tag}.csv`, toCsv(registerCsvColumns, rows ?? []));
  };

  const cards = [
    { label: 'Processed', value: summary ? summary.processed : '—' },
    {
      label: 'Avg RV → Payment',
      value: summary?.avgRvToPaymentDays != null ? `${summary.avgRvToPaymentDays} days` : '—'
    },
    { label: 'MSE Share', value: summary ? `${summary.mseSharePct}%` : '—' },
    { label: 'At CPPC', value: summary ? summary.atCppc : '—' }
  ];

  return (
    <section className="screen">
      <h1 className="screen-title">Payment Record &amp; History Register</h1>
      <p className="screen-note">
        Read-only audit register across all payment advices. Filters and search narrow the rows;
        the metrics reflect the current view.
      </p>

      <div className="metric-cards">
        {cards.map((card) => (
          <div className="metric-card" key={card.label}>
            <div className="metric-value">{card.value}</div>
            <div className="metric-label">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <input
          className="field-input filter-search"
          type="search"
          placeholder="Search PA / PO / RV / vendor…"
          value={filters.q}
          onChange={(e) => setFilter('q', e.target.value)}
        />
        <select className="field-input" value={filters.fy} onChange={(e) => setFilter('fy', e.target.value)}>
          <option value="">All FYs</option>
          {options.fys.map((fy) => (
            <option key={fy} value={fy}>
              FY {fy}
            </option>
          ))}
        </select>
        <select
          className="field-input"
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">All statuses</option>
          {options.statuses.map((s) => (
            <option key={s} value={s}>
              {statusMeta(s).label}
            </option>
          ))}
        </select>
        <select
          className="field-input"
          value={filters.officer}
          onChange={(e) => setFilter('officer', e.target.value)}
        >
          <option value="">All officers</option>
          {options.officers.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={onExport} disabled={!rows || rows.length === 0}>
          Export CSV
        </button>
      </div>

      {error ? (
        <div className="grid-empty">Could not load register: {error}</div>
      ) : (
        <DataGrid
          columns={registerColumns({ onView })}
          rows={rows}
          rowKey="paNo"
          emptyMessage="No payment advices match these filters."
        />
      )}
    </section>
  );
}
