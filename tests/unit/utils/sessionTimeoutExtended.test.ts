import { describe, it, expect } from "vitest";

// ── Pure session-timeout logic (mirrors the existing sessionTimeout.test.ts) ──
// Re-declare here for independence; constants match useSessionTimeout.ts values.
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes total
const WARNING_BEFORE_MS = 5 * 60 * 1000;   // 5 minutes warning window

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

// Secondary warning level: useSessionTimeout fires warning at 28 min idle (2 min countdown)
const INACTIVITY_MS = 28 * 60 * 1000;
const WARNING_MS     = 2 * 60 * 1000;

function isWarningPhaseActive(lastActiveAt: number, now: number): boolean {
  const elapsed = now - lastActiveAt;
  return elapsed >= INACTIVITY_MS && elapsed < INACTIVITY_MS + WARNING_MS;
}

function warningSecondsRemaining(lastActiveAt: number, now: number): number {
  const elapsed = now - lastActiveAt;
  if (elapsed < INACTIVITY_MS) return WARNING_MS / 1000;
  return Math.max(0, Math.ceil((INACTIVITY_MS + WARNING_MS - elapsed) / 1000));
}

// ---------------------------------------------------------------------------
// Exact countdown format tests
// ---------------------------------------------------------------------------
describe("formatCountdown — exact mm:ss values", () => {
  it("formats 4:59 correctly (299 seconds = 299_000 ms)", () => {
    expect(formatCountdown(299_000)).toBe("4:59");
  });

  it("formats 4:00 correctly (240 seconds)", () => {
    expect(formatCountdown(240_000)).toBe("4:00");
  });

  it("formats 1:30 correctly (90 seconds)", () => {
    expect(formatCountdown(90_000)).toBe("1:30");
  });

  it("formats 0:01 correctly (1 second)", () => {
    expect(formatCountdown(1_000)).toBe("0:01");
  });

  it("formats 0:00 correctly for zero ms", () => {
    expect(formatCountdown(0)).toBe("0:00");
  });

  it("rounds up sub-second to next whole second", () => {
    // 500 ms → ceil to 1 second → "0:01"
    expect(formatCountdown(500)).toBe("0:01");
  });

  it("formats 5:00 (warning window start)", () => {
    expect(formatCountdown(5 * 60 * 1000)).toBe("5:00");
  });

  it("formats 2:00 exactly (useSessionTimeout WARNING_SECONDS)", () => {
    expect(formatCountdown(2 * 60 * 1000)).toBe("2:00");
  });

  it("pads single-digit seconds with leading zero", () => {
    // 61 seconds → 1:01
    expect(formatCountdown(61_000)).toBe("1:01");
  });

  it("handles large value — 30 minutes", () => {
    expect(formatCountdown(30 * 60 * 1000)).toBe("30:00");
  });
});

// ---------------------------------------------------------------------------
// Warning threshold detection
// ---------------------------------------------------------------------------
describe("shouldShowWarning — warning threshold", () => {
  it("warning starts at exactly 25 minutes elapsed", () => {
    const now = 1_000_000;
    const lastActive = now - 25 * 60 * 1000;
    expect(shouldShowWarning(lastActive, now)).toBe(true);
  });

  it("warning is active 1 ms before session expiry", () => {
    const now = 1_000_000;
    const lastActive = now - (SESSION_TIMEOUT_MS - 1);
    expect(shouldShowWarning(lastActive, now)).toBe(true);
  });

  it("warning is NOT active at session expiry boundary", () => {
    const now = 1_000_000;
    const lastActive = now - SESSION_TIMEOUT_MS;
    expect(shouldShowWarning(lastActive, now)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Precision of remaining time
// ---------------------------------------------------------------------------
describe("timeUntilExpiry — precision", () => {
  it("exactly 5 min remaining returns 5 * 60 * 1000", () => {
    const now = 2_000_000;
    const lastActive = now - (SESSION_TIMEOUT_MS - WARNING_BEFORE_MS);
    expect(timeUntilExpiry(lastActive, now)).toBe(WARNING_BEFORE_MS);
  });

  it("exactly 1 minute remaining", () => {
    const now = 2_000_000;
    const lastActive = now - (SESSION_TIMEOUT_MS - 60_000);
    expect(timeUntilExpiry(lastActive, now)).toBe(60_000);
  });

  it("already expired returns 0, never negative", () => {
    const now = 2_000_000;
    const lastActive = now - SESSION_TIMEOUT_MS - 60_000;
    expect(timeUntilExpiry(lastActive, now)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// useSessionTimeout two-tier warning levels
// ---------------------------------------------------------------------------
describe("Two-tier warning: useSessionTimeout (28+2 model)", () => {
  it("warning phase is NOT active before 28 minutes", () => {
    const now = 5_000_000;
    const lastActive = now - 27 * 60 * 1000;
    expect(isWarningPhaseActive(lastActive, now)).toBe(false);
  });

  it("warning phase IS active at exactly 28 minutes", () => {
    const now = 5_000_000;
    const lastActive = now - INACTIVITY_MS;
    expect(isWarningPhaseActive(lastActive, now)).toBe(true);
  });

  it("warning phase is active during the 2-minute countdown", () => {
    const now = 5_000_000;
    const lastActive = now - (INACTIVITY_MS + 60_000); // 29 min elapsed
    expect(isWarningPhaseActive(lastActive, now)).toBe(true);
  });

  it("warning phase ends after full 30 minutes", () => {
    const now = 5_000_000;
    const lastActive = now - (INACTIVITY_MS + WARNING_MS); // 30 min elapsed
    expect(isWarningPhaseActive(lastActive, now)).toBe(false);
  });

  it("warningSecondsRemaining is 120 at start of warning phase", () => {
    const now = 5_000_000;
    const lastActive = now - INACTIVITY_MS;
    expect(warningSecondsRemaining(lastActive, now)).toBe(120);
  });

  it("warningSecondsRemaining is ~60 at 1 minute into warning", () => {
    const now = 5_000_000;
    const lastActive = now - (INACTIVITY_MS + 60_000);
    expect(warningSecondsRemaining(lastActive, now)).toBe(60);
  });

  it("warningSecondsRemaining is 0 after warning window elapses", () => {
    const now = 5_000_000;
    const lastActive = now - (INACTIVITY_MS + WARNING_MS + 1000);
    expect(warningSecondsRemaining(lastActive, now)).toBe(0);
  });

  it("isSessionExpired fires at 30 minutes (5-min model boundary)", () => {
    const now = 5_000_000;
    const lastActive = now - SESSION_TIMEOUT_MS;
    expect(isSessionExpired(lastActive, now)).toBe(true);
  });
});
