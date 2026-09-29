import { describe, it, expect } from 'vitest';
import {
  getProgressBand,
  getOkrGrade,
  GRADE_COLORS,
  clampProgress,
  aggregateProgress,
  daysUntil,
} from '../../../src/app/utils/okrUtils';

describe('getProgressBand', () => {
  it('returns Achieved for progress >= 0.70', () => {
    expect(getProgressBand(0.70).label).toBe('Achieved');
  });

  it('returns Achieved for progress = 1.0', () => {
    expect(getProgressBand(1.0).label).toBe('Achieved');
  });

  it('returns Achieved for progress = 0.95', () => {
    expect(getProgressBand(0.95).label).toBe('Achieved');
  });

  it('returns On Track for progress = 0.60', () => {
    expect(getProgressBand(0.60).label).toBe('On Track');
  });

  it('returns On Track for progress = 0.65', () => {
    expect(getProgressBand(0.65).label).toBe('On Track');
  });

  it('returns On Track for progress just below Achieved threshold (0.699)', () => {
    expect(getProgressBand(0.699).label).toBe('On Track');
  });

  it('returns Progressing for progress = 0.40', () => {
    expect(getProgressBand(0.40).label).toBe('Progressing');
  });

  it('returns Progressing for progress = 0.55', () => {
    expect(getProgressBand(0.55).label).toBe('Progressing');
  });

  it('returns Progressing for progress just below On Track threshold (0.599)', () => {
    expect(getProgressBand(0.599).label).toBe('Progressing');
  });

  it('returns Behind for progress = 0', () => {
    expect(getProgressBand(0).label).toBe('Behind');
  });

  it('returns Behind for progress = 0.39', () => {
    expect(getProgressBand(0.39).label).toBe('Behind');
  });

  it('returns Behind for progress = 0.20', () => {
    expect(getProgressBand(0.20).label).toBe('Behind');
  });

  it('returns correct Tailwind classes for Achieved band', () => {
    const band = getProgressBand(0.80);
    expect(band.color).toBe('text-emerald-700');
    expect(band.bg).toBe('bg-emerald-100');
    expect(band.barColor).toBe('bg-emerald-500');
  });

  it('returns correct Tailwind classes for On Track band', () => {
    const band = getProgressBand(0.60);
    expect(band.color).toBe('text-lime-700');
    expect(band.bg).toBe('bg-lime-100');
    expect(band.barColor).toBe('bg-lime-500');
  });

  it('returns correct Tailwind classes for Progressing band', () => {
    const band = getProgressBand(0.50);
    expect(band.color).toBe('text-amber-700');
    expect(band.bg).toBe('bg-amber-100');
    expect(band.barColor).toBe('bg-amber-500');
  });

  it('returns correct Tailwind classes for Behind band', () => {
    const band = getProgressBand(0.10);
    expect(band.color).toBe('text-red-700');
    expect(band.bg).toBe('bg-red-100');
    expect(band.barColor).toBe('bg-red-500');
  });
});

describe('getOkrGrade', () => {
  it('returns A for progress >= 0.80', () => {
    expect(getOkrGrade(0.80)).toBe('A');
  });

  it('returns A for progress = 1.0', () => {
    expect(getOkrGrade(1.0)).toBe('A');
  });

  it('returns B for progress = 0.60', () => {
    expect(getOkrGrade(0.60)).toBe('B');
  });

  it('returns B for progress just below A (0.799)', () => {
    expect(getOkrGrade(0.799)).toBe('B');
  });

  it('returns C for progress = 0.40', () => {
    expect(getOkrGrade(0.40)).toBe('C');
  });

  it('returns C for progress just below B (0.599)', () => {
    expect(getOkrGrade(0.599)).toBe('C');
  });

  it('returns D for progress = 0.20', () => {
    expect(getOkrGrade(0.20)).toBe('D');
  });

  it('returns D for progress just below C (0.399)', () => {
    expect(getOkrGrade(0.399)).toBe('D');
  });

  it('returns F for progress < 0.20', () => {
    expect(getOkrGrade(0.19)).toBe('F');
  });

  it('returns F for progress = 0', () => {
    expect(getOkrGrade(0)).toBe('F');
  });

  it('returns F for progress = 0.10', () => {
    expect(getOkrGrade(0.10)).toBe('F');
  });
});

