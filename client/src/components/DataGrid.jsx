import { useEffect, useState } from 'react';
import Pagination from './Pagination.jsx';

// Config-driven grid: columns = [{ key, label, align?, render?(row) }].
// Screens pass column configs from src/config/ — never define columns inline here.
export default function DataGrid({
  columns,
  rows,
  rowKey = 'id',
  emptyMessage = 'No records.',
  pageSize = 20,
  pagination = true,
  page: controlledPage,
  onPageChange: controlledOnPageChange,
  pageSizeOptions = [20, 50, 100],
  showPageSizeSelect = true
}) {
  const [localPage, setLocalPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(pageSize);

  const isControlled = controlledPage !== undefined;
  const currentPage = isControlled ? controlledPage : localPage;
  const handlePageChange = isControlled ? controlledOnPageChange : setLocalPage;

  // Reset to page 1 if rows count changes and current page would be out of bounds
  useEffect(() => {
    if (!rows) return;
    const totalPages = Math.max(1, Math.ceil(rows.length / localPageSize));
    if (currentPage > totalPages) {
      if (!isControlled) {
        setLocalPage(1);
      } else {
        controlledOnPageChange?.(1);
      }
    }
  }, [rows, localPageSize, currentPage, isControlled, controlledOnPageChange]);

  if (!rows) {
    return <div className="grid-empty">Loading…</div>;
  }
  if (rows.length === 0) {
    return <div className="grid-empty">{emptyMessage}</div>;
  }

  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, Math.ceil(rows.length / localPageSize)));
  const displayedRows = pagination
    ? rows.slice((safePage - 1) * localPageSize, safePage * localPageSize)
    : rows;

  return (
    <div className="grid-container">
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
            {displayedRows.map((row, index) => {
              const keyVal = row[rowKey] !== undefined ? row[rowKey] : index;
              return (
                <tr key={keyVal}>
                  {columns.map((col) => (
                    <td key={col.key} className={col.align === 'right' ? 'align-right' : undefined}>
                      {col.render ? col.render(row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="grid-footer">
          <Pagination
            currentPage={safePage}
            totalItems={rows.length}
            pageSize={localPageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={showPageSizeSelect ? setLocalPageSize : undefined}
            pageSizeOptions={pageSizeOptions}
          />
        </div>
      )}
    </div>
  );
}
