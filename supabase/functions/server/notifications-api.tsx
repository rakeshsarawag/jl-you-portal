import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { sendPushToUser } from "./push-utils.tsx";

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  return e.code === "42P01" || e.code === "PGRST116";
}

// GET / — list notifications for a user
app.get("/", async (c) => {
  const userId = c.req.query("userId");
  if (!userId) {
    return c.json({ success: false, error: "userId is required" }, 400);
  }
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isTableMissingError(error)) {
        return c.json({ success: true, data: [] });
      }
      throw error;
    }
    return c.json({ success: true, data: data ?? [] });
  } catch (err) {
    if (isTableMissingError(err)) {
      return c.json({ success: true, data: [] });
    }
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

// POST / — create a notification
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, title, body: notifBody, type, link } = body;

    if (!userId || !title || !notifBody) {
      return c.json({ success: false, error: "userId, title, and body are required" }, 400);
    }

    const supabase = getSupabase();
    const notification = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      body: notifBody,
      type: type ?? "info",
      link: link ?? null,
      read: false,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("notifications")
      .insert(notification)
      .select()
      .single();

    if (error) {
      if (isTableMissingError(error)) {
        return c.json({ success: true, data: notification });
      }
      throw error;
    }

    // Fire-and-forget push notification — never fails the main response
    sendPushToUser(userId, { title, body: notifBody, type: type ?? "info", link }).catch(() => {});

    return c.json({ success: true, data });
  } catch (err) {
    if (isTableMissingError(err)) {
      return c.json({ success: false, error: "Notifications table does not exist" }, 503);
    }
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

// PUT /read-all — must be before /:id/read to avoid route conflict
app.put("/read-all", async (c) => {
  try {
    const body = await c.req.json();
    const { userId } = body;

    if (!userId) {
      return c.json({ success: false, error: "userId is required" }, 400);
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) {
      if (isTableMissingError(error)) {
        return c.json({ success: true });
      }
      throw error;
    }
    return c.json({ success: true });
  } catch (err) {
    if (isTableMissingError(err)) {
      return c.json({ success: true });
    }
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

// PUT /:id/read — mark single notification as read
app.put("/:id/read", async (c) => {
  const id = c.req.param("id");
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    if (error) {
      if (isTableMissingError(error)) {
        return c.json({ success: true });
      }
      throw error;
    }
    return c.json({ success: true });
  } catch (err) {
    if (isTableMissingError(err)) {
      return c.json({ success: true });
    }
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

// DELETE /:id — delete a notification
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (error) {
      if (isTableMissingError(error)) {
        return c.json({ success: true });
      }
      throw error;
    }
    return c.json({ success: true });
  } catch (err) {
    if (isTableMissingError(err)) {
      return c.json({ success: true });
    }
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

// GET /unread-count — get unread count for a user
app.get("/unread-count", async (c) => {
  const userId = c.req.query("userId");
  if (!userId) {
    return c.json({ count: 0 });
  }
  try {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) {
      if (isTableMissingError(error)) {
        return c.json({ count: 0 });
      }
      throw error;
    }
    return c.json({ count: count ?? 0 });
  } catch (err) {
    if (isTableMissingError(err)) {
      return c.json({ count: 0 });
    }
    return c.json({ count: 0 });
  }
});

export default app;
