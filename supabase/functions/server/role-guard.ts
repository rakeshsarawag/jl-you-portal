import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { decodeJwt } from "npm:jose@5";
import type { Context, Next } from "npm:hono";

// ── Role definitions ──────────────────────────────────────────────────────────

export type AppRole =
  | "admin"
  | "hr"
  | "manager"
  | "finance"
  | "employee"
  | "it"
  | "marketing";

const ALL_ROLES: AppRole[] = [
  "admin", "hr", "manager", "finance", "employee", "it", "marketing",
];

// ── Route permission map ──────────────────────────────────────────────────────
// Each entry defines which roles can use GET (read) vs POST/PUT/PATCH/DELETE (write).
// Routes not listed default to admin-only.

interface RouteRule {
  read: AppRole[];   // GET requests
  write: AppRole[];  // POST / PUT / PATCH / DELETE requests
}

const ROUTE_RULES: Record<string, RouteRule> = {
  // ── Admin only ──
  "/admin":       { read: ["admin"], write: ["admin"] },
  "/permissions": { read: ["admin"], write: ["admin"] },
  "/demo":        { read: ["admin"], write: ["admin"] },
  "/users":       { read: ["admin", "hr"], write: ["admin"] },

  // ── Finance / HR / Admin ──
  "/payroll":           { read: ["admin", "hr", "finance"], write: ["admin", "hr", "finance"] },
  "/invoices":          { read: ["admin", "finance", "manager"], write: ["admin", "finance"] },
  "/scheduled-reports": { read: ["admin", "hr", "finance"], write: ["admin", "hr", "finance"] },

  // ── HR / Admin ──
  "/recruitment":  { read: ["admin", "hr", "manager"], write: ["admin", "hr"] },
  "/onboarding":   { read: ["admin", "hr", "manager"], write: ["admin", "hr"] },
  "/master-data":  { read: ["admin", "hr"], write: ["admin"] },
  "/audit-logs":   { read: ["admin", "hr"], write: ["admin"] },

  // ── IT / Admin ──
  "/assets": { read: ["admin", "it", "manager", "hr"], write: ["admin", "it"] },

  // ── Marketing / HR / Admin ──
  "/linkedin": { read: ["admin", "hr", "marketing"], write: ["admin", "hr", "marketing"] },

  // ── All roles (employees see own data — enforced by RLS) ──
  "/directory":         { read: ALL_ROLES, write: ["admin", "hr"] },
  "/employee-dashboard":{ read: ALL_ROLES, write: ALL_ROLES },
  "/performance":       { read: ALL_ROLES, write: ["admin", "hr", "manager"] },
  "/training":          { read: ALL_ROLES, write: ["admin", "hr", "manager"] },
  "/it-services":       { read: ALL_ROLES, write: ALL_ROLES },
  "/projects":          { read: ALL_ROLES, write: ["admin", "manager", "hr"] },
  "/okr":               { read: ALL_ROLES, write: ALL_ROLES },
  "/knowledge":         { read: ALL_ROLES, write: ["admin", "hr", "manager"] },
  "/communications":    { read: ALL_ROLES, write: ALL_ROLES },
  "/notifications":     { read: ALL_ROLES, write: ALL_ROLES },
  "/push":              { read: ALL_ROLES, write: ALL_ROLES },
  "/workflow":          { read: ALL_ROLES, write: ["admin", "hr", "manager"] },
  "/defect-tracker":    { read: ALL_ROLES, write: ALL_ROLES },
};

// ── Role lookup ───────────────────────────────────────────────────────────────
// Fast path: read role from JWT custom claims (requires Auth Hook migration 21).
// Slow path: DB lookup on app_users (always accurate, 5-min in-memory cache).

const _roleCache = new Map<string, { role: AppRole; employeeId: string | null; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function lookupUserRole(
  authUserId: string,
  rawToken: string,
): Promise<{ role: AppRole; employeeId: string | null }> {
  // ── Fast path: JWT custom claims (set by the Auth Hook in migration 21) ──
  try {
    const claims = decodeJwt(rawToken) as Record<string, unknown>;
    const jwtRole = claims["app_role"] as string | undefined;
    const jwtEmpId = claims["app_emp_id"] as string | undefined;
    if (jwtRole && jwtRole !== "anon") {
      return { role: jwtRole as AppRole, employeeId: jwtEmpId ?? null };
    }
  } catch { /* fall through to DB lookup */ }

  // ── Slow path: DB lookup with cache ──────────────────────────────────────
  const now = Date.now();
  const cached = _roleCache.get(authUserId);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return { role: cached.role, employeeId: cached.employeeId };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("app_users")
    .select("primary_role, employee_id, status")
    .eq("auth_user_id", authUserId)
    .single();

  if (error || !data) {
    // No app_users record — default to least privilege
    return { role: "employee", employeeId: null };
  }

  if (data.status === "suspended" || data.status === "inactive") {
    throw new Error("ACCOUNT_SUSPENDED");
  }

  const role = (data.primary_role ?? "employee") as AppRole;
  const employeeId = data.employee_id ?? null;

  _roleCache.set(authUserId, { role, employeeId, cachedAt: now });
  return { role, employeeId };
}

// ── Middleware factory ────────────────────────────────────────────────────────

/**
 * Returns a Hono middleware that:
 * 1. Looks up the authenticated user's role from app_users (5-min cache)
 * 2. Checks the role against the ROUTE_RULES map for the current path/method
 * 3. Returns 403 if the role is not allowed; sets ctx role/employeeId if allowed
 *
 * Must be mounted AFTER the JWT verification middleware.
 */
export function roleGuard(base: string) {
  return async (c: Context, next: Next) => {
    // Skip OPTIONS (CORS preflight already passed through JWT middleware)
    if (c.req.method === "OPTIONS") {
      await next();
      return;
    }

    // userId was set by the JWT middleware
    const authUserId: string = (c as any).get("userId");
    if (!authUserId) {
      return c.json({ error: "Forbidden: no identity" }, 403);
    }

    // Extract raw token to try fast-path JWT claim lookup
    const rawToken = (c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

    // Look up role (JWT claims first, DB fallback)
    let role: AppRole;
    let employeeId: string | null;
    try {
      ({ role, employeeId } = await lookupUserRole(authUserId, rawToken));
    } catch (e: any) {
      if (e.message === "ACCOUNT_SUSPENDED") {
        return c.json({ error: "Forbidden: account is suspended or inactive" }, 403);
      }
      throw e;
    }

    // Attach to context for downstream handlers
    (c as any).set("role", role);
    (c as any).set("employeeId", employeeId);

    // Find matching route rule — longest prefix wins
    const path = c.req.path.replace(base, ""); // strip the /make-server-xxx prefix
    const matchedKey = Object.keys(ROUTE_RULES)
      .filter((k) => path.startsWith(k))
      .sort((a, b) => b.length - a.length)[0]; // longest match first

    if (!matchedKey) {
      // Route not in map → admin only
      if (role !== "admin") {
        return c.json(
          { error: `Forbidden: '${role}' does not have access to this resource` },
          403,
        );
      }
      await next();
      return;
    }

    const rule = ROUTE_RULES[matchedKey];
    const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method);
    const allowed = isWrite ? rule.write : rule.read;

    if (!allowed.includes(role)) {
      return c.json(
        {
          error: `Forbidden: '${role}' role is not permitted to ${isWrite ? "modify" : "access"} this resource`,
          required: allowed,
        },
        403,
      );
    }

    await next();
  };
}
