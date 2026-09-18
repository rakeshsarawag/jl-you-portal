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

// Errors that indicate the table does not exist yet — return graceful null.
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

// ── GET / — list all role permissions ────────────────────────────────────────
app.get("/", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("role_permissions")
      .select("role, permissions");

    if (error) {
      if (isTableMissing(error)) {
        return c.json({ success: true, permissionMatrix: null });
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
        // Table not yet provisioned — treat as no-op so UI does not crash.
        return c.json({ success: true, persisted: false });
      }
      throw error;
    }

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

    // Insert audit log entry (best-effort — ignore errors)
    await supabase.from("permission_audit_log").insert({
      action: "permission_change",
      target_user: role,
      changed_by: updatedBy ?? null,
      old_value: oldData ? JSON.stringify(oldData.permissions) : null,
      new_value: JSON.stringify(permissions),
      created_at: new Date().toISOString(),
    }).then(() => {}).catch(() => {});

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

// ── AUDIT LOG ─────────────────────────────────────────────────────────────────

app.get("/audit-log", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("permission_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return c.json({ success: false, error: "Failed to fetch audit log" }, 500);
  }
});

export default app;
