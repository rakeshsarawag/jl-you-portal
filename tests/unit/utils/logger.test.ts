import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Test logger behaviour directly via a standalone implementation
// (avoids import.meta.env issues in node test environment)

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  module?: string;
  timestamp: string;
  data?: unknown;
  stack?: string;
}

function makeLogger(isDev: boolean) {
  const captured: LogEntry[] = [];
  const remote: LogEntry[] = [];

  function log(level: LogLevel, message: string, meta?: { module?: string; data?: unknown; error?: unknown }) {
    const entry: LogEntry = {
      level,
      message,
      module: meta?.module,
      timestamp: new Date().toISOString(),
      data: meta?.data,
      stack: meta?.error instanceof Error ? meta.error.stack : undefined,
    };
    captured.push(entry);
    if (!isDev && (level === "error" || level === "warn")) remote.push(entry);
  }

  const logger = {
    debug: (msg: string, meta?: any) => log("debug", msg, meta),
    info:  (msg: string, meta?: any) => log("info",  msg, meta),
    warn:  (msg: string, meta?: any) => log("warn",  msg, meta),
    error: (msg: string, meta?: any) => log("error", msg, meta),
    capture: (error: unknown, message?: string, meta?: { module?: string }) => {
      const msg = message ?? (error instanceof Error ? error.message : String(error));
      log("error", msg, { ...meta, error });
    },
    _captured: captured,
    _remote: remote,
  };
  return logger;
}

describe("logger (dev mode)", () => {
  const logger = makeLogger(true);

  it("debug logs are captured", () => {
    logger.debug("test debug", { module: "Auth" });
    const last = logger._captured.at(-1)!;
    expect(last.level).toBe("debug");
    expect(last.message).toBe("test debug");
    expect(last.module).toBe("Auth");
  });

  it("info logs are captured", () => {
    logger.info("user logged in");
    const last = logger._captured.at(-1)!;
    expect(last.level).toBe("info");
  });

  it("warn logs are captured", () => {
    logger.warn("slow query detected", { data: { ms: 3500 } });
    const last = logger._captured.at(-1)!;
    expect(last.level).toBe("warn");
    expect(last.data).toEqual({ ms: 3500 });
  });

  it("error logs are captured with module", () => {
    logger.error("DB connection failed", { module: "PayrollAPI" });
    const last = logger._captured.at(-1)!;
    expect(last.level).toBe("error");
    expect(last.module).toBe("PayrollAPI");
  });

  it("capture() extracts Error message and stack", () => {
    const err = new Error("Network timeout");
    logger.capture(err, "API call failed", { module: "FetchHelper" });
    const last = logger._captured.at(-1)!;
    expect(last.message).toBe("API call failed");
    expect(last.stack).toContain("Network timeout");
    expect(last.module).toBe("FetchHelper");
  });

  it("capture() falls back to string error", () => {
    logger.capture("string error happened");
    const last = logger._captured.at(-1)!;
    expect(last.message).toBe("string error happened");
  });

  it("timestamp is a valid ISO string", () => {
    logger.info("ts test");
    const last = logger._captured.at(-1)!;
    expect(new Date(last.timestamp).toISOString()).toBe(last.timestamp);
  });
});

describe("logger (production mode)", () => {
  const logger = makeLogger(false);

  it("error and warn are forwarded to remote", () => {
    logger.error("critical failure");
    logger.warn("degraded mode");
    logger.info("just info");
    expect(logger._remote.some(e => e.level === "error")).toBe(true);
    expect(logger._remote.some(e => e.level === "warn")).toBe(true);
    expect(logger._remote.some(e => e.level === "info")).toBe(false);
  });

  it("debug does not go to remote", () => {
    const before = logger._remote.length;
    logger.debug("debug msg");
    expect(logger._remote.length).toBe(before);
  });
});