describe('GRADE_COLORS', () => {
  it('has all 5 grade keys', () => {
    expect(Object.keys(GRADE_COLORS)).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D', 'F']));
    expect(Object.keys(GRADE_COLORS)).toHaveLength(5);
  });

  it('A has correct Tailwind class', () => {
    expect(GRADE_COLORS['A']).toBe('bg-green-100 text-green-700');
  });

  it('B has correct Tailwind class', () => {
    expect(GRADE_COLORS['B']).toBe('bg-blue-100 text-blue-700');
  });

  it('C has correct Tailwind class', () => {
    expect(GRADE_COLORS['C']).toBe('bg-yellow-100 text-yellow-700');
  });

  it('D has correct Tailwind class', () => {
    expect(GRADE_COLORS['D']).toBe('bg-orange-100 text-orange-700');
  });

  it('F has correct Tailwind class', () => {
    expect(GRADE_COLORS['F']).toBe('bg-red-100 text-red-700');
  });
});

describe('clampProgress', () => {
  it('returns 0 for input 0', () => {
    expect(clampProgress(0)).toBe(0);
  });

  it('returns 1 for input 1', () => {
    expect(clampProgress(1)).toBe(1);
  });

  it('clamps values > 1 to 1', () => {
    expect(clampProgress(1.5)).toBe(1);
    expect(clampProgress(2)).toBe(1);
  });

  it('clamps negative values to 0', () => {
    expect(clampProgress(-0.5)).toBe(0);
    expect(clampProgress(-10)).toBe(0);
  });

  it('passes through decimal values in range', () => {
    expect(clampProgress(0.5)).toBe(0.5);
    expect(clampProgress(0.75)).toBe(0.75);
  });
});

describe('aggregateProgress', () => {
  it('returns 0 for empty array', () => {
    expect(aggregateProgress([])).toBe(0);
  });

  it('computes simple average when no weights specified', () => {
    const result = aggregateProgress([
      { progress: 0.6 },
      { progress: 0.4 },
    ]);
    expect(result).toBeCloseTo(0.5);
  });

  it('computes weighted average with custom weights', () => {
    const result = aggregateProgress([
      { progress: 0.8, weight: 2 },
      { progress: 0.2, weight: 1 },
    ]);
    // (0.8*2 + 0.2*1) / (2+1) = (1.6 + 0.2) / 3 = 1.8/3 = 0.6
    expect(result).toBeCloseTo(0.6);
  });

  it('treats missing weight as 1', () => {
    const result = aggregateProgress([
      { progress: 1.0, weight: 1 },
      { progress: 0.0 },
    ]);
    // (1.0*1 + 0.0*1) / 2 = 0.5
    expect(result).toBeCloseTo(0.5);
  });

  it('clamps result to 1 when aggregate exceeds 1', () => {
    const result = aggregateProgress([
      { progress: 1.5, weight: 1 },
    ]);
    expect(result).toBe(1);
  });

  it('clamps result to 0 when aggregate is negative', () => {
    const result = aggregateProgress([
      { progress: -0.5, weight: 1 },
    ]);
    expect(result).toBe(0);
  });

  it('handles single item correctly', () => {
    const result = aggregateProgress([{ progress: 0.75 }]);
    expect(result).toBeCloseTo(0.75);
  });

  it('handles all zeros', () => {
    const result = aggregateProgress([
      { progress: 0 },
      { progress: 0 },
    ]);
    expect(result).toBe(0);
  });

  it('handles all ones', () => {
    const result = aggregateProgress([
      { progress: 1 },
      { progress: 1 },
    ]);
    expect(result).toBe(1);
  });
});

describe('daysUntil', () => {
  it('returns a positive number for a future date', () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
    expect(daysUntil(future)).toBeGreaterThan(0);
  });

  it('returns approximately 10 for 10 days in the future', () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const result = daysUntil(future);
    expect(result).toBeGreaterThanOrEqual(9);
    expect(result).toBeLessThanOrEqual(10);
  });

  it('returns a negative number for a past date', () => {
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString();
    expect(daysUntil(past)).toBeLessThan(0);
  });

  it('returns approximately -5 for 5 days in the past', () => {
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const result = daysUntil(past);
    expect(result).toBeGreaterThanOrEqual(-5);
    expect(result).toBeLessThanOrEqual(-4);
  });

  it('returns approximately 0 for today', () => {
    const now = new Date().toISOString();
    const result = daysUntil(now);
    expect(Math.abs(result)).toBeLessThanOrEqual(1);
  });

  it('accepts a Date object', () => {
    const future = new Date(Date.now() + 7 * 86_400_000);
    const result = daysUntil(future);
    expect(result).toBeGreaterThanOrEqual(6);
    expect(result).toBeLessThanOrEqual(7);
  });
});
