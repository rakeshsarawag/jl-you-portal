import type { Context } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

/**
 * Extract the acting user's email from the x-user-email request header.
 * Falls back to 'system' when not provided (e.g. background jobs).
 */
export function getUserEmail(c: Context): string {
  return c.req.header("x-user-email") ?? "system";
}

/**
 * Returns the standard set of audit fields for an INSERT.
 * Pass the result directly into your Supabase .insert() payload.
 */
export function auditCreate(c: Context) {
  const by = getUserEmail(c);
  return { created_by: by, updated_by: by };
}

/**
 * Returns the standard set of audit fields for an UPDATE.
 * Pass the result directly into your Supabase .update() payload.
 */
export function auditUpdate(c: Context) {
  return { updated_by: getUserEmail(c) };
}

/**
 * Write a structured entry to the audit_logs table.
 * Fire-and-forget — never blocks the main request.
 * G-05: Audit Log for All Create, Update & Delete Operations
 */
export function logAudit(
  options: {
    entity_type: string;
    entity_id: string;
    action: "create" | "update" | "delete" | "approve" | "reject" | "assign" | "export";
    actor: string;
    module?: string;
    changed_fields?: Record<string, { before: unknown; after: unknown }>;
    metadata?: Record<string, unknown>;
  }
): void {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  supabase.from("audit_logs").insert([{
    entity_type: options.entity_type,
    entity_id:   options.entity_id,
    action:      options.action,
    actor:       options.actor,
    module:      options.module ?? options.entity_type,
    changed_fields: options.changed_fields ? JSON.stringify(options.changed_fields) : null,
    metadata:    options.metadata ? JSON.stringify(options.metadata) : null,
    created_at:  new Date().toISOString(),
  }]).then(() => {}).catch(() => {/* fire-and-forget */});
}

/**
 * Convenience wrapper: derives actor from Hono context and calls logAudit.
 */
export function logAuditFromContext(
  c: Context,
  options: Omit<Parameters<typeof logAudit>[0], "actor">
): void {
  logAudit({ ...options, actor: getUserEmail(c) });
}

/**
 * Standard JSON error response shape.
 * G-06: Structured Error Handling — consistent API 4xx/5xx format.
 */
export function apiError(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
  message: string,
  details?: Record<string, unknown>
) {
  return c.json(
    {
      success: false,
      error: {
        status,
        message,
        ...(details ? { details } : {}),
        timestamp: new Date().toISOString(),
      },
    },
    status
  );
}

/**
 * Standard JSON success response shape.
 */
export function apiSuccess<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ success: true, data }, status);
}
