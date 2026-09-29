import { describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Pure leave-balance utility functions (extended test suite)
// These extend the existing 19 tests in leaveBalance.test.ts
// ---------------------------------------------------------------------------

// ── Accrual helpers ──────────────────────────────────────────────────────────
function accrueLeave(monthsWorked: number, annualAllocation: number): number {
  return Math.round((annualAllocation / 12) * monthsWorked * 100) / 100;
}

function accrueOnAnniversary(
  joinDate: string,
  checkDate: string,
  annualAllocation: number
): number {
  const join = new Date(joinDate);
  const check = new Date(checkDate);
  const months =
    (check.getFullYear() - join.getFullYear()) * 12 +
    (check.getMonth() - join.getMonth());
  return accrueLeave(Math.max(0, months), annualAllocation);
}

// ── Balance helpers ──────────────────────────────────────────────────────────
function applyLeaveDeduction(
  balance: number,
  days: number,
  allowNegative = false
): number {
  const result = balance - days;
  return allowNegative ? result : Math.max(0, result);
}

function applyRejection(
  balance: number,
  pendingDays: number
): number {
  // When a leave request is rejected, pending days are restored to available balance
  return balance + pendingDays;
}

function applyCancellation(
  usedBalance: number,
  cancelledDays: number
): number {
  return usedBalance - cancelledDays;
}

// ── Comp-off tracking ────────────────────────────────────────────────────────
interface CompOff {
  earned: number;
  used: number;
  expiry: string; // ISO date — comp-offs typically expire
}

function compOffAvailable(compOff: CompOff, today: string): number {
  if (today >= compOff.expiry) return 0;
  return Math.max(0, compOff.earned - compOff.used);
}

function applyCompOff(compOff: CompOff, daysToUse: number): CompOff {
  return { ...compOff, used: compOff.used + daysToUse };
}

// ── WFH quota tracking ───────────────────────────────────────────────────────
function wfhRemaining(monthlyQuota: number, usedThisMonth: number): number {
  return Math.max(0, monthlyQuota - usedThisMonth);
}

function canWfh(monthlyQuota: number, usedThisMonth: number): boolean {
  return wfhRemaining(monthlyQuota, usedThisMonth) > 0;
}

// ── Annual carry-forward rules ───────────────────────────────────────────────
function carryForward(
  balance: number,
  maxCarry: number
): number {
  return Math.min(balance, maxCarry);
}

function lapseAtYearEnd(balance: number, maxCarry: number): number {
  // Amount that lapses (cannot be carried forward)
  return Math.max(0, balance - maxCarry);
}

// ── Leave type prioritisation ────────────────────────────────────────────────
interface LeavePool {
  casual: number;   // casual leave (CL) — use first
  earned: number;   // earned leave (EL)
  sick: number;     // sick leave (SL)
}

function deductFromPool(pool: LeavePool, requested: number): LeavePool {
  let remaining = requested;
  const updated = { ...pool };

  // Priority: casual → earned → sick
  const deductCasual = Math.min(updated.casual, remaining);
  updated.casual -= deductCasual;
  remaining -= deductCasual;

  const deductEarned = Math.min(updated.earned, remaining);
  updated.earned -= deductEarned;
  remaining -= deductEarned;

  const deductSick = Math.min(updated.sick, remaining);
  updated.sick -= deductSick;

  return updated;
}

// ── Half-day leave ───────────────────────────────────────────────────────────
function halfDayDeduction(balance: number): number {
  return balance - 0.5;
}

function applyHalfDay(pool: LeavePool): LeavePool {
  return deductFromPool(pool, 0.5);
}

// ── Working days helper ──────────────────────────────────────────────────────
function calculateWorkingDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Leave accrual on exact anniversary months", () => {
  it("accrues 0 days at month 0 (join date == check date)", () => {
    expect(accrueOnAnniversary("2026-01-01", "2026-01-01", 21)).toBe(0);
  });

  it("accrues correctly at 3-month anniversary", () => {
    expect(accrueOnAnniversary("2026-01-01", "2026-04-01", 12)).toBeCloseTo(3, 1);
  });

  it("accrues full allocation at 12-month anniversary", () => {
    expect(accrueOnAnniversary("2025-01-01", "2026-01-01", 21)).toBe(21);
  });

  it("accrues 6-month partial correctly for 21-day allocation", () => {
    const accrued = accrueOnAnniversary("2026-01-01", "2026-07-01", 21);
    expect(accrued).toBeCloseTo(10.5, 1);
  });

  it("does not accrue negative days for a past check date", () => {
    const accrued = accrueOnAnniversary("2026-06-01", "2026-01-01", 21);
    expect(accrued).toBe(0);
  });
});

