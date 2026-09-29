import { describe, it, expect } from "vitest";

// Pure utility functions extracted for testing
function calculateLeaveDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
}

function calculateWorkingDays(startDate: string, endDate: string, excludeWeekends = true): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (!excludeWeekends || (day !== 0 && day !== 6)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function remainingLeaveBalance(
  allocated: number,
  used: number,
  pending: number
): { available: number; pending: number; used: number } {
  return { available: Math.max(0, allocated - used - pending), pending, used };
}

function canApplyLeave(
  available: number,
  requestedDays: number,
  allowNegativeBalance = false
): { allowed: boolean; reason?: string } {
  if (requestedDays <= 0) return { allowed: false, reason: "Days must be positive" };
  if (!allowNegativeBalance && requestedDays > available) {
    return { allowed: false, reason: `Only ${available} day(s) available` };
  }
  return { allowed: true };
}

function accrueLeave(monthsWorked: number, annualAllocation: number): number {
  return Math.round((annualAllocation / 12) * monthsWorked * 100) / 100;
}

describe("calculateLeaveDays", () => {
  it("single day leave returns 1", () => {
    expect(calculateLeaveDays("2026-09-15", "2026-09-15")).toBe(1);
  });

  it("3-day range returns 3", () => {
    expect(calculateLeaveDays("2026-09-15", "2026-09-17")).toBe(3);
  });

  it("full week returns 7", () => {
    expect(calculateLeaveDays("2026-09-14", "2026-09-20")).toBe(7);
  });

  it("end before start returns negative (caller should validate)", () => {
    expect(calculateLeaveDays("2026-09-17", "2026-09-15")).toBeLessThan(0);
  });
});

describe("calculateWorkingDays", () => {
  it("Mon-Fri gives 5 working days", () => {
    expect(calculateWorkingDays("2026-09-14", "2026-09-18")).toBe(5);
  });

  it("full week Mon-Sun excludes weekend", () => {
    expect(calculateWorkingDays("2026-09-14", "2026-09-20")).toBe(5);
  });

  it("weekend only gives 0 working days", () => {
    expect(calculateWorkingDays("2026-09-19", "2026-09-20")).toBe(0);
  });

  it("single Monday returns 1", () => {
    expect(calculateWorkingDays("2026-09-14", "2026-09-14")).toBe(1);
  });
});

describe("remainingLeaveBalance", () => {
  it("calculates available correctly", () => {
    const { available } = remainingLeaveBalance(21, 5, 2);
    expect(available).toBe(14);
  });

  it("available never goes below 0", () => {
    const { available } = remainingLeaveBalance(5, 3, 5);
    expect(available).toBe(0);
  });

  it("zero usage returns full allocation", () => {
    const { available } = remainingLeaveBalance(21, 0, 0);
    expect(available).toBe(21);
  });
});

describe("canApplyLeave", () => {
  it("allows leave within balance", () => {
    expect(canApplyLeave(10, 3).allowed).toBe(true);
  });

  it("rejects when insufficient balance", () => {
    const result = canApplyLeave(2, 5);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/2 day/);
  });

  it("rejects zero days", () => {
    expect(canApplyLeave(10, 0).allowed).toBe(false);
  });

  it("allows negative balance when explicitly permitted", () => {
    expect(canApplyLeave(2, 5, true).allowed).toBe(true);
  });

  it("allows exactly matching available days", () => {
    expect(canApplyLeave(5, 5).allowed).toBe(true);
  });
});

describe("accrueLeave", () => {
  it("0 months gives 0 accrual", () => {
    expect(accrueLeave(0, 21)).toBe(0);
  });

  it("12 months gives full annual allocation", () => {
    expect(accrueLeave(12, 21)).toBe(21);
  });

  it("6 months gives half allocation", () => {
    expect(accrueLeave(6, 21)).toBeCloseTo(10.5, 1);
  });
});
