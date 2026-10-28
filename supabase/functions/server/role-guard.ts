import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
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

const ROLE_PRIORITY: AppRole[] = [
  "admin", "hr", "finance", "manager", "it", "marketing", "employee",
];

function resolvePrimaryRole(roles: unknown, primaryRole: unknown): AppRole {
  const assigned = Array.isArray(roles)
    ? roles.filter((role): role is AppRole =>
        typeof role === "string" && ALL_ROLES.includes(role as AppRole)
      )
    : [];

  // Match the frontend's getPrimaryRole() behavior so UI and API permissions
  // cannot disagree when a user has multiple roles or a stale primary_role.
  const highestAssigned = ROLE_PRIORITY.find((role) => assigned.includes(role));
  if (highestAssigned) return highestAssigned;

  if (
    typeof primaryRole === "string" &&
    ALL_ROLES.includes(primaryRole as AppRole)
  ) {
    return primaryRole as AppRole;
  }

  return "employee";
}

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
// Roles are resolved from app_users rather than trusted from JWT custom claims.
// This makes role removals and legacy records with stale claims fail correctly.

const _roleCache = new Map<string, { role: AppRole; employeeId: string | null; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateUserRoleCache(authUserId: string | null | undefined) {
  if (authUserId) _roleCache.delete(authUserId);
}

async function lookupUserRole(
  authUserId: string,
  verifiedEmail: string,
): Promise<{ role: AppRole; employeeId: string | null }> {
  const now = Date.now();
  const cached = _roleCache.get(authUserId);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return { role: cached.role, employeeId: cached.employeeId };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const fields = "id, email, roles, primary_role, employee_id, status, auth_user_id";
  let { data, error } = await supabase
    .from("app_users")
    .select(fields)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  // Older users may have been created before auth_user_id was populated. The
  // email comes from the already verified Supabase Auth user, never a request
  // header, so it is safe to use for reconciliation.
  if (!data && !error && verifiedEmail) {
    const fallback = await supabase
      .from("app_users")
      .select(fields)
      .is("auth_user_id", null)
      .ilike("email", verifiedEmail)
      .maybeSingle();

    data = fallback.data;
    error = fallback.error;

    // Persist the missing link so subsequent JWTs and requests resolve by UUID.
    if (data && !data.auth_user_id) {
      await supabase
        .from("app_users")
        .update({ auth_user_id: authUserId })
        .eq("id", data.id)
        .is("auth_user_id", null);
    }
  }

  if (error || !data) {
    // No app_users record — default to least privilege
    return { role: "employee", employeeId: null };
  }

  if (data.status === "suspended" || data.status === "inactive") {
    throw new Error("ACCOUNT_SUSPENDED");
  }

  const role = resolvePrimaryRole(data.roles, data.primary_role);
  let employeeId = data.employee_id ?? null;

  // project_members stores employees.id, but legacy app_users rows may not
  // have employee_id populated. Resolve from the verified auth identity/email
  // and repair the link so all downstream authorization uses the same ID.
  if (!employeeId) {
    let { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", authUserId)
      .limit(1)
      .maybeSingle();

    if (!employee && verifiedEmail) {
      const fallback = await supabase
        .from("employees")
        .select("id")
        .ilike("email", verifiedEmail)
        .limit(1)
        .maybeSingle();
      employee = fallback.data;
    }

    if (employee?.id) {
      employeeId = employee.id;
      await supabase
        .from("app_users")
        .update({ employee_id: employeeId })
        .eq("id", data.id)
        .is("employee_id", null);
    }
  }

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

    // userEmail was obtained from supabase.auth.getUser() by the JWT middleware.
    const verifiedEmail: string = (c as any).get("userEmail") ?? "";

    // Resolve the current role from the authoritative app_users record.
    let role: AppRole;
    let employeeId: string | null;
    try {
      ({ role, employeeId } = await lookupUserRole(authUserId, verifiedEmail));
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

    // Every authenticated role must be able to load the matrix used to decide
    // app visibility. Only this exact GET is shared; permission management,
    // custom roles, audit logs, temporary grants, and all writes remain admin.
    if (
      c.req.method === "GET" &&
      (path === "/permissions" || path === "/permissions/")
    ) {
      await next();
      return;
    }

    // Every authenticated user may record only their own verified login event.
    // User identity is resolved from the JWT inside the handler, not the body.
    if (c.req.method === "POST" && path === "/users/session-event") {
      await next();
      return;
    }

    // Course catalogue administration is restricted to administrators. The
    // UI additionally applies the Training → Manage Sessions permission.
    if (
      (c.req.method === "POST" && path === "/training/courses") ||
      (["PUT", "DELETE"].includes(c.req.method) &&
        /^\/training\/courses\/[^/]+$/.test(path))
    ) {
      if (role !== "admin") {
        return c.json({ error: "Forbidden: only administrators can manage training courses" }, 403);
      }
      await next();
      return;
    }

    // Employees may enrol themselves in optional training. The handler binds
    // the requested employee ID to the verified identity.
    if (
      c.req.method === "POST" &&
      /\/training\/enrollments\/?$/.test(path)
    ) {
      await next();
      return;
    }

    // Employees may submit their own training assessment. Ownership is checked
    // against the verified employee ID in the assessment handler.
    if (
      c.req.method === "POST" &&
      /^\/training\/enrollments\/[^/]+\/assessment$/.test(path)
    ) {
      await next();
      return;
    }
    if (
      c.req.method === "PUT" &&
      /^\/training\/enrollments\/[^/]+\/progress$/.test(path)
    ) {
      await next();
      return;
    }

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
