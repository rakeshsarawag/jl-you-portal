import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { auditCreate, auditUpdate } from "./audit-helpers.ts";

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// ─── Posts ────────────────────────────────────────────────────────────────────

app.get('/posts', async (c) => {
  try {
    const supabase = getSupabase();
    const authorId = c.req.query('authorId');
    let query = supabase.from('communications_posts').select('*').order('created_at', { ascending: false });
    if (authorId) query = query.eq('author_id', authorId);
    const { data, error } = await query;
    if (error) {
      if (error.code === '42P01') return c.json([], 200);
      return c.json({ error: error.message }, 500);
    }
    return c.json(data ?? []);
  } catch (err: any) {
    console.error('Error fetching posts:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/posts', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase.from('communications_posts').insert({...body, ...auditCreate(c)}).select('*');
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, post: data?.[0] });
  } catch (err: any) {
    console.error('Error creating post:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.put('/posts/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const body = await c.req.json();
    const { data, error } = await supabase.from('communications_posts').update({...body, ...auditUpdate(c)}).eq('id', id).select('*');
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, post: data?.[0] });
  } catch (err: any) {
    console.error('Error updating post:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/posts/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const { error } = await supabase.from('communications_posts').delete().eq('id', id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting post:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Announcements ────────────────────────────────────────────────────────────

app.get('/announcements', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('communications_announcements')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      if (error.code === '42P01') return c.json([], 200);
      return c.json({ error: error.message }, 500);
    }
    return c.json(data ?? []);
  } catch (err: any) {
    console.error('Error fetching announcements:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/announcements', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const record = {
      ...body,
      attachments: body.attachments ?? [],
    };
    const { data, error } = await supabase.from('communications_announcements').insert({...record, ...auditCreate(c)}).select('*');
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, announcement: data?.[0] });
  } catch (err: any) {
    console.error('Error creating announcement:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.put('/announcements/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const body = await c.req.json();
    const { data, error } = await supabase.from('communications_announcements').update({...body, ...auditUpdate(c)}).eq('id', id).select('*');
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, announcement: data?.[0] });
  } catch (err: any) {
    console.error('Error updating announcement:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/announcements/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const { error } = await supabase.from('communications_announcements').delete().eq('id', id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting announcement:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Polls ────────────────────────────────────────────────────────────────────

app.get('/polls', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('communications_polls')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      if (error.code === '42P01') return c.json([], 200);
      return c.json({ error: error.message }, 500);
    }
    return c.json(data ?? []);
  } catch (err: any) {
    console.error('Error fetching polls:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/polls', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase.from('communications_polls').insert({...body, ...auditCreate(c)}).select('*');
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, poll: data?.[0] });
  } catch (err: any) {
    console.error('Error creating poll:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.put('/polls/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const body = await c.req.json();
    const { data, error } = await supabase.from('communications_polls').update({...body, ...auditUpdate(c)}).eq('id', id).select('*');
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, poll: data?.[0] });
  } catch (err: any) {
    console.error('Error updating poll:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Events ───────────────────────────────────────────────────────────────────

app.get('/events', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('communications_events')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      if (error.code === '42P01') return c.json([], 200);
      return c.json({ error: error.message }, 500);
    }
    return c.json(data ?? []);
  } catch (err: any) {
    console.error('Error fetching events:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/events', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase.from('communications_events').insert({...body, ...auditCreate(c)}).select('*');
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, event: data?.[0] });
  } catch (err: any) {
    console.error('Error creating event:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.put('/events/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const body = await c.req.json();
    const { data, error } = await supabase.from('communications_events').update({...body, ...auditUpdate(c)}).eq('id', id).select('*');
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, event: data?.[0] });
  } catch (err: any) {
    console.error('Error updating event:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/events/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const { error } = await supabase.from('communications_events').delete().eq('id', id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting event:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Channels ─────────────────────────────────────────────────────────────────

app.get('/channels', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('communications_channels')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      if (error.code === '42P01') return c.json([], 200);
      return c.json({ error: error.message }, 500);
    }
    return c.json(data ?? []);
  } catch (err: any) {
    console.error('Error fetching channels:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/channels', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase.from('communications_channels').insert({...body, ...auditCreate(c)}).select('*');
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, channel: data?.[0] });
  } catch (err: any) {
    console.error('Error creating channel:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Announcement Comments ────────────────────────────────────────────────────

function isTableMissing(err: any) {
  return err?.code === '42P01';
}

app.get('/announcements/:id/comments', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('announcement_comments')
    .select('*')
    .eq('announcement_id', id)
    .order('created_at', { ascending: true });
  if (error && isTableMissing(error)) return c.json({ success: true, data: [] });
  if (error) return c.json({ success: false, error: String(error) }, 500);
  return c.json({ success: true, data: data ?? [] });
});

app.post('/announcements/:id/comments', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const comment = {
    id: crypto.randomUUID(),
    announcement_id: id,
    author_id: body.authorId,
    author_name: body.authorName,
    content: body.content,
    created_at: new Date().toISOString(),
  };
  const supabase = getSupabase();
  const { data, error } = await supabase.from('announcement_comments').insert({...comment, ...auditCreate(c)}).select().single();
  if (error && isTableMissing(error)) return c.json({ success: true, data: comment });
  if (error) return c.json({ success: false, error: String(error) }, 500);
  return c.json({ success: true, data: data ?? comment });
});

