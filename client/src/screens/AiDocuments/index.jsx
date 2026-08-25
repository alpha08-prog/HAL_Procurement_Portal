import { useEffect, useState } from 'react';
import NoteRenderer from '../../components/NoteRenderer.jsx';
import { apiFetch } from '../../lib/api.js';

// Shows the documents produced by the AI noting pipeline (ai/outputs/). Pipe-delimited
// rows in the generated prose are rendered as real tables (see lib/noteFormat.js).
export default function AiDocuments() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('full');

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/ai/notes')
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const notes = data?.notes ?? [];
  const selected = notes.find((n) => n.stageId === selectedId) ?? notes[0] ?? null;

  return (
    <section className="screen">
      <h1 className="screen-title no-print">AI Documents</h1>

      {error ? (
        <div className="grid-empty">Could not load AI documents: {error}</div>
      ) : !data ? (
        <div className="grid-empty">Loading…</div>
      ) : !data.exists || notes.length === 0 ? (
        <div className="grid-empty">
          No AI outputs yet — run the pipeline (<code>python ai/run.py</code>) to generate documents.
        </div>
      ) : (
        <div className="ai-doc-layout">
          <aside className="ai-doc-sidebar no-print">
            <div className="ai-doc-sidebar-head">{data.item || 'Generated notes'}</div>
            <ul className="ai-doc-list">
              {notes.map((n) => (
                <li key={n.stageId}>
                  <button
                    type="button"
                    className={'ai-doc-item' + (selected?.stageId === n.stageId ? ' active' : '')}
                    onClick={() => setSelectedId(n.stageId)}
                  >
                    <span className="ai-doc-item-seq">{String(n.seq).padStart(2, '0')}</span>
                    <span className="ai-doc-item-title">{n.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="ai-doc-detail">
            <div className="ai-doc-toolbar no-print">
              <div className="ai-doc-modes" role="group" aria-label="View mode">
                <button
                  type="button"
                  className={'btn' + (mode === 'full' ? '' : ' btn-secondary')}
                  onClick={() => setMode('full')}
                >
                  Full note
                </button>
                <button
                  type="button"
                  className={'btn' + (mode === 'new' ? '' : ' btn-secondary')}
                  onClick={() => setMode('new')}
                >
                  New section
                </button>
              </div>
              <div className="ai-doc-actions">
                <button type="button" className="btn" onClick={() => window.print()}>
                  Download PDF
                </button>
              </div>
            </div>

            <div className="note-print-area">
              <NoteRenderer note={selected} mode={mode} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
