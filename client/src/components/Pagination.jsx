import { useMemo } from 'react';

/**
 * Reusable Pagination component
 * @param {Object} props
 * @param {number} props.currentPage - Current active page (1-based)
 * @param {number} props.totalItems - Total number of items across all pages
 * @param {number} [props.pageSize=20] - Number of items per page (default 20)
 * @param {Function} props.onPageChange - Callback when page changes (newPage) => void
 * @param {Function} [props.onPageSizeChange] - Optional callback when page size changes
 * @param {number[]} [props.pageSizeOptions=[20, 50, 100]] - Array of available page size options
 * @param {boolean} [props.showTotalInfo=true] - Whether to display "Showing X to Y of Z entries"
 * @param {string} [props.className=''] - Additional CSS class names
 */
export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
  showTotalInfo = true,
  className = ''
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  // Generate page numbers with ellipsis window
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (safePage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (safePage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
  }, [safePage, totalPages]);

  const handlePageClick = (page) => {
    if (typeof page === 'number' && page !== safePage && page >= 1 && page <= totalPages) {
      onPageChange?.(page);
    }
  };

  return (
    <div className={`pagination-container ${className}`}>
      {showTotalInfo && (
        <div className="pagination-info">
          {totalItems > 0 ? (
            <>
              Showing <strong>{startItem.toLocaleString('en-IN')}</strong>–<strong>{endItem.toLocaleString('en-IN')}</strong> of{' '}
              <strong>{totalItems.toLocaleString('en-IN')}</strong> records
            </>
          ) : (
            <span>No records</span>
          )}
        </div>
      )}

      <div className="pagination-right">
        {onPageSizeChange && pageSizeOptions?.length > 0 && (
          <div className="pagination-size-wrap">
            <label className="pagination-size-label">
              <span>Per page:</span>
              <select
                className="pagination-size-select"
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  onPageSizeChange(newSize);
                  onPageChange?.(1);
                }}
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <nav className="pagination-controls" aria-label="Table pagination">
          <button
            type="button"
            className="pagination-btn pagination-nav-btn"
            onClick={() => handlePageClick(1)}
            disabled={safePage === 1 || totalItems === 0}
            title="First page"
            aria-label="First page"
          >
            «
          </button>
          <button
            type="button"
            className="pagination-btn pagination-nav-btn"
            onClick={() => handlePageClick(safePage - 1)}
            disabled={safePage === 1 || totalItems === 0}
            title="Previous page"
            aria-label="Previous page"
          >
            ‹
          </button>

          <div className="pagination-pages">
            {pageNumbers.map((p, idx) =>
              p === '...' ? (
                <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`pagination-btn pagination-num-btn ${p === safePage ? 'active' : ''}`}
                  onClick={() => handlePageClick(p)}
                  aria-current={p === safePage ? 'page' : undefined}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            className="pagination-btn pagination-nav-btn"
            onClick={() => handlePageClick(safePage + 1)}
            disabled={safePage === totalPages || totalItems === 0}
            title="Next page"
            aria-label="Next page"
          >
            ›
          </button>
          <button
            type="button"
            className="pagination-btn pagination-nav-btn"
            onClick={() => handlePageClick(totalPages)}
            disabled={safePage === totalPages || totalItems === 0}
            title="Last page"
            aria-label="Last page"
          >
            »
          </button>
        </nav>
      </div>
    </div>
  );
}
