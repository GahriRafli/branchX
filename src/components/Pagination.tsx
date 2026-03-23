import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  itemName?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  itemName = 'entries'
}: PaginationProps) {
  if (totalItems <= itemsPerPage) return null; // hide if <= page capacity

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const pages = getPageNumbers();
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="pagination">
      <div className="pagination-info">
        Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of <strong>{totalItems}</strong> {itemName}
      </div>
      <div className="pagination-numbers">
        <button 
          className="pagination-btn" 
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
        >
          First
        </button>
        <button 
          className="pagination-btn" 
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          &laquo; Prev
        </button>

        {pages.map((p, idx) => (
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className="pagination-ellipsis" style={{ padding: '0 8px', color: 'var(--text-tertiary)' }}>...</span>
          ) : (
            <button
              key={idx}
              className={`pagination-btn ${p === currentPage ? 'active' : ''}`}
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </button>
          )
        ))}

        <button 
          className="pagination-btn" 
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next &raquo;
        </button>
        <button 
          className="pagination-btn" 
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          Last
        </button>
      </div>
    </div>
  );
}
