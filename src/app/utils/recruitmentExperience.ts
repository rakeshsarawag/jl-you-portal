export interface CandidateExperience {
  years: number;
  months: number;
  decimalYears: number;
}

/**
 * Recruitment imports use `years.months` notation: 6.2 means six years and
 * two months, not 6.2 mathematical years.
 */
export function parseCandidateExperience(value: unknown): CandidateExperience {
  const raw = String(value ?? "").trim();
  if (!raw || /^(fresher|fresh|entry[- ]?level)$/i.test(raw)) {
    return { years: 0, months: 0, decimalYears: 0 };
  }

  const words = raw.match(/^(\d+)\s*(?:years?|yrs?|y)\s*(?:(\d+)\s*(?:months?|mos?|m))?$/i);
  const notation = raw.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  const match = words ?? notation;
  if (!match) {
    throw new Error("Experience must use years.months format, for example 6.2");
  }

  const years = Number(match[1]);
  const months = Number(match[2] ?? 0);
  if (!Number.isSafeInteger(years) || years < 0 || !Number.isInteger(months) || months < 0 || months > 11) {
    throw new Error("Experience months must be between 0 and 11");
  }

  return {
    years,
    months,
    decimalYears: Number((years + months / 12).toFixed(2)),
  };
}

export function formatCandidateExperience(value: number | null | undefined): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "Fresher";

  const totalMonths = Math.round(numeric * 12);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (months) parts.push(`${months} ${months === 1 ? "month" : "months"}`);
  return parts.join(" ") || "Fresher";
}

export function formatCompactCandidateExperience(value: number | null | undefined): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "Fresher";
  if (Number.isInteger(numeric)) {
    return `${numeric} ${numeric === 1 ? "year" : "years"}`;
  }
  return `${numeric.toFixed(1)} years`;
}
