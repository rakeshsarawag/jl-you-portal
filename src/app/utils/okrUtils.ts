/**
 * OKR Business Logic Utilities
 * Centralised functions for OKR progress, grading, and band calculation.
 * All components should import from here instead of duplicating inline.
 */

export type ProgressBand = 'Achieved' | 'On Track' | 'Progressing' | 'Behind';

export interface BandResult {
  label: ProgressBand;
  color: string;       // Tailwind text class
  bg: string;          // Tailwind background class
  barColor: string;    // Tailwind bar fill class
}

const BANDS: { threshold: number; result: BandResult }[] = [
  { threshold: 0.70, result: { label: 'Achieved',    color: 'text-emerald-700', bg: 'bg-emerald-100', barColor: 'bg-emerald-500' } },
  { threshold: 0.60, result: { label: 'On Track',    color: 'text-lime-700',    bg: 'bg-lime-100',    barColor: 'bg-lime-500'    } },
  { threshold: 0.40, result: { label: 'Progressing', color: 'text-amber-700',   bg: 'bg-amber-100',   barColor: 'bg-amber-500'   } },
  { threshold: 0,    result: { label: 'Behind',      color: 'text-red-700',     bg: 'bg-red-100',     barColor: 'bg-red-500'     } },
];

/** Map a 0–1 progress ratio to the display band. */
export function getProgressBand(progress: number): BandResult {
  for (const { threshold, result } of BANDS) {
    if (progress >= threshold) return result;
  }
  return BANDS[BANDS.length - 1].result;
}

/** OKR letter grade from progress ratio. */
export function getOkrGrade(progress: number): string {
  if (progress >= 0.80) return 'A';
  if (progress >= 0.60) return 'B';
  if (progress >= 0.40) return 'C';
  if (progress >= 0.20) return 'D';
  return 'F';
}

/** Grade badge Tailwind classes. */
export const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-yellow-100 text-yellow-700',
  D: 'bg-orange-100 text-orange-700',
  F: 'bg-red-100 text-red-700',
};

/** Clamp a number to [0, 1] for safe progress rendering. */
export function clampProgress(raw: number): number {
  return Math.max(0, Math.min(1, raw));
}

/** Compute aggregate progress across an array of key results. */
export function aggregateProgress(keyResults: { progress: number; weight?: number }[]): number {
  if (!keyResults.length) return 0;
  const totalWeight = keyResults.reduce((s, kr) => s + (kr.weight ?? 1), 0);
  const weighted = keyResults.reduce((s, kr) => s + (kr.progress ?? 0) * (kr.weight ?? 1), 0);
  return clampProgress(weighted / totalWeight);
}

/** Days left until a due date (negative if overdue). */
export function daysUntil(dueDate: string | Date): number {
  return Math.round((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
}
