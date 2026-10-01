import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, Cell } from 'recharts';
import { fetchPaymentKpis } from '../../lib/kpisApi.js';
import { formatINR } from '../../lib/currency.js';

const STAGE_COLORS = ['#64748b', '#3b82f6', '#0ea5e9', '#f59e0b', '#8b5cf6', '#10b981', '#059669', '#15803d'];
const VENDOR_COLORS = ['#0e4474', '#1e7d43', '#b85d19', '#6366f1', '#0284c7'];
const WINDOWS = [
  [1, 'This month'],
  [6, 'Last 6 months'],
  [12, 'Last 12 months']
];
const num = (v, suffix = '') => (v == null ? 'No data' : `${v}${suffix}`);

// Payment-desk analytics. Every figure comes from /api/payment-advices/kpis, computed from
// the in-memory advices, their history dates and the RV/vendor fixtures; when a window has no
// cleared bills the card says so instead of showing a number.
export default function PaymentKpis() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetchPaymentKpis(months)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [months]);

  const s = data?.summary;

  return (
    <section className="screen">
      <div className="ef-dashboard-header no-print" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="screen-title" style={{ margin: 0 }}>PAYMENT DESK KPIS &amp; ANALYTICS</h1>
          <p className="screen-sub" style={{ margin: '4px 0 0 0' }}>
            Bill processing turnaround, stage timeline and MSE payment metrics{data ? ` · ${data.window[0]} – ${data.window[data.window.length - 1]}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 6, padding: 3, border: '1px solid var(--border)' }}>
            {WINDOWS.map(([n, l]) => (
              <button key={n} type="button" className={`btn btn-inline ${months === n ? '' : 'btn-secondary'}`} style={{ fontSize: 11, padding: '4px 10px', border: 'none' }} onClick={() => setMonths(n)}>
                {l}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => window.print()}>
            Download report
          </button>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}
      {!data && !error && <div className="grid-empty">Computing…</div>}

      {s && (
        <>
          <div className="ef-stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div className="ef-stat-card" style={{ borderLeft: '4px solid #0e4474' }}>
              <div className="stat-label">Average clearance (RV → CPPC)</div>
              <div className="stat-value" style={{ color: '#0e4474' }}>
                {s.avgRvToPaymentDays == null ? 'No data' : <>{s.avgRvToPaymentDays} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>days</span></>}
              </div>
              <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600, color: s.avgRvToPaymentDays != null && s.avgRvToPaymentDays <= s.halInternalSlaDays ? '#16a34a' : '#b45309' }}>
                {s.avgRvToPaymentDays == null ? 'No bill reached CPPC in this window' : s.avgRvToPaymentDays <= s.halInternalSlaDays ? `✓ Within HAL SLA (≤ ${s.halInternalSlaDays} days)` : `Above HAL SLA (≤ ${s.halInternalSlaDays} days)`}
              </div>
            </div>
            <div className="ef-stat-card" style={{ borderLeft: '4px solid #1e7d43' }}>
              <div className="stat-label">Cleared &amp; dispatched to CPPC</div>
              <div className="stat-value" style={{ color: '#1e7d43' }}>{formatINR(s.totalPaidValue)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{s.totalPaidCount} of {s.totalAdvices} advices created in the window</div>
            </div>
            <div className="ef-stat-card" style={{ borderLeft: '4px solid #b85d19' }}>
              <div className="stat-label">In-flight pipeline value</div>
              <div className="stat-value" style={{ color: '#b85d19' }}>{formatINR(s.totalInFlightValue)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{s.totalInFlightCount} active bills in verification / approval</div>
            </div>
            <div className="ef-stat-card" style={{ borderLeft: '4px solid #6366f1' }}>
              <div className="stat-label">MSE bills within {s.msmeSlaTargetDays} days (MSMED Act)</div>
              <div className="stat-value" style={{ color: '#6366f1' }}>{num(s.mseWithin45Pct, '%')}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{s.mseWithin45Count ? `${s.mseWithin45Count} MSE bill(s) cleared · MSE share of advices ${s.mseSharePct}%` : 'No MSE bill cleared in this window'}</div>
            </div>
            <div className="ef-stat-card" style={{ borderLeft: '4px solid #b3261e' }}>
              <div className="stat-label">Liquidated damages deducted</div>
              <div className="stat-value" style={{ color: '#b3261e' }}>{formatINR(s.totalLdAmount)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{s.ldPct == null ? 'No advices in window' : `On ${s.ldPct}% of advices`}</div>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, color: 'var(--accent)', fontWeight: 700 }}>STAGE-BY-STAGE TURNAROUND (AVERAGE DAYS, ALL ADVICES)</h3>
                <p className="field-hint" style={{ margin: '2px 0 0 0' }}>Averages of the dates each advice actually recorded; a stage no advice has passed shows no bar.</p>
              </div>
              <span className="pill pill-info">Gate entry → CPPC avg: {num(s.avgGateToPaymentDays, ' days')}</span>
            </div>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.stageTimeline} layout="vertical" margin={{ top: 10, right: 30, left: 150, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" unit=" d" style={{ fontSize: 11 }} />
                  <YAxis dataKey="stage" type="category" style={{ fontSize: 11, fontWeight: 600 }} width={150} />
                  <Tooltip formatter={(val, _n, p) => [`${val} days (n=${p.payload.n})`, 'Average']} />
                  <Bar dataKey="days" name="Average days" fill="#0e4474" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div className="ef-chart-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--accent)' }}>MONTHLY CLEARED VALUE &amp; BILL VOLUME</h3>
                <span className="tag">{data.window.length} months</span>
              </div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" style={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" unit="L" style={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" allowDecimals={false} style={{ fontSize: 11 }} />
                    <Tooltip formatter={(val, name) => [name.includes('₹') ? `₹${val} lakh` : val, name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="valueClearedLakhs" name="Cleared (₹ lakh)" fill="#1e7d43" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="ldDeductedLakhs" name="LD deducted (₹ lakh)" fill="#b3261e" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="billsReceived" name="Advices created" stroke="#0e4474" strokeWidth={2.5} />
                    <Line yAxisId="right" type="monotone" dataKey="billsCleared" name="Bills cleared" stroke="#059669" strokeWidth={2} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="ef-chart-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--accent)' }}>BILL PIPELINE BY STAGE (NOW)</h3>
                <span className="tag">Current queue</span>
              </div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.pipeline} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" interval={0} angle={-25} textAnchor="end" style={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} style={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Bills in stage" fill="#0e4474" radius={[4, 4, 0, 0]}>
                      {data.pipeline.map((entry, index) => (
                        <Cell key={entry.id} fill={entry.color || STAGE_COLORS[index % STAGE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div className="ef-chart-card">
              <h3 style={{ margin: '0 0 12px 0', fontSize: 13.5, fontWeight: 700, color: 'var(--accent)' }}>VENDOR CATEGORY &amp; MSE COMPLIANCE (ALL ADVICES)</h3>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.vendorBreakdown} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" interval={0} angle={-15} textAnchor="end" style={{ fontSize: 9.5 }} />
                    <YAxis unit="L" style={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, _n, p) => [`₹${v} lakh · ${p.payload.count} advice(s) · avg ${p.payload.avgDays ?? '—'} d`, 'Cleared value']} />
                    <Bar dataKey="valueLakhs" name="Cleared value (₹ lakh)" fill="#0e4474" radius={[4, 4, 0, 0]}>
                      {data.vendorBreakdown.map((_, index) => (
                        <Cell key={index} fill={VENDOR_COLORS[index % VENDOR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="ef-chart-card">
              <h3 style={{ margin: '0 0 12px 0', fontSize: 13.5, fontWeight: 700, color: 'var(--accent)' }}>CLEARANCE SPEED DISTRIBUTION (RV → CPPC)</h3>
              {data.clearedCount === 0 ? (
                <div className="grid-empty">No bill has reached CPPC yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                  {data.slaDistribution.map((item) => (
                    <div key={item.range}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{item.range}</span>
                        <span style={{ fontWeight: 700, color: item.color }}>{item.count} bill{item.count === 1 ? '' : 's'} ({item.pct}%)</span>
                      </div>
                      <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 16, padding: '10px 12px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 11.5, color: '#475569' }}>
                {s.withinHalSlaPct == null
                  ? 'No cleared bills in this window to measure against the HAL 7-day rule.'
                  : `${s.withinHalSlaPct}% of bills created in this window reached CPPC within ${s.halInternalSlaDays} days of the receipt voucher; MSE bills within the MSMED ${s.msmeSlaTargetDays}-day mandate: ${num(s.mseWithin45Pct, '%')}.`}
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 18 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--accent)', fontWeight: 700 }}>PURCHASE OFFICER TURNAROUND MATRIX (ALL ADVICES)</h3>
            <table className="mini-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Purchase officer</th>
                  <th style={{ textAlign: 'right' }}>Active in queue</th>
                  <th style={{ textAlign: 'right' }}>Cleared</th>
                  <th style={{ textAlign: 'right' }}>Cleared value</th>
                  <th style={{ textAlign: 'right' }}>Avg RV → CPPC</th>
                  <th style={{ textAlign: 'right' }}>Oldest pending</th>
                  <th style={{ textAlign: 'center' }}>SLA</th>
                </tr>
              </thead>
              <tbody>
                {data.officerPerformance.map((row) => (
                  <tr key={row.officer}>
                    <td style={{ fontWeight: 600 }}>{row.officer}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.active}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>{row.cleared}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{row.totalValueLakhs} lakh</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0e4474' }}>{row.avgDays == null ? '—' : `${row.avgDays} d`}</td>
                    <td style={{ textAlign: 'right' }}>{row.oldestPendingDays == null ? '—' : `${row.oldestPendingDays} d`}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`pill ${row.rating.startsWith('Within HAL') ? 'pill-success' : row.rating.startsWith('Within MSMED') ? 'pill-info' : row.rating.startsWith('Over') ? 'pill-danger' : 'pill-neutral'}`}>{row.rating}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tracker-source">Source: {data.source}</p>
        </>
      )}
    </section>
  );
}
