/**
 * Push Notification API
 *
 * DB table (run once in Supabase SQL editor):
 *
 *   create table if not exists push_subscriptions (
 *     id          uuid primary key default gen_random_uuid(),
 *     user_id     text not null,
 *     endpoint    text not null unique,
 *     p256dh      text not null,
 *     auth        text not null,
 *     created_at  timestamptz default now(),
 *     updated_at  timestamptz default now()
 *   );
 *   create index if not exists push_subscriptions_user_id_idx on push_subscriptions(user_id);
 *
 * Supabase secrets required:
 *   supabase secrets set VAPID_PUBLIC_KEY=<key> VAPID_PRIVATE_KEY=<key> VAPID_SUBJECT=mailto:you@example.com
 *
 * Generate keys: npx web-push generate-vapid-keys
 */

import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { sendPushToUser, broadcastPush, ensureVapid } from "./push-utils.tsx";

const app = new Hono();

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

// GET /vapid-public-key — frontend fetches this to subscribe
app.get("/vapid-public-key", (c) => {
  const key = Deno.env.get("VAPID_PUBLIC_KEY");
  if (!key) return c.json({ error: "VAPID not configured. Set VAPID_PUBLIC_KEY secret." }, 503);
  return c.json({ publicKey: key });
});

// POST /subscribe — save a browser push subscription for a user
app.post("/subscribe", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, subscription } = body as {
      userId: string;
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    };

    if (!userId || !subscription?.endpoint || !subscription?.keys) {
      return c.json({ error: "userId and subscription (with keys) are required" }, 400);
    }

    const supabase = getSupabase();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      if (isTableMissing(error)) {
        return c.json({ error: "push_subscriptions table does not exist. Run the setup SQL." }, 503);
      }
      throw error;
    }

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

// DELETE /unsubscribe — remove a subscription by endpoint
app.delete("/unsubscribe", async (c) => {
  try {
    const body = await c.req.json();
    const { endpoint } = body as { endpoint: string };

    if (!endpoint) return c.json({ error: "endpoint is required" }, 400);

    const supabase = getSupabase();
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);

    if (error && !isTableMissing(error)) throw error;

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

// GET /subscription-status — check whether a given endpoint is subscribed
app.get("/subscription-status", async (c) => {
  const endpoint = c.req.query("endpoint");
  if (!endpoint) return c.json({ subscribed: false });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", endpoint)
      .maybeSingle();

    if (error && !isTableMissing(error)) throw error;
    return c.json({ subscribed: Boolean(data) });
  } catch {
    return c.json({ subscribed: false });
  }
});

// POST /send — send push to a specific user (called from notifications-api or admin tools)
app.post("/send", async (c) => {
  try {
    if (!ensureVapid()) {
      return c.json({ error: "VAPID not configured" }, 503);
    }

    const body = await c.req.json();
    const { userId, title, body: notifBody, type, link } = body as {
      userId: string;
      title: string;
      body: string;
      type?: string;
      link?: string;
    };

    if (!userId || !title) {
      return c.json({ error: "userId and title are required" }, 400);
    }

    const sent = await sendPushToUser(userId, { title, body: notifBody, type, link });
    return c.json({ success: true, sent });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

// POST /broadcast — send push to all subscribed users (admin only)
app.post("/broadcast", async (c) => {
  try {
    if (!ensureVapid()) return c.json({ error: "VAPID not configured" }, 503);

    const body = await c.req.json();
    const { title, body: notifBody, type, link } = body as {
      title: string;
      body: string;
      type?: string;
      link?: string;
    };

    if (!title) return c.json({ error: "title is required" }, 400);

    const sent = await broadcastPush({ title, body: notifBody, type, link });
    return c.json({ success: true, sent });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

export default app;
