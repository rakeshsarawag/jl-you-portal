// Centralised logger — structured JSON format compatible with log aggregators.
// In production, replace sendToRemote() with a real endpoint or Sentry call.

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  module?: string;
  userId?: string;
  timestamp: string;
  data?: unknown;
  stack?: string;
}

const IS_DEV = import.meta.env.DEV;

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function sendToRemote(entry: LogEntry): void {
  // Swap in a real endpoint (Sentry, Datadog, custom /logs API) as needed.
  // fetch("/api/logs", { method: "POST", body: JSON.stringify(entry) }).catch(() => {});
  // For now this is a no-op in production (logs stay in console only).
}

function log(level: LogLevel, message: string, meta?: { module?: string; userId?: string; data?: unknown; error?: unknown }): void {
  const entry: LogEntry = {
    level,
    message,
    module: meta?.module,
    userId: meta?.userId,
    timestamp: new Date().toISOString(),
    data: meta?.data,
    stack: meta?.error instanceof Error ? meta.error.stack : undefined,
  };

  if (IS_DEV) {
    const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleFn(`[${entry.timestamp}] [${level.toUpperCase()}]${entry.module ? ` [${entry.module}]` : ""}`, message, meta?.data ?? "");
  } else {
    // Structured output for log aggregators
    console[level === "debug" ? "log" : level](formatEntry(entry));
    if (level === "error" || level === "warn") sendToRemote(entry);
  }
}

export const logger = {
  debug: (message: string, meta?: Omit<Parameters<typeof log>[2], never>) => log("debug", message, meta),
  info:  (message: string, meta?: Omit<Parameters<typeof log>[2], never>) => log("info",  message, meta),
  warn:  (message: string, meta?: Omit<Parameters<typeof log>[2], never>) => log("warn",  message, meta),
  error: (message: string, meta?: Omit<Parameters<typeof log>[2], never>) => log("error", message, meta),

  // Convenience: capture an Error object with stack
  capture: (error: unknown, message?: string, meta?: { module?: string; userId?: string }) => {
    const msg = message ?? (error instanceof Error ? error.message : String(error));
    log("error", msg, { ...meta, error, data: error instanceof Error ? { name: error.name } : error });
  },
};

export default logger;
