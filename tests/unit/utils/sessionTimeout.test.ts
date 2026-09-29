import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Simulated session timeout logic (mirrors what SessionTimeoutManager does)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000;   // warn 5 min before

function isSessionExpired(lastActiveAt: number, now = Date.now()): boolean {
  return now - lastActiveAt >= SESSION_TIMEOUT_MS;
}

function shouldShowWarning(lastActiveAt: number, now = Date.now()): boolean {
  const elapsed = now - lastActiveAt;
  return elapsed >= SESSION_TIMEOUT_MS - WARNING_BEFORE_MS && elapsed < SESSION_TIMEOUT_MS;
}

function timeUntilExpiry(lastActiveAt: number, now = Date.now()): number {
  return Math.max(0, SESSION_TIMEOUT_MS - (now - lastActiveAt));
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

describe("isSessionExpired", () => {
  it("returns false for recent activity", () => {
    const now = Date.now();
    expect(isSessionExpired(now - 5 * 60 * 1000, now)).toBe(false);
  });

  it("returns true exactly at timeout boundary", () => {
    const now = Date.now();
    expect(isSessionExpired(now - SESSION_TIMEOUT_MS, now)).toBe(true);
  });

  it("returns true well past timeout", () => {
    const now = Date.now();
    expect(isSessionExpired(now - 2 * SESSION_TIMEOUT_MS, now)).toBe(true);
  });

  it("returns false for activity 1 second before timeout", () => {
    const now = Date.now();
    expect(isSessionExpired(now - SESSION_TIMEOUT_MS + 1000, now)).toBe(false);
  });
});

describe("shouldShowWarning", () => {
  it("shows warning at 25 minutes of inactivity", () => {
    const now = Date.now();
    const lastActive = now - 25 * 60 * 1000;
    expect(shouldShowWarning(lastActive, now)).toBe(true);
  });

  it("no warning at 10 minutes of inactivity", () => {
    const now = Date.now();
    expect(shouldShowWarning(now - 10 * 60 * 1000, now)).toBe(false);
  });

  it("no warning after session already expired", () => {
    const now = Date.now();
    expect(shouldShowWarning(now - 31 * 60 * 1000, now)).toBe(false);
  });

  it("shows warning in the warning window", () => {
    const now = Date.now();
    const lastActive = now - (SESSION_TIMEOUT_MS - WARNING_BEFORE_MS + 1000);
    expect(shouldShowWarning(lastActive, now)).toBe(true);
  });
});

describe("timeUntilExpiry", () => {
  it("returns full timeout for very recent activity", () => {
    const now = Date.now();
    const remaining = timeUntilExpiry(now, now);
    expect(remaining).toBe(SESSION_TIMEOUT_MS);
  });

  it("returns 0 for expired session", () => {
    const now = Date.now();
    expect(timeUntilExpiry(now - SESSION_TIMEOUT_MS, now)).toBe(0);
  });

  it("returns positive for 5 min remaining", () => {
    const now = Date.now();
    const lastActive = now - (SESSION_TIMEOUT_MS - 5 * 60 * 1000);
    expect(timeUntilExpiry(lastActive, now)).toBeCloseTo(5 * 60 * 1000, -2);
  });
});

describe("formatCountdown", () => {
  it("formats 5 minutes correctly", () => {
    expect(formatCountdown(5 * 60 * 1000)).toBe("5:00");
  });

  it("formats 1 minute 30 seconds", () => {
    expect(formatCountdown(90 * 1000)).toBe("1:30");
  });

  it("formats 0 as 0:00", () => {
    expect(formatCountdown(0)).toBe("0:00");
  });

  it("pads seconds with leading zero", () => {
    expect(formatCountdown(65 * 1000)).toBe("1:05");
  });
});
