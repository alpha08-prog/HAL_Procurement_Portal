import { ROUTE_ACTION_LABEL } from '../config/notingColumns.jsx';

// Read-only routing trail for a note: who sent it to whom, the action, and any comment.
export default function RoutingTimeline({ steps }) {
  if (!steps || steps.length === 0) {
    return <div className="grid-empty">Not yet routed.</div>;
  }
  return (
    <ol className="route-log">
      {steps.map((s) => (
        <li key={s.seq} className={`route-step route-step-${s.state}`}>
          <div className="route-step-head">
            <span className="route-step-action">{ROUTE_ACTION_LABEL[s.action] || s.action || s.purpose}</span>
            <span className="route-step-who">
              {s.from_name}
              {s.to_name && s.to_id !== s.from_id ? ` → ${s.to_name}` : ''}
            </span>
            <span className="route-step-date">{s.actioned_at || s.opened_at || s.sent_at}</span>
          </div>
          {s.comment && <div className="route-step-comment">{s.comment}</div>}
          {s.state === 'sent' && <div className="route-step-flag">Awaiting — not yet opened</div>}
          {s.state === 'retracted' && <div className="route-step-flag">Retracted</div>}
        </li>
      ))}
    </ol>
  );
}
