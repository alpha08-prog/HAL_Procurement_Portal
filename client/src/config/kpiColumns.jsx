// Presentation config for the computed KPIs (/api/kpis): how each unit is formatted, how the
// 16 codes group into the dashboard sections, and the series table columns per unit.
import { formatINR } from '../lib/currency.js';

export const KPI_SECTIONS = [
  { id: 'velocity', title: '1. Requisition to purchase order velocity (monthly)', tag: 'Monthly lifecycle flow', tone: 'info', codes: ['KPI-02', 'KPI-03', 'KPI-04', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-08'] },
  { id: 'tendering', title: '2. Tendering & bid opening activity', tag: 'GeM & e-procurement', tone: 'success', codes: ['KPI-09', 'KPI-10'] },
  { id: 'statutory', title: '3. Statutory reservations & government mandates', tag: 'Public Procurement Policy 2012 / CVC', tone: 'warning', codes: ['KPI-11', 'KPI-12', 'KPI-13', 'KPI-14'] },
  { id: 'tat', title: '4. Turnaround times & procurement lead times', tag: 'Operational efficiency', tone: 'neutral', codes: ['KPI-15', 'KPI-16'] }
];

export function formatKpiValue(m) {
  if (!m || m.value == null) return 'No data';
  switch (m.unit) {
    case 'inr':
      return `${formatINR(m.value)}${m.detail?.count != null ? ` (${m.detail.count} PO${m.detail.count === 1 ? '' : 's'})` : ''}`;
    case 'pct':
      return `${m.value}%${m.target != null ? ` (target ${m.target}%)` : ''}`;
    case 'days':
      return `${m.value} days${m.target != null ? ` (target ≤ ${m.target})` : ''}${m.detail?.count != null ? ` · n=${m.detail.count}` : ''}`;
    case 'months':
      return `${m.value} months`;
    default:
      return String(m.value);
  }
}

export function kpiTone(m) {
  if (!m || m.value == null) return 'neutral';
  if (m.target == null) return 'info';
  const meets = m.unit === 'days' ? m.value <= m.target : m.value >= m.target;
  return meets ? 'success' : 'danger';
}

export function kpiStatusLabel(m) {
  if (!m || m.value == null) return 'No data in the prototype';
  if (m.target == null) return 'Computed from portal data';
  const meets = m.unit === 'days' ? m.value <= m.target : m.value >= m.target;
  return meets ? `Meets target (${m.unit === 'days' ? '≤' : '≥'} ${m.target}${m.unit === 'pct' ? '%' : ''})` : `Below target (${m.unit === 'days' ? '≤' : '≥'} ${m.target}${m.unit === 'pct' ? '%' : ''})`;
}

const cell = (unit) => (v) => (v == null ? '—' : unit === 'inr' ? formatINR(v) : unit === 'pct' ? `${v}%` : unit === 'days' ? `${v} d` : String(v));

export function seriesColumns(m) {
  const base = [{ key: 'month', label: 'Month' }];
  if (m.code === 'KPI-01') {
    return [
      ...base,
      { key: 'requisitions', label: 'Requisitions', align: 'right' },
      { key: 'posPlaced', label: 'POs placed', align: 'right' },
      { key: 'posValue', label: 'PO value', align: 'right', render: (r) => formatINR(r.posValue) },
      { key: 'billsCleared', label: 'Bills to CPPC', align: 'right' },
      { key: 'paid', label: 'Value cleared', align: 'right', render: (r) => formatINR(r.paid) }
    ];
  }
  const cols = [...base, { key: 'value', label: m.unit === 'inr' ? 'Value' : m.unit === 'pct' ? 'Share' : m.unit === 'days' ? 'Average' : 'Count', align: 'right', render: (r) => cell(m.unit)(r.value) }];
  if (m.series.some((p) => p.count != null)) cols.push({ key: 'count', label: 'n', align: 'right', render: (r) => (r.count == null ? '—' : r.count) });
  if (m.series.some((p) => p.poValue != null)) cols.push({ key: 'poValue', label: 'PO value', align: 'right', render: (r) => formatINR(r.poValue) });
  return cols;
}
