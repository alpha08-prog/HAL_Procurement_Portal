// Draws a rendered format (server/formats/render.js output) as a HAL document. Presentational
// only: every value, blank and rupee figure arrives already substituted in `rendered.blocks`.
// Used by the Portal Hub format tools, the contract annexures (embedded) and printable views.
export default function FormatDocument({ rendered, embedded = false }) {
  if (!rendered) return null;
  return (
    <article className={embedded ? 'fmt-doc fmt-embedded' : 'note-doc fmt-doc'}>
      {!embedded && (
        <div className="note-doc-head">
          <div className="note-doc-org">HINDUSTAN AERONAUTICS LIMITED</div>
          <div className="note-doc-sub">Aircraft Overhaul Division, Nashik</div>
          <h2 className="note-doc-title">{rendered.title}</h2>
          <div className="fmt-code">{rendered.code}</div>
        </div>
      )}
      {!rendered.verified && (
        <div className="fmt-pending-banner">
          <strong>Template not on file.</strong> {rendered.note || 'HAL to supply the official format; the fields below are a working draft.'}
        </div>
      )}
      {rendered.blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
      {!embedded && rendered.source && <div className="fmt-source no-print">Source: {rendered.source}</div>}
    </article>
  );
}

function Block({ block }) {
  switch (block.type) {
    case 'heading':
      return <h3 className="note-heading">{block.text}</h3>;
    case 'para':
      return <p className="note-para fmt-para">{block.text}</p>;
    case 'note':
      return <p className="fmt-note">{block.text}</p>;
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <div className="fmt-list">
          {block.title && <div className="fmt-list-title">{block.title}</div>}
          {block.empty ? (
            <p className="fmt-note">— no entries —</p>
          ) : (
            <Tag className="fmt-list-items">
              {block.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </Tag>
          )}
          {block.note && <p className="fmt-note">{block.note}</p>}
        </div>
      );
    }
    case 'fields':
      return (
        <div className="grid-wrap">
          <table className="grid annex-grid fmt-fields-table">
            <tbody>
              {block.rows.map((r, i) => (
                <tr key={i}>
                  <th scope="row">
                    {r.label}
                    {r.hint && <div className="fmt-hint">{r.hint}</div>}
                  </th>
                  <td className={r.missing ? 'fmt-missing' : undefined}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'table':
      return (
        <div className="fmt-table">
          {block.title && <div className="fmt-list-title">{block.title}</div>}
          <div className="grid-wrap">
            <table className="grid">
              {block.header?.length > 0 && (
                <thead>
                  <tr>
                    {block.header.map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {block.empty ? (
                  <tr>
                    <td colSpan={Math.max(1, block.header?.length || 1)} className="fmt-note">
                      — no rows entered —
                    </td>
                  </tr>
                ) : (
                  block.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((c, ci) => (
                        <td key={ci}>{c}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    case 'signature':
      return (
        <div className="fmt-signatures">
          {block.parties.map((p, i) => (
            <div key={i} className="fmt-party">
              <div className="fmt-party-label">{p.label}</div>
              {p.lines.map((l, j) => (
                <div key={j} className="fmt-party-line">
                  {l}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}