describe("Negative balance after rejection/cancellation", () => {
  it("rejection restores pending days to available balance", () => {
    expect(applyRejection(5, 3)).toBe(8);
  });

  it("cancellation reduces used balance by cancelled days", () => {
    expect(applyCancellation(10, 3)).toBe(7);
  });

  it("applyLeaveDeduction does not go below 0 by default", () => {
    expect(applyLeaveDeduction(2, 5)).toBe(0);
  });

  it("applyLeaveDeduction allows negative when flag is set", () => {
    expect(applyLeaveDeduction(2, 5, true)).toBe(-3);
  });

  it("cancelling all used days resets used to 0", () => {
    expect(applyCancellation(5, 5)).toBe(0);
  });
});

describe("Comp-off balance tracking", () => {
  let compOff: CompOff;

  beforeEach(() => {
    compOff = { earned: 3, used: 1, expiry: "2027-01-01" };
  });

  it("available comp-off is earned minus used", () => {
    expect(compOffAvailable(compOff, "2026-09-21")).toBe(2);
  });

  it("expired comp-off balance is 0", () => {
    expect(compOffAvailable(compOff, "2027-01-01")).toBe(0);
  });

  it("applying comp-off increments used count", () => {
    const updated = applyCompOff(compOff, 1);
    expect(updated.used).toBe(2);
  });

  it("fully used comp-off shows 0 available", () => {
    const exhausted = applyCompOff(compOff, 2);
    expect(compOffAvailable(exhausted, "2026-09-21")).toBe(0);
  });
});

describe("WFH quota tracking", () => {
  it("remaining WFH days is quota minus used", () => {
    expect(wfhRemaining(8, 3)).toBe(5);
  });

  it("canWfh returns false when quota is exhausted", () => {
    expect(canWfh(8, 8)).toBe(false);
  });

  it("canWfh returns true when quota remains", () => {
    expect(canWfh(8, 7)).toBe(true);
  });

  it("wfhRemaining never returns negative", () => {
    expect(wfhRemaining(5, 10)).toBe(0);
  });
});

describe("Annual carry-forward rules", () => {
  it("balance within max carry is fully retained", () => {
    expect(carryForward(10, 15)).toBe(10);
  });

  it("balance exceeding max carry is capped at max", () => {
    expect(carryForward(20, 15)).toBe(15);
  });

  it("lapseAtYearEnd returns 0 when balance is within carry limit", () => {
    expect(lapseAtYearEnd(10, 15)).toBe(0);
  });

  it("lapseAtYearEnd returns the excess days that are lost", () => {
    expect(lapseAtYearEnd(20, 15)).toBe(5);
  });

  it("zero balance at year end — nothing carried, nothing lapsed", () => {
    expect(carryForward(0, 15)).toBe(0);
    expect(lapseAtYearEnd(0, 15)).toBe(0);
  });
});

describe("Leave type prioritisation (casual before earned)", () => {
  it("deducts from casual first", () => {
    const pool: LeavePool = { casual: 5, earned: 10, sick: 5 };
    const result = deductFromPool(pool, 3);
    expect(result.casual).toBe(2);
    expect(result.earned).toBe(10);
  });

  it("deducts from earned after casual is exhausted", () => {
    const pool: LeavePool = { casual: 2, earned: 10, sick: 5 };
    const result = deductFromPool(pool, 5);
    expect(result.casual).toBe(0);
    expect(result.earned).toBe(7);
  });

  it("deducts from sick last", () => {
    const pool: LeavePool = { casual: 0, earned: 0, sick: 5 };
    const result = deductFromPool(pool, 3);
    expect(result.sick).toBe(2);
  });
});

describe("Half-day leave deduction", () => {
  it("deducts 0.5 from balance", () => {
    expect(halfDayDeduction(5)).toBe(4.5);
  });

  it("deducts 0.5 from pool casual balance first", () => {
    const pool: LeavePool = { casual: 3, earned: 5, sick: 2 };
    const result = applyHalfDay(pool);
    expect(result.casual).toBe(2.5);
    expect(result.earned).toBe(5);
  });

  it("handles half-day when casual is 0 — deducts from earned", () => {
    const pool: LeavePool = { casual: 0, earned: 5, sick: 2 };
    const result = applyHalfDay(pool);
    expect(result.earned).toBe(4.5);
  });
});

describe("Leave lapse at year end", () => {
  it("sick leave that cannot be carried forward lapses fully", () => {
    // Sick leave typically has 0 carry-forward
    expect(lapseAtYearEnd(10, 0)).toBe(10);
  });

  it("casual leave that cannot be carried forward lapses fully", () => {
    expect(lapseAtYearEnd(5, 0)).toBe(5);
  });

  it("partial lapse when balance exceeds policy limit", () => {
    expect(lapseAtYearEnd(30, 20)).toBe(10);
  });
});
