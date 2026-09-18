/**
 * Permission Management API
 * Handles CRUD operations for permission configurations using Supabase DB.
 * Table: role_permissions (id uuid, role text UNIQUE, permissions jsonb, updated_at timestamptz, updated_by text)
 */

import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function isTableMissing(error: any): boolean {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "");
  return (
    code === "PGRST116" ||
    code === "42P01" ||
    msg.includes("relation") ||
    msg.includes("does not exist")
  );
}

// Create the role_permissions table using Supabase management API SQL endpoint.
// Falls back gracefully if the management token is not configured.
async function createTableViaSql(): Promise<boolean> {
  const projectRef = Deno.env.get("SUPABASE_PROJECT_REF") ?? (() => {
    // Extract project ref from SUPABASE_URL: https://<ref>.supabase.co
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const m = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
    return m?.[1] ?? "";
  })();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!projectRef || !serviceKey) return false;

  const sql = `
    CREATE TABLE IF NOT EXISTS role_permissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      role text NOT NULL UNIQUE,
      permissions jsonb NOT NULL DEFAULT '{}',
      updated_at timestamptz DEFAULT now(),
      updated_by text
    );
    CREATE INDEX IF NOT EXISTS role_permissions_role_idx ON role_permissions (role);
  `;

  // Try Supabase REST API SQL execution via pg_dump endpoint
  const resp = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/exec_sql`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sql }),
    }
  ).catch(() => null);

  if (resp?.ok) return true;

  // Fallback: try management API
  const mgmtResp = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ACCESS_TOKEN") ?? serviceKey}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  ).catch(() => null);

  return mgmtResp?.ok ?? false;
}

// ── GET / — list all role permissions ────────────────────────────────────────
app.get("/", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("role_permissions")
      .select("role, permissions");

    if (error) {
      if (isTableMissing(error)) {
        // Attempt auto-creation
        const created = await createTableViaSql();
        if (created) {
          // Table now exists — return empty matrix so caller seeds defaults
          return c.json({ success: true, permissionMatrix: {} });
        }
        // Could not create — return informative 503
        return c.json({
          success: false,
          error: "role_permissions table does not exist. Run the SQL migration in your Supabase dashboard.",
          table_missing: true,
        }, 503);
      }
      throw error;
    }

    // Build permissionMatrix: { [role]: { ...permissions } }
    const permissionMatrix: Record<string, any> = {};
    (data ?? []).forEach((row) => {
      permissionMatrix[row.role] = row.permissions;
    });

    return c.json({ success: true, permissionMatrix });
  } catch (error) {
    console.error("Error fetching permission matrix:", error);
    return c.json({ success: false, error: "Failed to fetch permissions" }, 500);
  }
});

// ── GET /:role — get permissions for a specific role ──────────────────────────
app.get("/:role", async (c) => {
  const role = c.req.param("role");
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("role_permissions")
      .select("*")
      .eq("role", role)
      .maybeSingle();

    if (error) {
      if (isTableMissing(error)) {
        return c.json({ success: true, data: null });
      }
      throw error;
    }

    return c.json({ success: true, data });
  } catch (error) {
    console.error(`Error fetching permissions for role ${role}:`, error);
    return c.json({ success: false, error: "Failed to fetch role permissions" }, 500);
  }
});

// ── POST / — save full permission matrix ──────────────────────────────────────
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { permissionMatrix, updatedBy } = body as {
      permissionMatrix?: Record<string, any>;
      updatedBy?: string;
    };

    if (!permissionMatrix) {
      return c.json({ success: false, error: "permissionMatrix is required" }, 400);
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();

    const rows = Object.entries(permissionMatrix).map(([role, permissions]) => ({
      id: crypto.randomUUID(),
      role,
      permissions,
      updated_at: now,
      updated_by: updatedBy ?? null,
    }));

    const { error } = await supabase
      .from("role_permissions")
      .upsert(rows, { onConflict: "role" });

    if (error) {
      if (isTableMissing(error)) {
        await createTableViaSql();
        const { error: retryErr } = await supabase.from("role_permissions").upsert(rows, { onConflict: "role" });
        if (retryErr) {
          return c.json({ success: false, error: "Table missing. Run SQL migration in Supabase dashboard.", table_missing: true }, 503);
        }
      } else {
        throw error;
      }
    }

    // Write audit log entry for the bulk save
    await insertAuditLog(supabase, {
      action: "bulk_permission_save",
      target_user: Object.keys(permissionMatrix).join(", "),
      changed_by: updatedBy ?? null ?? undefined,
      new_value: JSON.stringify(Object.keys(permissionMatrix)),
    }).catch(() => {});

    return c.json({ success: true, persisted: true });
  } catch (error) {
    console.error("Error saving permission matrix:", error);
    return c.json({ success: false, error: "Failed to save permissions" }, 500);
  }
});

// ── PUT /:role — update single role ──────────────────────────────────────────
app.put("/:role", async (c) => {
  const role = c.req.param("role");
  try {
    const body = await c.req.json();
    const { permissions, updatedBy } = body as {
      permissions?: Record<string, any>;
      updatedBy?: string;
    };

    if (!permissions) {
      return c.json({ success: false, error: "permissions is required" }, 400);
    }

    const supabase = getSupabase();

    // Fetch old permissions for audit
    const { data: oldData } = await supabase
      .from("role_permissions")
      .select("permissions")
      .eq("role", role)
      .maybeSingle();

    const { error } = await supabase.from("role_permissions").upsert(
      {
        id: crypto.randomUUID(),
        role,
        permissions,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy ?? null,
      },
      { onConflict: "role" }
    );

    if (error) {
      if (isTableMissing(error)) {
        return c.json({ success: true, persisted: false });
      }
      throw error;
    }

    // Insert audit log entry (best-effort)
    await insertAuditLog(supabase, {
      action: "permission_change",
      target_user: role,
      changed_by: updatedBy ?? undefined,
      old_value: oldData ? JSON.stringify(oldData.permissions) : undefined,
      new_value: JSON.stringify(permissions),
    }).catch(() => {});

    return c.json({ success: true, persisted: true });
  } catch (error) {
    console.error(`Error updating permissions for role ${role}:`, error);
    return c.json({ success: false, error: "Failed to update role permissions" }, 500);
  }
});

// ── DELETE /:role — reset permissions for a role ──────────────────────────────
app.delete("/:role", async (c) => {
  const role = c.req.param("role");
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role", role);

    if (error) {
      if (isTableMissing(error)) {
        return c.json({ success: true });
      }
      throw error;
    }

    return c.json({ success: true });
  } catch (error) {
    console.error(`Error deleting permissions for role ${role}:`, error);
    return c.json({ success: false, error: "Failed to delete role permissions" }, 500);
  }
});

// ── CUSTOM ROLES ─────────────────────────────────────────────────────────────

app.get("/custom-roles", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("custom_roles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error("Error fetching custom roles:", error);
    return c.json({ success: false, error: "Failed to fetch custom roles" }, 500);
  }
});

app.post("/custom-roles", async (c) => {
  try {
    const body = await c.req.json();
    const authHeader = c.req.header("Authorization");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("custom_roles")
      .insert({
        id: crypto.randomUUID(),
        name: body.name,
        description: body.description ?? "",
        permissions: body.permissions ?? {},
        created_by: body.created_by ?? null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("Error creating custom role:", error);
    return c.json({ success: false, error: "Failed to create custom role" }, 500);
  }
});

app.put("/custom-roles/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("custom_roles")
      .update({
        name: body.name,
        description: body.description,
        permissions: body.permissions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error updating custom role:", error);
    return c.json({ success: false, error: "Failed to update custom role" }, 500);
  }
});

app.delete("/custom-roles/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const supabase = getSupabase();
    const { error } = await supabase.from("custom_roles").delete().eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting custom role:", error);
    return c.json({ success: false, error: "Failed to delete custom role" }, 500);
  }
});

// ── SETUP — create table if missing ───────────────────────────────────────────
app.post("/setup", async (c) => {
  const created = await createTableViaSql();
  if (created) {
    return c.json({ success: true, message: "role_permissions table created" });
  }
  return c.json({
    success: false,
    message: "Auto-creation failed. Run the following SQL in Supabase SQL editor:",
    sql: `CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL UNIQUE,
  permissions jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS role_permissions_role_idx ON role_permissions (role);`,
  }, 503);
});

// ── AUDIT LOG ─────────────────────────────────────────────────────────────────

// Ensure permission_audit_log table exists using a direct DB connection.
async function ensureAuditTable(): Promise<void> {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return;
  const { default: postgres } = await import("npm:postgres@3");
  const sql = postgres(dbUrl, { max: 1, fetch_types: false });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS permission_audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        action text NOT NULL,
        target_user text,
        changed_by text,
        old_value text,
        new_value text,
        created_at timestamptz DEFAULT now()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permission_audit_log_created_at_idx
        ON permission_audit_log (created_at DESC)
    `;
  } finally {
    await sql.end();
  }
}

async function insertAuditLog(
  supabase: ReturnType<typeof getSupabase>,
  entry: { action: string; target_user?: string; changed_by?: string; old_value?: string; new_value?: string }
): Promise<void> {
  const row = { id: crypto.randomUUID(), ...entry, created_at: new Date().toISOString() };
  const { error } = await supabase.from("permission_audit_log").insert(row);
  if (error && isTableMissing(error)) {
    await ensureAuditTable();
    await supabase.from("permission_audit_log").insert(row).catch(() => {});
  }
}

app.get("/audit-log", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("permission_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      if (isTableMissing(error)) {
        await ensureAuditTable();
        return c.json({ success: true, data: [] });
      }
      throw error;
    }
    return c.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return c.json({ success: false, error: "Failed to fetch audit log" }, 500);
  }
});

// ── POST /migrate — create permission tables (idempotent) ────────────────────
app.post("/migrate", async (c) => {
  try {
    await ensureAuditTable();
    return c.json({ success: true, message: "Permission tables ensured" });
  } catch (err: any) {
    console.error("Permission migration error:", err);
    return c.json({ success: false, error: err.message ?? "Migration failed" }, 500);
  }
});

export default app;
