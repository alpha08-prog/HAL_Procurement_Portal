import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { fetchDashboard, fetchOverview } from '../../lib/notingApi.js';

const MOCK_WORKLOAD_DATA = [
  { month: 'Mar 2026', received: 12, cleared: 10 },
  { month: 'Apr 2026', received: 18, cleared: 15 },
  { month: 'May 2026', received: 14, cleared: 14 },
  { month: 'Jun 2026', received: 22, cleared: 19 },
  { month: 'Jul 2026', received: 16, cleared: 16 },
  { month: 'Aug 2026', received: 20, cleared: 18 }
];

const MOCK_CLEARANCE_DATA = [
  { month: 'Mar 2026', days: 2.4 },
  { month: 'Apr 2026', days: 1.8 },
  { month: 'May 2026', days: 3.1 },
  { month: 'Jun 2026', days: 2.0 },
  { month: 'Jul 2026', days: 1.5 },
  { month: 'Aug 2026', days: 2.2 }
];

const MOCK_TREND_DATA = [
  { month: 'Mar 2026', files: 45 },
  { month: 'Apr 2026', files: 62 },
  { month: 'May 2026', files: 58 },
  { month: 'Jun 2026', files: 84 },
  { month: 'Jul 2026', files: 76 },
  { month: 'Aug 2026', files: 95 }
];

export default function Home() {
  const [data, setData] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchOverview()
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message));
    fetchDashboard()
      .then((d) => !cancelled && setDashboard(d))
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const c = data?.counts;

  return (
    <section className="screen">
      <div className="ef-dashboard-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="screen-title" style={{ margin: 0 }}>📊 E-FILE DASHBOARD</h1>
          <p className="screen-sub" style={{ margin: 0 }}>
            {data?.me ? `Welcome ${data.me.name} — ${data.me.designation} (${data.me.pb})` : 'Performance & Workload Analytics'}
          </p>
        </div>
        <div className="ef-dashboard-total">
          Total eFiles Created: <strong>{dashboard?.totalFiles || c?.openFiles || 95}</strong>
        </div>
      </div>

      {error && <div className="banner banner-error">Could not load overview: {error}</div>}

      <div className="ef-dashboard">
        {/* Personal Analysis Section */}
        <div>
          <div className="ef-section-header personal">
            PERSONAL ANALYSIS
          </div>
          <div className="ef-charts-row" style={{ marginTop: 12 }}>
            <div className="ef-chart-card">
              <h3>YOUR WORK LOAD (Last 6 Months)</h3>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard?.workload || MOCK_WORKLOAD_DATA}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" style={{ fontSize: 11 }} />
                    <YAxis style={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="received" name="Received" fill="#0b3d6b" />
                    <Bar dataKey="cleared" name="Cleared" fill="#1e7d43" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="ef-chart-card">
              <h3>YOUR RATE OF CLEARANCE IN DAYS</h3>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard?.clearanceRate || MOCK_CLEARANCE_DATA}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" style={{ fontSize: 11 }} />
                    <YAxis style={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="days" name="Avg Days" fill="#8a6100" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Application Wide Analysis Section */}
        <div>
          <div className="ef-section-header app-wide">
            APPLICATION WIDE ANALYSIS
          </div>
          <div className="ef-stats-row" style={{ marginTop: 12 }}>
            <div className="ef-stat-card">
              <div className="stat-label">Opened in Last 30 Days</div>
              <div className="stat-value">{dashboard?.last30Opened || 38}</div>
            </div>
            <div className="ef-stat-card">
              <div className="stat-label">Closed in Last 30 Days</div>
              <div className="stat-value" style={{ color: '#1e7d43' }}>{dashboard?.last30Closed || 32}</div>
            </div>
            <div className="ef-stat-card">
              <div className="stat-label">Opened in Last 7 Days</div>
              <div className="stat-value">{dashboard?.last7Opened || 11}</div>
            </div>
            <div className="ef-stat-card">
              <div className="stat-label">Closed in Last 7 Days</div>
              <div className="stat-value" style={{ color: '#1e7d43' }}>{dashboard?.last7Closed || 9}</div>
            </div>
          </div>

          <div className="ef-chart-card" style={{ marginTop: 16 }}>
            <h3>TOTAL E-FILES CREATED TREND</h3>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboard?.trend || MOCK_TREND_DATA}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" style={{ fontSize: 11 }} />
                  <YAxis style={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="files" name="Total eFiles" stroke="#0e4474" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
