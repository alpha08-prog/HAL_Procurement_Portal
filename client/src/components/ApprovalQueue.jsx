import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataGrid from './DataGrid.jsx';

// Shared approval queue for Screens 3 / 4 / 5. Everything screen-specific comes
// from a config object in src/config/ — do not fork this component per screen.
//
// config = {
//   title, note?, state,            // lifecycle state to fetch
//   backPath,                       // where "Verify & preview" returns to
//   emptyMessage?,
//   columns: [...DataGrid columns],
//   rowInputs: [{ key, placeholder, type? }],          // per-row capture fields
//   actions: [{ key, label, transition, primary?, requiredInputs? }]
// }
export default function ApprovalQueue({ config }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [inputs, setInputs] = useState({});
  const [busyPa, setBusyPa] = useState(null);

  const fetchRows = useCallback(() => {
    return fetch(`/api/payment-advices?state=${encodeURIComponent(config.state)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then(setRows)
      .catch((err) => setError(err.message));
  }, [config.state]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const inputValue = (paNo, key) => inputs[`${paNo}:${key}`] ?? '';
  const setInput = (paNo, key, value) =>
    setInputs((all) => ({ ...all, [`${paNo}:${key}`]: value }));

  const runTransition = async (row, action) => {
    setBusyPa(row.paNo);
    try {
      const body = { paNo: row.paNo, action: action.transition };
      for (const input of config.rowInputs ?? []) {
        body[input.key] = inputValue(row.paNo, input.key);
      }
      const res = await fetch('/api/payment-advices/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
      await fetchRows();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusyPa(null);
    }
  };

  const preview = (row) =>
    navigate(
      `/payment-advice?pa=${encodeURIComponent(row.paNo)}&back=${encodeURIComponent(config.backPath)}`
    );

  const actionsColumn = {
    key: 'actions',
    label: 'Actions',
    render: (row) => {
      const busy = busyPa === row.paNo;
      return (
        <div className="queue-actions">
          {(config.rowInputs ?? []).map((input) => (
            <input
              key={input.key}
              className="field-input queue-input"
              type={input.type ?? 'text'}
              placeholder={input.placeholder}
              value={inputValue(row.paNo, input.key)}
              disabled={busy}
              onChange={(e) => setInput(row.paNo, input.key, e.target.value)}
            />
          ))}
          <div className="queue-buttons">
            <button className="btn btn-secondary" onClick={() => preview(row)}>
              Verify &amp; preview
            </button>
            {(config.actions ?? []).map((action) => {
              const missing = (action.requiredInputs ?? []).filter(
                (key) => !inputValue(row.paNo, key).trim()
              );
              return (
                <button
                  key={action.key}
                  className={action.primary ? 'btn' : 'btn btn-secondary'}
                  disabled={busy || missing.length > 0}
                  title={missing.length > 0 ? `Requires: ${missing.join(', ')}` : undefined}
                  onClick={() => runTransition(row, action)}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
  };

  return (
    <section className="screen">
      <h1 className="screen-title">{config.title}</h1>
      {config.note && <p className="screen-note">{config.note}</p>}
      {error ? (
        <div className="grid-empty">Could not load queue: {error}</div>
      ) : (
        <DataGrid
          columns={[...config.columns, actionsColumn]}
          rows={rows}
          rowKey="paNo"
          emptyMessage={config.emptyMessage ?? 'Queue is empty.'}
        />
      )}
    </section>
  );
}
