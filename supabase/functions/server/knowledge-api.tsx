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

// ==================== ARTICLES ====================

app.get('/articles', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('knowledge_articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch articles' }, 500);
  }
});

app.get('/articles/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('knowledge_articles')
      .select('*')
      .eq('id', c.req.param('id'))
      .single();

    if (error || !data) return c.json({ success: false, error: 'Article not found' }, 404);

    // Increment view count
    await supabase.from('knowledge_articles').update({ views: (data.views || 0) + 1, ...auditUpdate(c) }).eq('id', data.id);

    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch article' }, 500);
  }
});

app.post('/articles/create', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('knowledge_articles')
      .insert([{
        title: body.title,
        content: body.content || '',
        category: body.category || '',
        author_id: body.authorId || null,
        author_name: body.author || body.authorName || '',
        tags: body.tags || [],
        status: body.status || 'Published',
        is_featured: body.isFeatured || false,
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create article' }, 500);
  }
});

app.post('/articles/update', async (c) => {
  try {
    const supabase = getSupabase();
    const { id, ...body } = await c.req.json();

    const { data, error } = await supabase
      .from('knowledge_articles')
      .update({
        title: body.title,
        content: body.content,
        category: body.category,
        author_name: body.author || body.authorName,
        tags: body.tags,
        status: body.status,
        is_featured: body.isFeatured,
        ...auditUpdate(c),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update article' }, 500);
  }
});

app.put('/articles/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const articleId = c.req.param('id');

    // Save current version snapshot before updating
    const { data: current } = await supabase
      .from('knowledge_articles')
      .select('title, content, author_name, updated_at')
      .eq('id', articleId)
      .single();

    if (current) {
      await supabase.from('knowledge_versions').insert({
        article_id: articleId,
        title: current.title,
        content_snapshot: current.content,
        edited_by: current.author_name,
        edited_at: current.updated_at ?? new Date().toISOString(),
        created_at: new Date().toISOString(),
        ...auditCreate(c),
      }).catch(() => {}); // graceful: table may not exist yet
    }

    const { data, error } = await supabase
      .from('knowledge_articles')
      .update({
        title: body.title,
        content: body.content,
        category: body.category,
        author_name: body.author || body.authorName,
        tags: body.tags,
        status: body.status,
        is_featured: body.isFeatured,
        updated_at: new Date().toISOString(),
        ...auditUpdate(c),
      })
      .eq('id', articleId)
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update article' }, 500);
  }
});

app.delete('/articles/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('knowledge_articles').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete article' }, 500);
  }
});

// Like article
app.post('/articles/:id/like', async (c) => {
  try {
    const supabase = getSupabase();
    const { data: article } = await supabase.from('knowledge_articles').select('likes').eq('id', c.req.param('id')).single();
    if (!article) return c.json({ success: false, error: 'Article not found' }, 404);

    const { data, error } = await supabase
      .from('knowledge_articles')
      .update({ likes: (article.likes || 0) + 1, ...auditUpdate(c) })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to like article' }, 500);
  }
});

// Search articles
app.get('/search', async (c) => {
  try {
    const supabase = getSupabase();
    const q = c.req.query('q') || '';

    const { data, error } = await supabase
      .from('knowledge_articles')
      .select('*')
      .or(`title.ilike.%${q}%,content.ilike.%${q}%,category.ilike.%${q}%`)
      .eq('status', 'Published')
      .order('views', { ascending: false })
      .limit(20);

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Search failed' }, 500);
  }
});

// Get categories
app.get('/categories', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('knowledge_articles')
      .select('category')
      .eq('status', 'Published')
      .not('category', 'is', null);

    if (error) return c.json({ success: false, error: error.message }, 500);

    const categoryMap = new Map<string, number>();
    (data || []).forEach((a: any) => {
      if (a.category) categoryMap.set(a.category, (categoryMap.get(a.category) || 0) + 1);
    });

    const categories = Array.from(categoryMap.entries()).map(([name, count]) => ({ name, count }));
    return c.json({ success: true, data: categories });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch categories' }, 500);
  }
});

// ==================== COMMENTS ====================

function isTableMissing(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? error);
  return msg.includes('relation') && msg.includes('does not exist');
}

// GET /articles/:id/comments
app.get('/articles/:id/comments', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('knowledge_comments')
    .select('*')
    .eq('article_id', id)
    .order('created_at', { ascending: true });
  if (error && isTableMissing(error)) return c.json({ success: true, data: [] });
  if (error) return c.json({ success: false, error: String(error) }, 500);
  return c.json({ success: true, data: data ?? [] });
});

// GET /articles/:id/versions
app.get('/articles/:id/versions', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('knowledge_versions')
    .select('id, article_id, title, edited_by, edited_at, created_at')
    .eq('article_id', id)
    .order('created_at', { ascending: false });
  if (error && isTableMissing(error)) return c.json({ success: true, data: [] });
  if (error) return c.json({ success: false, error: String(error) }, 500);
  return c.json({ success: true, data: data ?? [] });
});

// GET /articles/:id/versions/:versionId
app.get('/articles/:id/versions/:versionId', async (c) => {
  const versionId = c.req.param('versionId');
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('knowledge_versions')
    .select('*')
    .eq('id', versionId)
    .single();
  if (error && isTableMissing(error)) return c.json({ success: false, error: 'Not found' }, 404);
  if (error) return c.json({ success: false, error: String(error) }, 500);
  return c.json({ success: true, data });
});

// POST /articles/:id/comments
app.post('/articles/:id/comments', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const comment = {
    id: crypto.randomUUID(),
    article_id: id,
    author_id: body.authorId,
    author_name: body.authorName,
    content: body.content,
    created_at: new Date().toISOString(),
  };
  const supabase = getSupabase();
  const { data, error } = await supabase.from('knowledge_comments').insert({ ...comment, ...auditCreate(c) }).select().single();
  if (error && isTableMissing(error)) return c.json({ success: true, data: comment });
  if (error) return c.json({ success: false, error: String(error) }, 500);
  return c.json({ success: true, data: data ?? comment });
});

// ==================== STATS ====================

app.get('/stats', async (c) => {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('knowledge_articles').select('status, views, likes');

    return c.json({
      success: true,
      data: {
        totalArticles: data?.length || 0,
        publishedArticles: data?.filter((a: any) => a.status === 'Published').length || 0,
        totalViews: data?.reduce((s: number, a: any) => s + (a.views || 0), 0) || 0,
        totalLikes: data?.reduce((s: number, a: any) => s + (a.likes || 0), 0) || 0,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

export default app;
