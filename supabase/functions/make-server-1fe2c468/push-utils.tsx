/**
 * Shared Web Push utility for Supabase Edge Functions.
 *
 * Requires the following Supabase secrets (set via `supabase secrets set`):
 *   VAPID_PUBLIC_KEY   — base64url-encoded VAPID public key
 *   VAPID_PRIVATE_KEY  — base64url-encoded VAPID private key
 *   VAPID_SUBJECT      — mailto: or https: URI identifying the sender
 *
 * Generate a key pair once with:
 *   npx web-push generate-vapid-keys
 */

import webPush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

export interface PushPayload {
  title: string;
  body: string;
  type?: string;
  link?: string | null;
  icon?: string;
  badge?: string;
}

function isTableMissing(err: unknown): boolean {
  const e = err as Record<string, unknown>;
  return e?.code === "42P01" || e?.code === "PGRST116";
}

let vapidInitialised = false;

function ensureVapid() {
  if (vapidInitialised) return true;
  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@jlportal.com";
  if (!pub || !priv) return false;
  webPush.setVapidDetails(subject, pub, priv);
  vapidInitialised = true;
  return true;
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/**
 * Send a Web Push notification to every subscription belonging to userId.
 * Silently removes expired/invalid subscriptions (HTTP 404/410 from push service).
 * Returns the number of successful sends.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureVapid()) return 0;

  const supabase = getSupabase();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    if (isTableMissing(error)) return 0;
    throw error;
  }
  if (!subs?.length) return 0;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    type: payload.type ?? "info",
    link: payload.link ?? null,
    icon: payload.icon ?? "/icons/icon-192x192.png",
    badge: payload.badge ?? "/icons/icon-96x96.png",
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message
      )
    )
  );

  // Prune dead subscriptions
  const deadEndpoints: string[] = [];
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const code = (result.reason as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        deadEndpoints.push(subs[i].endpoint);
      }
    }
  });
  if (deadEndpoints.length) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", deadEndpoints);
  }

  return results.filter((r) => r.status === "fulfilled").length;
}

/**
 * Send a push notification to ALL subscribed users (broadcast).
 */
export async function broadcastPush(payload: PushPayload): Promise<number> {
  if (!ensureVapid()) return 0;

  const supabase = getSupabase();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (error || !subs?.length) return 0;

  const message = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message
      )
    )
  );

  const deadEndpoints = subs
    .filter((_, i) => {
      const r = results[i];
      if (r.status === "rejected") {
        const code = (r.reason as { statusCode?: number })?.statusCode;
        return code === 404 || code === 410;
      }
      return false;
    })
    .map((s) => s.endpoint);

  if (deadEndpoints.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
  }

  return results.filter((r) => r.status === "fulfilled").length;
}

export { ensureVapid };
