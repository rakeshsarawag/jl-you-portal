import type { Context } from "npm:hono";

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
