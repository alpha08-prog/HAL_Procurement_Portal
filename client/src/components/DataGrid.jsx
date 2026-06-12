// Config-driven grid: columns = [{ key, label, align?, render?(row) }].
// Screens pass column configs from src/config/ — never define columns inline here.
export default function DataGrid({ columns, rows, rowKey = 'id', emptyMessage = 'No records.' }) {
  if (!rows) {
    return <div className="grid-empty">Loading…</div>;
  }
  if (rows.length === 0) {
    return <div className="grid-empty">{emptyMessage}</div>;
  }

  return (
    <div className="grid-wrap">
      <table className="grid">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.align === 'right' ? 'align-right' : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((col) => (
                <td key={col.key} className={col.align === 'right' ? 'align-right' : undefined}>
                  {col.render ? col.render(row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
