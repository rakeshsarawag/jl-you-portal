import { Hono } from "npm:hono@4";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const linkedinApp = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function isTableMissing(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  return e.code === "42P01" || e.code === "PGRST116";
}

// ============ POSTS ENDPOINTS ============

linkedinApp.get("/posts", async (c) => {
  try {
    const supabase = getSupabase();
    const status = c.req.query("status");
    const authorId = c.req.query("authorId");
    let query = supabase.from("linkedin_posts").select("*").order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (authorId) query = query.eq("author_id", authorId);
    const { data, error } = await query;
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data ?? [] });
  } catch (err: any) {
    console.error("Error fetching LinkedIn posts:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

linkedinApp.post("/posts", async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const now = new Date().toISOString();
    const post = {
      ...body,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await supabase.from("linkedin_posts").insert(post).select("*");
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data?.[0] });
  } catch (err: any) {
    console.error("Error creating LinkedIn post:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

linkedinApp.get("/posts/:id", async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param("id");
    const { data, error } = await supabase.from("linkedin_posts").select("*").eq("id", id).single();
    if (error) {
      if (isTableMissing(error)) return c.json({ success: false, error: "Post not found" }, 404);
      return c.json({ success: false, error: error.message }, 500);
    }
    if (!data) return c.json({ success: false, error: "Post not found" }, 404);
    return c.json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching LinkedIn post:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

linkedinApp.put("/posts/:id", async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param("id");
    const body = await c.req.json();
    const { data, error } = await supabase
      .from("linkedin_posts")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*");
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data?.[0] });
  } catch (err: any) {
    console.error("Error updating LinkedIn post:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

linkedinApp.delete("/posts/:id", async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param("id");
    const { error } = await supabase.from("linkedin_posts").delete().eq("id", id);
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting LinkedIn post:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ============ TEMPLATES ENDPOINTS ============

linkedinApp.get("/templates", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("linkedin_templates").select("*").order("created_at", { ascending: false });
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data ?? [] });
  } catch (err: any) {
    console.error("Error fetching LinkedIn templates:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

linkedinApp.post("/templates", async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const template = { ...body, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from("linkedin_templates").insert(template).select("*");
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data?.[0] });
  } catch (err: any) {
    console.error("Error creating LinkedIn template:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

linkedinApp.put("/templates/:id", async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param("id");
    const body = await c.req.json();
    const { data, error } = await supabase.from("linkedin_templates").update(body).eq("id", id).select("*");
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data?.[0] });
  } catch (err: any) {
    console.error("Error updating LinkedIn template:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

linkedinApp.delete("/templates/:id", async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param("id");
    const { error } = await supabase.from("linkedin_templates").delete().eq("id", id);
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting LinkedIn template:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ============ EVENTS ENDPOINTS ============

linkedinApp.get("/events", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("linkedin_events").select("*").order("date", { ascending: true });
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data ?? [] });
  } catch (err: any) {
    console.error("Error fetching LinkedIn events:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

linkedinApp.post("/events", async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const event = { ...body, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from("linkedin_events").insert(event).select("*");
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data?.[0] });
  } catch (err: any) {
    console.error("Error creating LinkedIn event:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

linkedinApp.delete("/events/:id", async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param("id");
    const { error } = await supabase.from("linkedin_events").delete().eq("id", id);
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting LinkedIn event:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ============ ANALYTICS ENDPOINT ============

// POST /analytics — upsert engagement data on a post
linkedinApp.post("/analytics", async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { postId, engagement } = body;
    if (!postId) return c.json({ success: false, error: "postId is required" }, 400);
    const { data, error } = await supabase
      .from("linkedin_posts")
      .update({ engagement, updated_at: new Date().toISOString() })
      .eq("id", postId)
      .select("*");
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data?.[0] });
  } catch (err: any) {
    console.error("Error updating LinkedIn analytics:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ============ STATS ENDPOINT ============

linkedinApp.get("/stats", async (c) => {
  try {
    const supabase = getSupabase();
    const { data: posts, error } = await supabase.from("linkedin_posts").select("id, status");
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: { totalPosts: 0, scheduled: 0, drafts: 0, published: 0, upcomingEvents: 0 } });
      return c.json({ success: false, error: error.message }, 500);
    }
    const all = posts ?? [];
    const stats = {
      totalPosts: all.length,
      scheduled: all.filter((p: any) => p.status === "scheduled").length,
      drafts: all.filter((p: any) => p.status === "draft").length,
      published: all.filter((p: any) => p.status === "published").length,
      upcomingEvents: 0,
    };
    return c.json({ success: true, data: stats });
  } catch (err: any) {
    console.error("Error fetching LinkedIn stats:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

export { linkedinApp };
