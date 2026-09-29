/**
 * Project Management Business Logic Utilities
 * Centralised functions for health scoring, days remaining, budget overrun, etc.
 * All project components should import from here instead of duplicating inline.
 */

export type ProjectHealth = 'On Track' | 'At Risk' | 'Delayed' | 'Completed';

export interface HealthResult {
  label: ProjectHealth;
  color: string;    // Tailwind text class
  bg: string;       // Tailwind bg class
  dot: string;      // Tailwind dot bg class
}

const HEALTH_MAP: Record<ProjectHealth, HealthResult> = {
  'On Track':  { label: 'On Track',  color: 'text-green-700',  bg: 'bg-green-100',  dot: 'bg-green-500'  },
  'At Risk':   { label: 'At Risk',   color: 'text-amber-700',  bg: 'bg-amber-100',  dot: 'bg-amber-500'  },
  'Delayed':   { label: 'Delayed',   color: 'text-red-700',    bg: 'bg-red-100',    dot: 'bg-red-500'    },
  'Completed': { label: 'Completed', color: 'text-blue-700',   bg: 'bg-blue-100',   dot: 'bg-blue-500'   },
};

export function getHealthResult(health: string): HealthResult {
  return HEALTH_MAP[health as ProjectHealth] ?? HEALTH_MAP['At Risk'];
}

/**
 * Derive a health status from raw project data.
 * Rules: completed → Completed; past due → Delayed; >85% elapsed with <70% done → At Risk; else On Track.
 */
export function deriveProjectHealth(
  status: string,
  startDate: string,
  endDate: string,
  completionPct: number,
): ProjectHealth {
  if (status === 'Completed' || completionPct >= 100) return 'Completed';
  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (now > end) return 'Delayed';
  const elapsed = (now - start) / (end - start);
  if (elapsed > 0.85 && completionPct < 70) return 'At Risk';
  return 'On Track';
}

/** Days remaining until the project due date. */
export function daysRemaining(endDate: string): number {
  return Math.round((new Date(endDate).getTime() - Date.now()) / 86_400_000);
}

/** Budget variance: positive = overrun. */
export function budgetVariance(allocated: number, spent: number): number {
  return spent - allocated;
}

/** Budget overrun percentage (0–∞). */
export function budgetOverrunPct(allocated: number, spent: number): number {
  if (!allocated) return 0;
  return Math.max(0, (spent - allocated) / allocated) * 100;
}

/** Human-readable time-ago string. */
export function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Compute a simple project health score (0–100) from milestone completion. */
export function projectHealthScore(
  totalMilestones: number,
  completedMilestones: number,
  daysLeft: number,
  totalDays: number,
): number {
  if (!totalMilestones) return 50;
  const completionRatio = completedMilestones / totalMilestones;
  const timeRatio = totalDays > 0 ? Math.max(0, daysLeft / totalDays) : 0;
  return Math.round((completionRatio * 0.7 + timeRatio * 0.3) * 100);
}
