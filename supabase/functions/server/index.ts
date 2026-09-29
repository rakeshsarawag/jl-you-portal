import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

import directoryApi from "./directory-api.tsx";
import usersApi from "./users.ts";
import recruitmentApi from "./recruitment-api.tsx";
import onboardingApi from "./onboarding-api.tsx";
import employeeDashboardApi from "./employee-dashboard-api.tsx";
import performanceApi from "./performance-api.tsx";
import trainingApi from "./training-api.tsx";
import itServicesApi from "./it-services-api.tsx";
import payrollApi from "./payroll-api.tsx";
import invoiceApi from "./invoice-api.tsx";
import projectManagementApi from "./project-management-api.tsx";
import projectBacklogApi from "./project-backlog-api.tsx";
import projectDefectsApi from "./project-defects-api.tsx";
import assetApi from "./asset-api.tsx";
import okrApi from "./okr-api.tsx";
import knowledgeApi from "./knowledge-api.tsx";
import masterDataApi from "./master-data-api.tsx";
import permissionsApi from "./permissions.ts";
import communicationsApi from "./communications-api.tsx";
import { linkedinApp } from "./linkedin-api.tsx";
import notificationsApi from "./notifications-api.tsx";
import pushApi from "./push-api.tsx";
import workflowApi from "./workflow-api.tsx";
import employeeApi from "./employee-api.tsx";
import lifecycleApi from "./lifecycle-api.tsx";
import demoDataApi from "./demo-data-api.tsx";
import adminApi from "./admin-api.tsx";
import defectTrackerApi from "./defect-tracker-api.tsx";
import auditLogsApi from "./audit-logs-api.tsx";
import scheduledReportsApi from "./scheduled-reports-api.tsx";

// ── In-memory sliding-window rate limiter ────────────────────────────────────
// Key = IP or JWT sub; window = 60s; limit = 120 requests (2 req/s sustained)
// Resets on cold start — acceptable for edge function deployment model.
const rlMap = new Map<string, { count: number; windowStart: number }>();
const RL_WINDOW_MS = 60_000;
const RL_LIMIT = 120;
const RL_MUTATE_LIMIT = 30; // stricter limit for write operations

function rateLimitKey(req: Request): string {
  // Prefer authenticated user ID from JWT
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (token) {
    try {
      const [, payload] = token.split(".");
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      if (decoded.sub) return `u:${decoded.sub}`;
    } catch {}
  }
  // Fall back to Cloudflare IP header
  return `ip:${req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown"}`;
}

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rlMap.get(key);
  if (!entry || now - entry.windowStart >= RL_WINDOW_MS) {
    rlMap.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

const app = new Hono();
const base = "/make-server-1fe2c468";

app.use("*", logger(console.log));

// Rate limiting middleware
app.use("/*", async (c, next) => {
  const key = rateLimitKey(c.req.raw);
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method);
  const limit = isMutating ? RL_MUTATE_LIMIT : RL_LIMIT;
  if (!checkRateLimit(key, limit)) {
    return c.json({ error: "Too Many Requests", retryAfter: 60 }, 429);
  }
  await next();
});

app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization", "apikey", "x-user-email"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

// Security headers middleware (G-20)
app.use("/*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co"
  );
});

app.get(`${base}/health`, (c) =>
  c.json({ status: "ok", version: "2026-08-26-AUDIT-COLUMNS" })
);

app.route(`${base}/directory`, directoryApi);
app.route(`${base}/users`, usersApi);
app.route(`${base}/recruitment`, recruitmentApi);
app.route(`${base}/onboarding`, onboardingApi);
app.route(`${base}/employee-dashboard`, employeeDashboardApi);
app.route(`${base}/performance`, performanceApi);
app.route(`${base}/training`, trainingApi);
app.route(`${base}/it-services`, itServicesApi);
app.route(`${base}/payroll`, payrollApi);
app.route(`${base}/invoices`, invoiceApi);
app.route(`${base}/projects`, projectManagementApi);
app.route(`${base}/projects`, projectBacklogApi);
app.route(`${base}/projects`, projectDefectsApi);
app.route(`${base}/assets`, assetApi);
app.route(`${base}/okr`, okrApi);
app.route(`${base}/knowledge`, knowledgeApi);
app.route(`${base}/master-data`, masterDataApi);
app.route(`${base}/permissions`, permissionsApi);
app.route(`${base}/communications`, communicationsApi);
app.route(`${base}/linkedin`, linkedinApp);
app.route(`${base}/notifications`, notificationsApi);
app.route(`${base}/push`, pushApi);
app.route(`${base}/workflow`, workflowApi);
app.route(`${base}/scheduled-reports`, scheduledReportsApi);
app.route(`${base}/employees`, employeeApi);
app.route(`${base}/demo`, demoDataApi);
app.route(`${base}/admin`, adminApi);
app.route(`${base}/defect-tracker`, defectTrackerApi);
app.route(`${base}/audit-logs`, auditLogsApi);
app.route("/", lifecycleApi);

Deno.serve(app.fetch);
