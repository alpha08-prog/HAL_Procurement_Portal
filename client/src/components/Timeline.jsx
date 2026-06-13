import { useEffect, useState } from 'react';
import { actionLabel } from '../config/historyMeta.js';
import { roleLabel } from '../config/roles.js';
import { formatDate } from '../lib/date.js';

// Read-only PA history timeline for the Screen 6 detail view. Fetches the ordered
// history array from the API (the same record that drives Screen 6's cycle-times).
export default function Timeline({ paNo }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/payment-advices/history?pa=${encodeURIComponent(paNo)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then((data) => !cancelled && setHistory(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [paNo]);

  if (error) return <div className="grid-empty">Could not load history: {error}</div>;
  if (!history) return <div className="grid-empty">Loading history…</div>;
  if (history.length === 0) return <div className="grid-empty">No history recorded.</div>;

  return (
    <ol className="timeline">
      {history.map((step, i) => (
        <li className="timeline-step" key={i}>
          <span className="timeline-dot" />
          <div className="timeline-content">
            <div className="timeline-head">
              <span className="timeline-action">{actionLabel(step.action)}</span>
              <span className="timeline-date">{formatDate(step.date)}</span>
            </div>
            <div className="timeline-actor">{roleLabel(step.by)}</div>
            {step.remark && <div className="timeline-remark">{step.remark}</div>}
            {step.pprNo && (
              <div className="timeline-ppr">
                CPPC PPR {step.pprNo} · {formatDate(step.pprDate)}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
