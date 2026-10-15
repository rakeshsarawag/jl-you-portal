import type { Context } from "npm:hono";

/**
 * Validates that all required fields are present and non-empty in a request body.
 * Returns { ok: true, body } on success or { ok: false, response } with a 400
 * JSON response the caller should return immediately.
 *
 * Usage:
 *   const v = await requireFields(c, ['title', 'employeeId']);
 *   if (!v.ok) return v.response;
 *   const { title, employeeId } = v.body;
 */
export async function requireFields<T extends Record<string, unknown>>(
  c: Context,
  fields: (keyof T)[],
): Promise<{ ok: true; body: T } | { ok: false; response: Response }> {
  let body: T;
  try {
    body = await c.req.json() as T;
  } catch {
    return {
      ok: false,
      response: c.json({ success: false, error: "Invalid or missing JSON body" }, 400) as unknown as Response,
    };
  }

  const missing = fields.filter((f) => {
    const val = body[f];
    return val === undefined || val === null || val === "";
  });

  if (missing.length > 0) {
    return {
      ok: false,
      response: c.json(
        { success: false, error: `Missing required fields: ${missing.join(", ")}` },
        400,
      ) as unknown as Response,
    };
  }

  return { ok: true, body };
}

/**
 * Validates a URL path parameter is present and non-empty.
 * Returns { ok: true, value } or { ok: false, response } with a 400 response.
 */
export function requireParam(
  c: Context,
  paramName: string,
): { ok: true; value: string } | { ok: false; response: Response } {
  const value = c.req.param(paramName);
  if (!value || value.trim() === "") {
    return {
      ok: false,
      response: c.json(
        { success: false, error: `Missing required path parameter: ${paramName}` },
        400,
      ) as unknown as Response,
    };
  }
  return { ok: true, value: value.trim() };
}
