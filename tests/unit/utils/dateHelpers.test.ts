import { describe, it, expect } from 'vitest';

// Helpers extracted/inlined for testing — mirror the logic in the codebase

function formatDate(date: Date | string, locale = 'en-IN'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysBetween(a: Date | string, b: Date | string): number {
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.round(Math.abs(msB - msA) / 86_400_000);
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function financialYear(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-indexed; April = 3
  return m >= 3 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
}

function monthsWorked(joiningDate: string, uptoDate?: string): number {
  const start = new Date(joiningDate);
  const end = uptoDate ? new Date(uptoDate) : new Date();
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2025-01-15');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2025/);
  });

  it('formats Date object', () => {
    const result = formatDate(new Date(2025, 5, 1)); // June 1
    expect(result).toMatch(/2025/);
  });

  it('handles end of year', () => {
    const result = formatDate('2025-12-31');
    expect(result).toMatch(/2025/);
  });
});

describe('daysBetween', () => {
  it('returns 0 for same date', () => {
    expect(daysBetween('2025-06-01', '2025-06-01')).toBe(0);
  });

  it('returns 1 for consecutive days', () => {
    expect(daysBetween('2025-06-01', '2025-06-02')).toBe(1);
  });

  it('is symmetric', () => {
    const a = daysBetween('2025-01-01', '2025-12-31');
    const b = daysBetween('2025-12-31', '2025-01-01');
    expect(a).toBe(b);
  });

  it('counts leap year day', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
  });

  it('returns 365 for non-leap year', () => {
    expect(daysBetween('2025-01-01', '2026-01-01')).toBe(365);
  });
});

describe('isExpired', () => {
  it('returns true for past date', () => {
    expect(isExpired('2020-01-01T00:00:00Z')).toBe(true);
  });

  it('returns false for future date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(isExpired(future.toISOString())).toBe(false);
  });
});

describe('addDays', () => {
  it('adds 7 days correctly', () => {
    const base = new Date('2025-06-01');
    const result = addDays(base, 7);
    expect(result.getDate()).toBe(8);
    expect(result.getMonth()).toBe(5); // June
  });

  it('wraps into next month', () => {
    const base = new Date('2025-01-30');
    const result = addDays(base, 5);
    expect(result.getMonth()).toBe(1); // February
  });

  it('does not mutate the original', () => {
    const base = new Date('2025-06-01');
    addDays(base, 10);
    expect(base.getDate()).toBe(1);
  });
});

describe('startOfMonth / endOfMonth', () => {
  it('startOfMonth returns day 1', () => {
    const d = new Date('2025-06-15');
    expect(startOfMonth(d).getDate()).toBe(1);
    expect(startOfMonth(d).getMonth()).toBe(5);
  });

  it('endOfMonth returns last day of month', () => {
    expect(endOfMonth(new Date('2025-02-10')).getDate()).toBe(28);
    expect(endOfMonth(new Date('2024-02-10')).getDate()).toBe(29); // leap
    expect(endOfMonth(new Date('2025-01-01')).getDate()).toBe(31);
  });
});

describe('financialYear', () => {
  it('April–March maps to current FY', () => {
    expect(financialYear(new Date('2025-04-01'))).toBe('2025-26');
    expect(financialYear(new Date('2025-03-31'))).toBe('2024-25');
    expect(financialYear(new Date('2025-10-15'))).toBe('2025-26');
  });

  it('January is previous FY', () => {
    expect(financialYear(new Date('2025-01-01'))).toBe('2024-25');
  });
});

describe('monthsWorked', () => {
  it('returns 0 for same month', () => {
    expect(monthsWorked('2025-06-01', '2025-06-30')).toBe(0);
  });

  it('returns 12 for exactly one year', () => {
    expect(monthsWorked('2024-06-01', '2025-06-01')).toBe(12);
  });

  it('returns correct partial months', () => {
    expect(monthsWorked('2025-01-01', '2025-04-01')).toBe(3);
  });
});
