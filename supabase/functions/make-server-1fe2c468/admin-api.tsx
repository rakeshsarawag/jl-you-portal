/**
 * Admin API — internal-only endpoints for DB migrations and maintenance.
 * Mounted at /admin in index.ts.
 *
 * POST /run-sql   Execute arbitrary SQL via SUPABASE_DB_URL (postgres driver).
 *                 Used by the migration scripts in /scripts/*.mjs.
 */

import { Hono } from "npm:hono";

const app = new Hono();

app.post("/run-sql", async (c) => {
  try {
    const { sql } = await c.req.json();
    if (!sql || typeof sql !== "string") {
      return c.json({ success: false, error: "sql string required" }, 400);
    }

    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return c.json({ success: false, error: "SUPABASE_DB_URL not available in this environment" }, 500);
    }

    const { default: postgres } = await import("npm:postgres@3");
    const pg = postgres(dbUrl, { max: 1, fetch_types: false });
    try {
      await pg.unsafe(sql);
    } finally {
      await pg.end();
    }

    return c.json({ success: true });
  } catch (err: any) {
    console.error("run-sql error:", err?.message);
    return c.json({ success: false, error: err?.message ?? "SQL execution failed" }, 500);
  }
});

export default app;
