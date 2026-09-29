import { describe, it, expect, beforeEach } from "vitest";

// Pure pagination logic extracted from usePagination hook
function computeTotalPages(totalItems: number, pageSize: number): number {
  if (pageSize <= 0) return 0;
  if (totalItems === 0) return 0;
  return Math.ceil(totalItems / pageSize);
}

function getPageSlice<T>(items: T[], currentPage: number, pageSize: number): T[] {
  if (pageSize <= 0 || currentPage < 1) return [];
  const start = (currentPage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function clampPage(page: number, totalPages: number): number {
  if (totalPages === 0) return 1;
  return Math.min(Math.max(1, page), totalPages);
}

function nextPage(currentPage: number, totalPages: number): number {
  return clampPage(currentPage + 1, totalPages);
}

function prevPage(currentPage: number, totalPages: number): number {
  return clampPage(currentPage - 1, totalPages);
}

function gotoPage(page: number, totalPages: number): number {
  return clampPage(page, totalPages);
}

function resetPage(): number {
  return 1;
}

function handlePageSizeChange(newSize: number): { pageSize: number; currentPage: number } {
  return { pageSize: newSize, currentPage: 1 };
}

// Helpers
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

describe("computeTotalPages", () => {
  it("returns 0 for 0 items", () => {
    expect(computeTotalPages(0, 20)).toBe(0);
  });

  it("returns 1 for exactly pageSize items", () => {
    expect(computeTotalPages(20, 20)).toBe(1);
  });

  it("returns 2 for pageSize+1 items", () => {
    expect(computeTotalPages(21, 20)).toBe(2);
  });

  it("returns 1 for 1 item", () => {
    expect(computeTotalPages(1, 20)).toBe(1);
  });

  it("handles large datasets correctly", () => {
    expect(computeTotalPages(1000, 20)).toBe(50);
  });

  it("rounds up for non-even division", () => {
    expect(computeTotalPages(101, 10)).toBe(11);
  });

  it("returns 0 for invalid pageSize 0", () => {
    expect(computeTotalPages(100, 0)).toBe(0);
  });

  it("handles pageSize of 1 — each item on its own page", () => {
    expect(computeTotalPages(5, 1)).toBe(5);
  });
});

describe("getPageSlice", () => {
  const items = range(25);

  it("returns first page correctly", () => {
    expect(getPageSlice(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("returns second page correctly", () => {
    expect(getPageSlice(items, 2, 10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it("returns partial last page", () => {
    expect(getPageSlice(items, 3, 10)).toEqual([21, 22, 23, 24, 25]);
  });

  it("returns empty array for empty items", () => {
    expect(getPageSlice([], 1, 10)).toEqual([]);
  });

  it("returns all items when pageSize >= totalItems", () => {
    expect(getPageSlice(range(5), 1, 10)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns empty for page beyond total", () => {
    expect(getPageSlice(range(5), 99, 10)).toEqual([]);
  });

  it("returns empty for invalid page 0", () => {
    expect(getPageSlice(items, 0, 10)).toEqual([]);
  });

  it("returns empty for pageSize 0", () => {
    expect(getPageSlice(items, 1, 0)).toEqual([]);
  });
});

describe("page navigation", () => {
  describe("nextPage", () => {
    it("advances to next page", () => {
      expect(nextPage(1, 5)).toBe(2);
    });

    it("does not advance beyond last page", () => {
      expect(nextPage(5, 5)).toBe(5);
    });

    it("advances from second-to-last to last", () => {
      expect(nextPage(4, 5)).toBe(5);
    });
  });

  describe("prevPage", () => {
    it("goes to previous page", () => {
      expect(prevPage(3, 5)).toBe(2);
    });

    it("does not go below page 1", () => {
      expect(prevPage(1, 5)).toBe(1);
    });

    it("goes from second to first", () => {
      expect(prevPage(2, 5)).toBe(1);
    });
  });

  describe("gotoPage", () => {
    it("navigates to exact page", () => {
      expect(gotoPage(3, 5)).toBe(3);
    });

    it("clamps page below 1 to 1", () => {
      expect(gotoPage(0, 5)).toBe(1);
    });

    it("clamps page above max to last page", () => {
      expect(gotoPage(100, 5)).toBe(5);
    });

    it("allows first page", () => {
      expect(gotoPage(1, 5)).toBe(1);
    });

    it("allows last page", () => {
      expect(gotoPage(5, 5)).toBe(5);
    });
  });
});

describe("handlePageSizeChange", () => {
  it("resets currentPage to 1 when page size changes", () => {
    const result = handlePageSizeChange(50);
    expect(result.currentPage).toBe(1);
    expect(result.pageSize).toBe(50);
  });

  it("accepts page size of 10", () => {
    expect(handlePageSizeChange(10).pageSize).toBe(10);
  });
});

describe("resetPage", () => {
  it("always returns 1", () => {
    expect(resetPage()).toBe(1);
  });
});

describe("edge cases", () => {
  it("single item — page 1 of 1", () => {
    expect(computeTotalPages(1, 20)).toBe(1);
    expect(getPageSlice([42], 1, 20)).toEqual([42]);
  });

  it("exactly pageSize items fit on one page with no overflow", () => {
    const items = range(20);
    expect(computeTotalPages(20, 20)).toBe(1);
    expect(getPageSlice(items, 1, 20)).toHaveLength(20);
  });

  it("pageSize+1 items require exactly 2 pages", () => {
    const items = range(21);
    expect(computeTotalPages(21, 20)).toBe(2);
    expect(getPageSlice(items, 2, 20)).toEqual([21]);
  });
});
