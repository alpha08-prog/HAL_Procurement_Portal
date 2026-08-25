import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import CaptureModal from './CaptureModal.jsx';
import DataGrid from './DataGrid.jsx';

// Shared approval queue for Screens 3 / 4 / 5. Everything screen-specific comes
// from a config object in src/config/ — do not fork this component per screen.
//
// config = {
//   title, note?,
//   state | states,                 // one lifecycle state, or an array fetched together
//   backPath,                       // where a preview/"check" action returns to
//   emptyMessage?,
//   columns: [...DataGrid columns],
//   rowInputs?: [{ key, placeholder, type? }],         // inline per-row capture (Screen 3)
//   actions: [{
//     key, label, primary?,
//     when?: (row) => boolean,       // show this action only for matching rows
//     kind?: 'preview',              // 'preview' navigates to the read-only form
//     transition?,                   // state-machine action to fire
//     requiredInputs?: [inputKey],   // gate on inline rowInputs (Screen 3)
//     fields?: [...CaptureModal],    // if present, collect these in a modal first
//     modalTitle?, submitLabel?
//   }]
// }
export default function ApprovalQueue({ config }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [inputs, setInputs] = useState({});
  const [busyPa, setBusyPa] = useState(null);
  const [modal, setModal] = useState(null); // { row, action }

  const stateParam = Array.isArray(config.states)
    ? config.states.join(',')
    : config.states ?? config.state;

  const fetchRows = useCallback(() => {
    return apiFetch(`/api/payment-advices?state=${encodeURIComponent(stateParam)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then(setRows)
      .catch((err) => setError(err.message));
  }, [stateParam]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const inputValue = (paNo, key) => inputs[`${paNo}:${key}`] ?? '';
  const setInput = (paNo, key, value) =>
    setInputs((all) => ({ ...all, [`${paNo}:${key}`]: value }));

  // Fire a named transition. `extra` carries modal-captured values (PPR no/date,
  // remark) into the request body so the state machine stores them on the PA and
  // writes them to history. Returns true on success so the modal knows to close.
  const runTransition = async (row, action, extra = {}) => {
    setBusyPa(row.paNo);
    try {
      const body = { paNo: row.paNo, action: action.transition };
      for (const input of config.rowInputs ?? []) {
        body[input.key] = inputValue(row.paNo, input.key);
      }
      Object.assign(body, extra);
      const res = await apiFetch('/api/payment-advices/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
      await fetchRows();
      return true;
    } catch (err) {
      window.alert(err.message);
      return false;
    } finally {
      setBusyPa(null);
    }
  };

  const preview = (row) =>
    navigate(
      `/payment-advice?pa=${encodeURIComponent(row.paNo)}&back=${encodeURIComponent(config.backPath)}`
    );

  const previewForm = (row) =>
    navigate(
      `/payment-advice?pa=${encodeURIComponent(row.paNo)}&back=${encodeURIComponent(config.backPath)}&view=1`
    );

  const onAction = (row, action) => {
    if (action.kind === 'preview') return preview(row);
    if (action.kind === 'form_preview') return previewForm(row);
    if (action.fields) return setModal({ row, action });
    return runTransition(row, action);
  };

  const submitModal = async (values) => {
    const ok = await runTransition(modal.row, modal.action, values);
    if (ok) setModal(null);
  };

  // Screens that drive their own preview/"View record" action (Screen 4) suppress
  // the built-in button; Screen 3 keeps it by simply not declaring one.
  const hasPreviewAction = (config.actions ?? []).some((a) => a.kind === 'preview');

  const actionsColumn = {
    key: 'actions',
    label: 'Actions',
    render: (row) => {
      const busy = busyPa === row.paNo;
      const visibleActions = (config.actions ?? []).filter((a) => !a.when || a.when(row));
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
            {!hasPreviewAction && (
              <button className="btn btn-secondary" onClick={() => preview(row)}>
                Verify &amp; preview
              </button>
            )}
            {visibleActions.map((action) => {
              const missing = (action.requiredInputs ?? []).filter(
                (key) => !inputValue(row.paNo, key).trim()
              );
              return (
                <button
                  key={action.key}
                  className={action.primary ? 'btn' : 'btn btn-secondary'}
                  disabled={busy || missing.length > 0}
                  title={missing.length > 0 ? `Requires: ${missing.join(', ')}` : undefined}
                  onClick={() => onAction(row, action)}
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
      {modal && (
        <CaptureModal
          title={modal.action.modalTitle ?? modal.action.label}
          fields={modal.action.fields}
          submitLabel={modal.action.submitLabel ?? modal.action.label}
          busy={busyPa === modal.row.paNo}
          onSubmit={submitModal}
          onCancel={() => setModal(null)}
        />
      )}
    </section>
  );
}
