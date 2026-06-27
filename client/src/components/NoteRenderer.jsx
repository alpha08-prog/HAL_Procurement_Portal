import { parseNote } from '../lib/noteFormat.js';

// Renders one AI-generated note: a meta block, the prose body (with pipe rows turned
// into real tables), and the deterministic annexures. Presentational only — the
// AiDocuments screen owns fetching, so this component is also safe to print.
const fmtValue = (v) => {
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return v == null || v === '' ? '—' : String(v);
};

const fmtLabel = (k) => k.replace(/_/g, ' ');

function FieldTable({ rows }) {
  return (
    <div className="grid-wrap">
      <table className="grid annex-grid">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{fmtLabel(k)}</th>
              <td>{fmtValue(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ block }) {
  if (block.type === 'heading') return <h3 className="note-heading">{block.text}</h3>;
  if (block.type === 'para') return <p className="note-para">{block.text}</p>;
  if (!block.rows?.length) return null; // never render an empty table
  return (
    <div className="grid-wrap">
      <table className="grid">
        {block.header && (
          <thead>
            <tr>
              {block.header.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((c, ci) => (
                <td key={ci}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function NoteRenderer({ note, mode = 'full' }) {
  if (!note) return null;
  const metaRows = Object.entries(note.meta || {});
  const blocks = parseNote(mode === 'new' ? note.newSection : note.fullOutput);

  return (
    <article className="note-doc">
      <div className="note-doc-head">
        <div className="note-doc-org">HINDUSTAN AERONAUTICS LIMITED</div>
        <div className="note-doc-sub">Aircraft Overhaul Division, Nashik</div>
        <h2 className="note-doc-title">{note.title}</h2>
      </div>

      {metaRows.length > 0 && <FieldTable rows={metaRows} />}

      <div className="note-body">
        {blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>

      {note.annexures?.length > 0 && (
        <div className="note-annexures">
          {note.annexures.map((a) => (
            <section key={a.id} className="note-annex">
              <h4 className="note-annex-title">Annexure — {a.format}</h4>
              <FieldTable rows={Object.entries(a.fields || {})} />
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
