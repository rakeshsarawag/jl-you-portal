export type DefectSLAStatus =
  | "on_track"
  | "at_risk"
  | "fix_breached"
  | "verify_breached"
  | "all_met"
  | "paused";

export interface DefectSLAPolicy {
  severity: string;
  name?: string;
  first_response_mins: number;
  fix_mins: number;
  verification_mins: number;
  escalate_at_percent?: number;
}

export interface DefectSLAResult {
  slaStatus: DefectSLAStatus;
  slaFirstResponseRemainingMins: number | null;
  slaFixRemainingMins: number | null;
  slaVerifyRemainingMins: number | null;
  slaFirstResponseDueAt: string | null;
  slaFixDueAt: string | null;
  slaVerifyDueAt: string | null;
  slaFirstResponseMet: boolean;
  slaFirstResponseBreached: boolean;
  slaFixBreached: boolean;
  slaVerifyBreached: boolean;
  slaPolicyName: string;
}

const RESOLVED_STATUSES = new Set(["Resolved", "Verified", "Closed"]);

function timestamp(value: unknown): number | null {
  if (!value) return null;
  const result = new Date(String(value)).getTime();
  return Number.isFinite(result) ? result : null;
}

function minutesBetween(later: number, earlier: number) {
  return Math.round((later - earlier) / 60_000);
}

export function computeDefectSLA(
  defect: Record<string, any>,
  policies: DefectSLAPolicy[],
  now = Date.now(),
): DefectSLAResult {
  const policy = policies.find((candidate) => candidate.severity === defect.severity);
  const empty: DefectSLAResult = {
    slaStatus: "on_track",
    slaFirstResponseRemainingMins: null,
    slaFixRemainingMins: null,
    slaVerifyRemainingMins: null,
    slaFirstResponseDueAt: null,
    slaFixDueAt: null,
    slaVerifyDueAt: null,
    slaFirstResponseMet: false,
    slaFirstResponseBreached: false,
    slaFixBreached: false,
    slaVerifyBreached: false,
    slaPolicyName: "",
  };
  if (!policy) return empty;

  const createdAt = timestamp(defect.created_at ?? defect.createdAt);
  if (createdAt === null) return { ...empty, slaPolicyName: policy.name ?? "" };

  const status = defect.status === "Fixed" ? "Resolved" : defect.status;
  const pausedAt = timestamp(defect.sla_paused_at ?? defect.slaPausedAt);
  const isPaused = Boolean(defect.sla_paused ?? defect.slaPaused) || status === "Awaiting Info";
  const completedPauseMins = Math.max(
    0,
    Number(defect.sla_total_paused_mins ?? defect.slaTotalPausedMins ?? 0) || 0,
  );
  const currentPauseMins = isPaused && pausedAt !== null
    ? Math.max(0, minutesBetween(now, pausedAt))
    : 0;
  const totalPauseMins = completedPauseMins + currentPauseMins;
  const pauseMs = totalPauseMins * 60_000;

  const firstResponseAt = timestamp(defect.first_response_at ?? defect.firstResponseAt);
  const resolvedAt = timestamp(defect.fixed_date ?? defect.fixedDate);
  const verifiedAt = timestamp(defect.verified_date ?? defect.verifiedDate);

  const firstResponseDue = createdAt + policy.first_response_mins * 60_000;
  const fixDue = createdAt + policy.fix_mins * 60_000 + pauseMs;
  const verifyDue = resolvedAt === null
    ? null
    : resolvedAt + policy.verification_mins * 60_000;

  const firstResponseClock = firstResponseAt ?? now;
  const fixClock = resolvedAt ?? now;
  const verifyClock = verifiedAt ?? now;
  const firstResponseBreached = firstResponseClock > firstResponseDue;
  const fixBreached = fixClock > fixDue;
  const verifyBreached = verifyDue !== null && verifyClock > verifyDue;

  const firstResponseRemaining = minutesBetween(firstResponseDue, firstResponseAt ?? now);
  const fixRemaining = minutesBetween(fixDue, resolvedAt ?? now);
  const verifyRemaining = verifyDue === null ? null : minutesBetween(verifyDue, verifiedAt ?? now);
  const escalateAt = Math.min(100, Math.max(0, policy.escalate_at_percent ?? 80));
  const atRiskThreshold = policy.fix_mins * (1 - escalateAt / 100);

  let slaStatus: DefectSLAStatus = "on_track";
  if (isPaused) slaStatus = "paused";
  else if (verifyBreached && status === "Resolved") slaStatus = "verify_breached";
  else if (fixBreached && !RESOLVED_STATUSES.has(status)) slaStatus = "fix_breached";
  else if (status === "Verified" || status === "Closed") slaStatus = "all_met";
  else if (fixRemaining <= atRiskThreshold) slaStatus = "at_risk";

  return {
    slaStatus,
    slaFirstResponseRemainingMins: firstResponseRemaining,
    slaFixRemainingMins: fixRemaining,
    slaVerifyRemainingMins: verifyRemaining,
    slaFirstResponseDueAt: new Date(firstResponseDue).toISOString(),
    slaFixDueAt: new Date(fixDue).toISOString(),
    slaVerifyDueAt: verifyDue === null ? null : new Date(verifyDue).toISOString(),
    slaFirstResponseMet: firstResponseAt !== null && !firstResponseBreached,
    slaFirstResponseBreached: firstResponseBreached,
    slaFixBreached: fixBreached,
    slaVerifyBreached: verifyBreached,
    slaPolicyName: policy.name ?? "",
  };
}

export function formatDefectAge(createdAt: string, now = Date.now()) {
  const created = timestamp(createdAt);
  if (created === null) return "—";
  const elapsedMins = Math.max(0, Math.floor((now - created) / 60_000));
  if (elapsedMins < 60) return `${elapsedMins}m`;
  const hours = Math.floor(elapsedMins / 60);
  if (hours < 24) return `${hours}h ${elapsedMins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
