import { describe, expect, it } from "vitest";
import { computeDefectSLA, formatDefectAge } from "../../../src/app/utils/defectSla";

const policy = [{
  severity: "High",
  name: "High SLA",
  first_response_mins: 60,
  fix_mins: 240,
  verification_mins: 120,
  escalate_at_percent: 75,
}];
const start = Date.parse("2026-01-01T00:00:00.000Z");

describe("computeDefectSLA", () => {
  it("freezes the remaining fix time while awaiting information", () => {
    const result = computeDefectSLA({
      severity: "High",
      status: "Awaiting Info",
      created_at: new Date(start).toISOString(),
      sla_paused: true,
      sla_paused_at: new Date(start + 120 * 60_000).toISOString(),
      sla_total_paused_mins: 0,
    }, policy, start + 300 * 60_000);

    expect(result.slaStatus).toBe("paused");
    expect(result.slaFixRemainingMins).toBe(120);
    expect(result.slaFixBreached).toBe(false);
  });

  it("preserves elapsed pause time after work resumes", () => {
    const result = computeDefectSLA({
      severity: "High",
      status: "In Progress",
      created_at: new Date(start).toISOString(),
      sla_paused: false,
      sla_total_paused_mins: 180,
    }, policy, start + 300 * 60_000);

    expect(result.slaFixRemainingMins).toBe(120);
    expect(result.slaFixBreached).toBe(false);
  });

  it("records historical fix and verification breaches", () => {
    const result = computeDefectSLA({
      severity: "High",
      status: "Closed",
      created_at: new Date(start).toISOString(),
      fixed_date: new Date(start + 300 * 60_000).toISOString(),
      verified_date: new Date(start + 450 * 60_000).toISOString(),
    }, policy, start + 500 * 60_000);

    expect(result.slaFixBreached).toBe(true);
    expect(result.slaVerifyBreached).toBe(true);
    expect(result.slaStatus).toBe("all_met");
    expect(result.slaFixRemainingMins).toBe(-60);
    expect(result.slaVerifyRemainingMins).toBe(-30);
  });

  it("does not let a later pause rewrite first-response compliance", () => {
    const result = computeDefectSLA({
      severity: "High",
      status: "Resolved",
      created_at: new Date(start).toISOString(),
      first_response_at: new Date(start + 90 * 60_000).toISOString(),
      fixed_date: new Date(start + 180 * 60_000).toISOString(),
      sla_total_paused_mins: 180,
    }, policy, start + 500 * 60_000);

    expect(result.slaFirstResponseMet).toBe(false);
    expect(result.slaFirstResponseBreached).toBe(true);
  });
});

describe("formatDefectAge", () => {
  it("shows real elapsed hours and minutes instead of rounding to zero days", () => {
    expect(formatDefectAge(new Date(start).toISOString(), start + 95 * 60_000)).toBe("1h 35m");
  });
});
