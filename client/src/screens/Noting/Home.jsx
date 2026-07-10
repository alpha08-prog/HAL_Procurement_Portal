import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchOverview } from '../../lib/notingApi.js';

// Landing screen for Module C (e-File Noting). Phase 0: greets the current member,
// shows store counts, and previews the workflow being built out phase by phase.
export default function NotingHome() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchOverview()
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const c = data?.counts;

  return (
    <section className="screen">
      <h1 className="screen-title">e-File Noting</h1>
      <p className="screen-sub">
        {data?.me
          ? `Signed in as ${data.me.name} — ${data.me.designation} (${data.me.pb})`
          : 'AI-assisted procurement note generation, routing & approval.'}
      </p>

      {error && <div className="grid-empty">Could not load noting overview: {error}</div>}

      {c && (
        <div className="metric-cards">
          <div className="metric-card">
            <div className="metric-value">{c.openFiles}</div>
            <div className="metric-label">Open Files</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{c.notes}</div>
            <div className="metric-label">Notes</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{c.members}</div>
            <div className="metric-label">Members</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{c.units}</div>
            <div className="metric-label">Org Units</div>
          </div>
        </div>
      )}

      <div className="note-roadmap">
        <h2 className="section-heading">Workflow</h2>
        <ul className="roadmap-list">
          <li><Link to="/noting/org">Organisation directory</Link> — Corporate › Complex › Division › Department › Section › member <span className="tag tag-live">Live</span></li>
          <li>Initiate Note (N1) — AI-drafted or standalone, with connected File / Reference / Transaction IDs <span className="tag">Next</span></li>
          <li>Route to members — inbox, forward, add member, send back, retract <span className="tag">Planned</span></li>
          <li>Classification &amp; need-to-know access <span className="tag">Planned</span></li>
          <li>Comments &amp; clarifications <span className="tag">Planned</span></li>
          <li>Cabinet, reports &amp; org-wide visibility <span className="tag">Planned</span></li>
        </ul>
      </div>
    </section>
  );
}
