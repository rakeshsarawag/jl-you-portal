import { useState, useMemo } from 'react';

export function usePagination<T>(items: T[], defaultPageSize = 20) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalItems = items.length;
  const paginatedItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize]
  );

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize);
    setCurrentPage(1);
  }

  function reset() {
    setCurrentPage(1);
  }

  return {
    currentPage,
    pageSize,
    totalItems,
    paginatedItems,
    onPageChange: setCurrentPage,
    onPageSizeChange: handlePageSizeChange,
    reset,
  };
}