// ─── Announcement Reactions ───────────────────────────────────────────────────

app.get('/announcements/:id/reactions', async (c) => {
  const id = c.req.param('id');
  const userId = c.req.query('userId');
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('announcement_reactions')
    .select('*')
    .eq('announcement_id', id);
  if (error && isTableMissing(error)) return c.json({ success: true, counts: { like: 0, love: 0, celebrate: 0 }, userReaction: null });
  if (error) return c.json({ success: false, error: String(error) }, 500);
  const rows = data ?? [];
  const counts = rows.reduce((acc: Record<string, number>, r: any) => {
    acc[r.reaction_type] = (acc[r.reaction_type] ?? 0) + 1;
    return acc;
  }, { like: 0, love: 0, celebrate: 0 });
  const userReaction = userId ? (rows.find((r: any) => r.user_id === userId)?.reaction_type ?? null) : null;
  return c.json({ success: true, counts, userReaction });
});

app.post('/announcements/:id/reactions', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { userId, type } = body;
  if (!userId || !type) return c.json({ success: false, error: 'userId and type required' }, 400);
  const supabase = getSupabase();
  // Check existing reaction
  const { data: existing, error: fetchErr } = await supabase
    .from('announcement_reactions')
    .select('id, reaction_type')
    .eq('announcement_id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (fetchErr && isTableMissing(fetchErr)) return c.json({ success: true, userReaction: null });
  if (fetchErr) return c.json({ success: false, error: String(fetchErr) }, 500);

  if (existing) {
    if (existing.reaction_type === type) {
      // Remove reaction
      const { error: delErr } = await supabase.from('announcement_reactions').delete().eq('id', existing.id);
      if (delErr) return c.json({ success: false, error: String(delErr) }, 500);
      return c.json({ success: true, userReaction: null });
    } else {
      // Update to new type
      const { error: updErr } = await supabase.from('announcement_reactions').update({ reaction_type: type, ...auditUpdate(c) }).eq('id', existing.id);
      if (updErr) return c.json({ success: false, error: String(updErr) }, 500);
      return c.json({ success: true, userReaction: type });
    }
  } else {
    // Insert new reaction
    const { error: insErr } = await supabase.from('announcement_reactions').insert({
      id: crypto.randomUUID(),
      announcement_id: id,
      user_id: userId,
      reaction_type: type,
      created_at: new Date().toISOString(),
      ...auditCreate(c),
    });
    if (insErr && isTableMissing(insErr)) return c.json({ success: true, userReaction: type });
    if (insErr) return c.json({ success: false, error: String(insErr) }, 500);
    return c.json({ success: true, userReaction: type });
  }
});

export default app;
