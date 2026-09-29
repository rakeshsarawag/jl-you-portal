import { describe, it, expect } from 'vitest';
import {
  deriveProjectHealth,
  getHealthResult,
  daysRemaining,
  budgetVariance,
  budgetOverrunPct,
  timeAgo,
  projectHealthScore,
} from '../../../src/app/utils/projectUtils';

describe('deriveProjectHealth', () => {
  // A project spanning 2010-01-01 to 2010-12-31 (entirely in the past)
  const pastStart = '2010-01-01';
  const pastEnd = '2010-12-31';

  // A project spanning 2000-01-01 to 2099-12-31 (very long, safe for future endDate)
  const distantFuture = '2099-12-31';
  const distantPast = '2000-01-01';

  it('returns Completed when status is "Completed"', () => {
    expect(deriveProjectHealth('Completed', distantPast, distantFuture, 50)).toBe('Completed');
  });

  it('returns Completed when completionPct >= 100 regardless of status', () => {
    expect(deriveProjectHealth('Active', distantPast, distantFuture, 100)).toBe('Completed');
    expect(deriveProjectHealth('Active', distantPast, distantFuture, 110)).toBe('Completed');
  });

  it('returns Delayed when past endDate and not completed', () => {
    expect(deriveProjectHealth('Active', pastStart, pastEnd, 50)).toBe('Delayed');
  });

  it('returns Delayed even when completionPct is 99 and past due', () => {
    expect(deriveProjectHealth('Active', pastStart, pastEnd, 99)).toBe('Delayed');
  });

  it('returns On Track for a normal in-progress project with plenty of time', () => {
    // Start 10 days ago, end 90 days from now → ~10% elapsed, plenty of buffer
    const start = new Date(Date.now() - 10 * 86_400_000).toISOString().split('T')[0];
    const end = new Date(Date.now() + 90 * 86_400_000).toISOString().split('T')[0];
    expect(deriveProjectHealth('Active', start, end, 50)).toBe('On Track');
  });

  it('returns At Risk when >85% elapsed and <70% done', () => {
    // 94% elapsed: start 94 days ago, end 6 days from now (total 100 days)
    const start = new Date(Date.now() - 94 * 86_400_000).toISOString().split('T')[0];
    const end = new Date(Date.now() + 6 * 86_400_000).toISOString().split('T')[0];
    expect(deriveProjectHealth('Active', start, end, 50)).toBe('At Risk');
  });

  it('returns On Track when >85% elapsed but completionPct >= 70', () => {
    const start = new Date(Date.now() - 94 * 86_400_000).toISOString().split('T')[0];
    const end = new Date(Date.now() + 6 * 86_400_000).toISOString().split('T')[0];
    expect(deriveProjectHealth('Active', start, end, 70)).toBe('On Track');
  });
});

describe('getHealthResult', () => {
  it('returns correct result for "On Track"', () => {
    const result = getHealthResult('On Track');
    expect(result.label).toBe('On Track');
    expect(result.color).toBe('text-green-700');
    expect(result.bg).toBe('bg-green-100');
    expect(result.dot).toBe('bg-green-500');
  });

  it('returns correct result for "At Risk"', () => {
    const result = getHealthResult('At Risk');
    expect(result.label).toBe('At Risk');
    expect(result.color).toBe('text-amber-700');
    expect(result.bg).toBe('bg-amber-100');
    expect(result.dot).toBe('bg-amber-500');
  });

  it('returns correct result for "Delayed"', () => {
    const result = getHealthResult('Delayed');
    expect(result.label).toBe('Delayed');
    expect(result.color).toBe('text-red-700');
    expect(result.bg).toBe('bg-red-100');
    expect(result.dot).toBe('bg-red-500');
  });

  it('returns correct result for "Completed"', () => {
    const result = getHealthResult('Completed');
    expect(result.label).toBe('Completed');
    expect(result.color).toBe('text-blue-700');
    expect(result.bg).toBe('bg-blue-100');
    expect(result.dot).toBe('bg-blue-500');
  });

  it('falls back to At Risk for unknown health label', () => {
    const result = getHealthResult('Unknown');
    expect(result.label).toBe('At Risk');
  });

  it('falls back to At Risk for empty string', () => {
    const result = getHealthResult('');
    expect(result.label).toBe('At Risk');
  });
});

