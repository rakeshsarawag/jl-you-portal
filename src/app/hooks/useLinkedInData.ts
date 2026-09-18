import { useState, useEffect, useCallback } from 'react';
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';
import { toast } from 'sonner';

const LINKEDIN_URL = `${API_BASE}/linkedin`;

async function api(url: string, options?: RequestInit, userEmail?: string) {
  const res = await fetch(url, {
    ...options,
    headers: apiHeaders(userEmail),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return safeJson(res);
}

// ============ POSTS HOOK ============

export function useLinkedInPosts(userEmail?: string) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api(`${LINKEDIN_URL}/posts`, userEmail);
      const list = res?.data ?? res;
      setPosts(Array.isArray(list) ? list : []);
    } catch (err: any) {
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const createPost = useCallback(
    async (body: any) => {
      try {
        const result = await api(`${LINKEDIN_URL}/posts`, {
          method: "POST",
          body: JSON.stringify(body),
        }, userEmail);
        toast.success("Post created");
        await fetchPosts();
        return result;
      } catch (err: any) {
        toast.error("Failed to create post");
        throw err;
      }
    },
    [fetchPosts]
  );

  const updatePost = useCallback(
    async (id: string, body: any) => {
      try {
        const result = await api(`${LINKEDIN_URL}/posts/${id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        }, userEmail);
        toast.success("Post updated");
        await fetchPosts();
        return result;
      } catch (err: any) {
        toast.error("Failed to update post");
        throw err;
      }
    },
    [fetchPosts]
  );

  const deletePost = useCallback(
    async (id: string) => {
      try {
        await api(`${LINKEDIN_URL}/posts/${id}`, { method: "DELETE" }, userEmail);
        toast.success("Post deleted");
        await fetchPosts();
      } catch (err: any) {
        toast.error("Failed to delete post");
        throw err;
      }
    },
    [fetchPosts]
  );

  return { posts, loading, fetchPosts, createPost, updatePost, deletePost };
}

// ============ TEMPLATES HOOK ============

export function useLinkedInTemplates(userEmail?: string) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api(`${LINKEDIN_URL}/templates`, userEmail);
      const list = res?.data ?? res;
      setTemplates(Array.isArray(list) ? list : []);
    } catch (err: any) {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = useCallback(
    async (body: any) => {
      try {
        const result = await api(`${LINKEDIN_URL}/templates`, {
          method: "POST",
          body: JSON.stringify(body),
        }, userEmail);
        toast.success("Template created");
        await fetchTemplates();
        return result;
      } catch (err: any) {
        toast.error("Failed to create template");
        throw err;
      }
    },
    [fetchTemplates]
  );

  const updateTemplate = useCallback(
    async (id: string, body: any) => {
      try {
        const result = await api(`${LINKEDIN_URL}/templates/${id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        }, userEmail);
        toast.success("Template updated");
        await fetchTemplates();
        return result;
      } catch (err: any) {
        toast.error("Failed to update template");
        throw err;
      }
    },
    [fetchTemplates]
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      try {
        await api(`${LINKEDIN_URL}/templates/${id}`, { method: "DELETE" }, userEmail);
        toast.success("Template deleted");
        await fetchTemplates();
      } catch (err: any) {
        toast.error("Failed to delete template");
        throw err;
      }
    },
    [fetchTemplates]
  );

  return {
    templates,
    loading,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}

// ============ EVENTS HOOK ============

export function useLinkedInEvents(userEmail?: string) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api(`${LINKEDIN_URL}/events`, userEmail);
      const list = res?.data ?? res;
      setEvents(Array.isArray(list) ? list : []);
    } catch (err: any) {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const createEvent = useCallback(
    async (body: any) => {
      try {
        const result = await api(`${LINKEDIN_URL}/events`, {
          method: "POST",
          body: JSON.stringify(body),
        }, userEmail);
        toast.success("Event created");
        await fetchEvents();
        return result;
      } catch (err: any) {
        toast.error("Failed to create event");
        throw err;
      }
    },
    [fetchEvents]
  );

  const updateEvent = useCallback(
    async (id: string, body: any) => {
      try {
        const result = await api(`${LINKEDIN_URL}/events/${id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        }, userEmail);
        toast.success("Event updated");
        await fetchEvents();
        return result;
      } catch (err: any) {
        toast.error("Failed to update event");
        throw err;
      }
    },
    [fetchEvents]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      try {
        await api(`${LINKEDIN_URL}/events/${id}`, { method: "DELETE" }, userEmail);
        toast.success("Event deleted");
        await fetchEvents();
      } catch (err: any) {
        toast.error("Failed to delete event");
        throw err;
      }
    },
    [fetchEvents]
  );

  return {
    events,
    loading,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}

// ============ ANALYTICS HOOK ============

export function useLinkedInAnalytics(userEmail?: string) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await api(`${LINKEDIN_URL}/analytics`, userEmail);
        setAnalytics(data);
      } catch (err: any) {
        toast.error("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { analytics, loading };
}
