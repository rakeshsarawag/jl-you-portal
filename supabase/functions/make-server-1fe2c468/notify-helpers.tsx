/**
 * Notification helpers — used by all API modules to send in-app + push notifications.
 *
 * notifyUserId   — send to a known app_users.id
 * notifyByEmail  — send to a user looked up by email
 * notifyManager  — send to the reporting manager of an app_user
 *
 * All functions are fire-and-forget safe: they swallow errors internally.
 * The DB table (run once in Supabase SQL editor if not already created):
 *
 *   create table if not exists notifications (
 *     id         uuid primary key default gen_random_uuid(),
 *     user_id    text not null,
 *     title      text not null,
 *     body       text not null default '',
 *     type       text not null default 'info',
 *     link       text,
 *     read       boolean not null default false,
 *     created_at timestamptz not null default now()
 *   );
 *   create index if not exists notifications_user_id_idx on notifications(user_id);
 */

import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { sendPushToUser } from "./push-utils.tsx";

export interface NotifPayload {
  title: string;
  body: string;
  type?: string;
  link?: string | null;
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function isTableMissing(err: unknown): boolean {
  const e = err as Record<string, unknown>;
  return e?.code === "42P01" || e?.code === "PGRST116";
}

/** Insert a notification row and fire a push — both fire-and-forget safe. */
export async function notifyUserId(userId: string, payload: NotifPayload): Promise<void> {
  if (!userId) return;
  const supabase = getSupabase();
  try {
    const { error } = await supabase.from("notifications").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      title: payload.title,
      body: payload.body ?? "",
      type: payload.type ?? "info",
      link: payload.link ?? null,
      read: false,
      created_at: new Date().toISOString(),
    });
    if (error && !isTableMissing(error)) {
      console.warn("[notify] insert error:", error.message);
    }
    sendPushToUser(userId, { title: payload.title, body: payload.body ?? "", type: payload.type, link: payload.link }).catch(() => {});
  } catch (err) {
    console.warn("[notify] notifyUserId failed:", err instanceof Error ? err.message : String(err));
  }
}

/** Look up an app_user by email, then notify them. */
export async function notifyByEmail(email: string, payload: NotifPayload): Promise<void> {
  if (!email) return;
  const supabase = getSupabase();
  try {
    const { data } = await supabase
      .from("app_users")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (data?.id) await notifyUserId(data.id, payload);
  } catch {}
}

/**
 * Notify the reporting manager of an employee.
 * Accepts the employee's app_users.id (userId) — walks the chain:
 *   app_users(id) → employees(manager_id) → app_users(employee_id) → notifyUserId
 */
export async function notifyManager(
  employeeAppUserId: string,
  payload: NotifPayload,
): Promise<void> {
  if (!employeeAppUserId) return;
  const supabase = getSupabase();
  try {
    // Step 1: get the employee_id linked to this app_user
    const { data: appUser } = await supabase
      .from("app_users")
      .select("employee_id")
      .eq("id", employeeAppUserId)
      .maybeSingle();

    let managerId: string | null = null;

    if (appUser?.employee_id) {
      // Step 2: get manager_id from the employees table
      const { data: emp } = await supabase
        .from("employees")
        .select("manager_id, name")
        .eq("id", appUser.employee_id)
        .maybeSingle();

      if (emp?.manager_id) {
        // Step 3: find the manager's app_user record
        const { data: managerUser } = await supabase
          .from("app_users")
          .select("id")
          .eq("employee_id", emp.manager_id)
          .maybeSingle();
        managerId = managerUser?.id ?? null;
      }
    }

    if (managerId) {
      // Direct manager found — notify them specifically
      await notifyUserId(managerId, payload);
      return;
    }

    // Fallback: no manager linked — fetch all app_users and filter in JS
    // (roles is JSONB array; PostgREST containment syntax varies by version)
    const { data: allUsers } = await supabase
      .from("app_users")
      .select("id, roles");
    const managerUsers = (allUsers ?? []).filter((u: any) => {
      const r = Array.isArray(u.roles) ? u.roles : [];
      return r.includes("manager") || r.includes("hr");
    });

    if (managerUsers && managerUsers.length > 0) {
      await Promise.all(managerUsers.map((u: any) => notifyUserId(u.id, payload).catch(() => {})));
    }
  } catch (err) {
    console.warn("[notify] notifyManager failed:", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Notify a user by their employee_id (UUID from employees table).
 * Looks up app_users via employee_id FK.
 */
export async function notifyByEmployeeId(employeeId: string, payload: NotifPayload): Promise<void> {
  if (!employeeId) return;
  const supabase = getSupabase();
  try {
    const { data } = await supabase
      .from("app_users")
      .select("id")
      .eq("employee_id", employeeId)
      .maybeSingle();
    if (data?.id) await notifyUserId(data.id, payload);
    else {
      // Fallback: employee email
      const { data: emp } = await supabase
        .from("employees")
        .select("email")
        .eq("id", employeeId)
        .maybeSingle();
      if (emp?.email) await notifyByEmail(emp.email, payload);
    }
  } catch {}
}