describe('daysRemaining', () => {
  it('returns a positive number for a future end date', () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString().split('T')[0];
    expect(daysRemaining(future)).toBeGreaterThan(0);
  });

  it('returns approximately 10 for 10 days in the future', () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString().split('T')[0];
    const result = daysRemaining(future);
    expect(result).toBeGreaterThanOrEqual(9);
    expect(result).toBeLessThanOrEqual(10);
  });

  it('returns a negative number for a past end date', () => {
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString().split('T')[0];
    expect(daysRemaining(past)).toBeLessThan(0);
  });

  it('returns approximately -5 for 5 days in the past', () => {
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString().split('T')[0];
    const result = daysRemaining(past);
    expect(result).toBeGreaterThanOrEqual(-6);
    expect(result).toBeLessThanOrEqual(-4);
  });
});

describe('budgetVariance', () => {
  it('returns positive number when over budget (overrun)', () => {
    expect(budgetVariance(100000, 120000)).toBe(20000);
  });

  it('returns negative number when under budget (savings)', () => {
    expect(budgetVariance(100000, 80000)).toBe(-20000);
  });

  it('returns 0 when exactly on budget', () => {
    expect(budgetVariance(50000, 50000)).toBe(0);
  });
});

describe('budgetOverrunPct', () => {
  it('returns 0 when under budget', () => {
    expect(budgetOverrunPct(100000, 80000)).toBe(0);
  });

  it('returns 0 when exactly on budget', () => {
    expect(budgetOverrunPct(100000, 100000)).toBe(0);
  });

  it('returns correct percentage when over budget', () => {
    // (120000 - 100000) / 100000 * 100 = 20%
    expect(budgetOverrunPct(100000, 120000)).toBe(20);
  });

  it('returns 50% for 50% overrun', () => {
    expect(budgetOverrunPct(100000, 150000)).toBe(50);
  });

  it('returns 0 when allocated is 0 to avoid division by zero', () => {
    expect(budgetOverrunPct(0, 5000)).toBe(0);
  });
});

describe('timeAgo', () => {
  it('returns seconds ago for recent time (< 60s)', () => {
    const iso = new Date(Date.now() - 30 * 1000).toISOString();
    expect(timeAgo(iso)).toBe('30s ago');
  });

  it('returns minutes ago for time < 1 hour ago', () => {
    const iso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(iso)).toBe('5m ago');
  });

  it('returns hours ago for time < 1 day ago', () => {
    const iso = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(timeAgo(iso)).toBe('3h ago');
  });

  it('returns days ago for time >= 1 day ago', () => {
    const iso = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(timeAgo(iso)).toBe('2d ago');
  });

  it('returns days ago for many days ago', () => {
    const iso = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    expect(timeAgo(iso)).toBe('30d ago');
  });
});

describe('projectHealthScore', () => {
  it('returns 50 when no milestones exist', () => {
    expect(projectHealthScore(0, 0, 10, 30)).toBe(50);
  });

  it('returns 100 when all milestones done and half time remains', () => {
    // completionRatio=1, timeRatio=0.5 → (1*0.7 + 0.5*0.3)*100 = (0.7+0.15)*100 = 85
    expect(projectHealthScore(5, 5, 15, 30)).toBe(85);
  });

  it('returns 70 when all milestones done but no time left', () => {
    // completionRatio=1, timeRatio=0 → (1*0.7 + 0*0.3)*100 = 70
    expect(projectHealthScore(4, 4, 0, 30)).toBe(70);
  });

  it('returns 0 when no milestones done and no time left', () => {
    // completionRatio=0, timeRatio=0 → 0
    expect(projectHealthScore(4, 0, 0, 30)).toBe(0);
  });

  it('returns correct score for partial completion with time remaining', () => {
    // 3 of 5 done = 0.6, 15 of 30 days left = 0.5
    // (0.6*0.7 + 0.5*0.3)*100 = (0.42 + 0.15)*100 = 57
    expect(projectHealthScore(5, 3, 15, 30)).toBe(57);
  });

  it('clamps timeRatio to 0 when daysLeft is negative', () => {
    // daysLeft < 0 → timeRatio = 0; completionRatio = 0.5
    // (0.5*0.7 + 0*0.3)*100 = 35
    expect(projectHealthScore(4, 2, -5, 30)).toBe(35);
  });

  it('returns 0 when totalDays is 0 (timeRatio = 0) and no completion', () => {
    // completionRatio=0, timeRatio=0 → 0
    expect(projectHealthScore(4, 0, 5, 0)).toBe(0);
  });
});
