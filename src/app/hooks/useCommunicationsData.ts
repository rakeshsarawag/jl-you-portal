import { useState, useEffect, useCallback } from 'react';
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';
import { useUser } from '../context/UserContext';
import { toast } from 'sonner';

const COMMS_URL = `${API_BASE}/communications`;

function api(path: string, options: RequestInit = {}, userEmail?: string) {
  return fetch(`${COMMS_URL}${path}`, {
    ...options,
    headers: apiHeaders(userEmail),
  });
}

export function useCommunicationsData() {
  const { currentUser } = useUser();
  const userId = currentUser?.id;
  const userEmail = currentUser?.email;
  const isAdmin =
    currentUser?.roles?.includes('hr') ||
    currentUser?.roles?.includes('admin') ||
    currentUser?.primaryRole === 'hr' ||
    currentUser?.primaryRole === 'admin';

  const [posts, setPosts] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const postsPath = isAdmin ? '/posts' : `/posts${userId ? `?authorId=${userId}` : ''}`;
      const results = await Promise.allSettled([
        api(postsPath, {}, userEmail).then((r) => safeJson(r)),
        api('/announcements', {}, userEmail).then((r) => safeJson(r)),
        api('/polls', {}, userEmail).then((r) => safeJson(r)),
        api('/events', {}, userEmail).then((r) => safeJson(r)),
        api('/channels', {}, userEmail).then((r) => safeJson(r)),
      ]);

      if (results[0].status === 'fulfilled') {
        const data = results[0].value;
        setPosts(Array.isArray(data) ? data : []);
      }
      if (results[1].status === 'fulfilled') {
        const raw = results[1].value;
        const all: any[] = Array.isArray(raw) ? raw : [];
        // Non-admins only see announcements targeted to 'all' or their primary role
        const visible = isAdmin
          ? all
          : all.filter((a) => !a.audience || a.audience === 'all' || a.audience === currentUser?.primaryRole);
        setAnnouncements(visible);
      }
      if (results[2].status === 'fulfilled') {
        const data = results[2].value;
        setPolls(Array.isArray(data) ? data : []);
      }
      if (results[3].status === 'fulfilled') {
        const data = results[3].value;
        setEvents(Array.isArray(data) ? data : []);
      }
      if (results[4].status === 'fulfilled') {
        const data = results[4].value;
        setChannels(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error loading communications data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  // Posts

  const createPost = async (content: string) => {
    try {
      const body = {
        content,
        author_id: userId,
        author_name: currentUser?.name ?? 'Unknown',
        likes: 0,
        created_at: new Date().toISOString(),
      };
      const res = await api('/posts', { method: 'POST', body: JSON.stringify(body) }, userEmail);
      if (!res.ok) throw new Error(await res.text());
      const data = await safeJson(res);
      setPosts((prev) => [data?.post ?? body, ...prev]);
      toast.success('Post published');
    } catch (err: any) {
      toast.error('Failed to create post');
      console.error(err);
    }
  };

  const updatePost = async (id: string, updates: any) => {
    try {
      const res = await api(`/posts/${id}`, { method: 'PUT', body: JSON.stringify(updates) }, userEmail);
      if (!res.ok) throw new Error(await res.text());
      const data = await safeJson(res);
      setPosts((prev) => prev.map((p) => (p.id === id ? (data.post ?? { ...p, ...updates }) : p)));
    } catch (err: any) {
      toast.error('Failed to update post');
      console.error(err);
    }
  };

  const deletePost = async (id: string) => {
    try {
      const res = await api(`/posts/${id}`, { method: 'DELETE' }, userEmail);
      if (!res.ok) throw new Error(await res.text());
      setPosts((prev) => prev.filter((p) => p.id !== id));
      toast.success('Post deleted');
    } catch (err: any) {
      toast.error('Failed to delete post');
      console.error(err);
    }
  };

  // Announcements

  const createAnnouncement = async (announcement: any) => {
    try {
      const body = { ...announcement, created_at: new Date().toISOString() };
      const res = await api('/announcements', { method: 'POST', body: JSON.stringify(body) }, userEmail);
      if (!res.ok) throw new Error(await res.text());
      const data = await safeJson(res);
      const created = data?.announcement ?? body;
      setAnnouncements((prev) => {
        const next = [created, ...prev];
        // Keep pinned ones first in local state
        return [...next.filter((a) => a.pinned), ...next.filter((a) => !a.pinned)];
      });
      toast.success('Announcement created');
      // Fire broadcast notification (best-effort)
      try {
        await fetch(`${API_BASE}/notifications`, {
          method: 'POST',
          headers: apiHeaders(userEmail),
          body: JSON.stringify({
            userId: 'broadcast',
            title: 'New Announcement',
            body: announcement.title,
            type: 'announcement',
            link: '/communications',
          }),
        });
      } catch (_) { /* ignore */ }
    } catch (err: any) {
      toast.error('Failed to create announcement');
      console.error(err);
    }
  };

  const updateAnnouncement = async (id: string, updates: any) => {
    try {
      const res = await api(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(updates) }, userEmail);
      if (!res.ok) throw new Error(await res.text());
      const data = await safeJson(res);
      setAnnouncements((prev) => {
        const next = prev.map((a) => (a.id === id ? (data?.announcement ?? { ...a, ...updates }) : a));
        // Keep pinned ones first in local state
        return [...next.filter((a) => a.pinned), ...next.filter((a) => !a.pinned)];
      });
    } catch (err: any) {
      toast.error('Failed to update announcement');
      console.error(err);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      const res = await api(`/announcements/${id}`, { method: 'DELETE' }, userEmail);
      if (!res.ok) throw new Error(await res.text());
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast.success('Announcement deleted');
    } catch (err: any) {
      toast.error('Failed to delete announcement');
      console.error(err);
    }
  };

  // Events

  const createEvent = async (event: any) => {
    try {
      const body = { ...event, created_at: new Date().toISOString() };
      const res = await api('/events', { method: 'POST', body: JSON.stringify(body) }, userEmail);
      if (!res.ok) throw new Error(await res.text());
      const data = await safeJson(res);
      setEvents((prev) => [data?.event ?? body, ...prev]);
      toast.success('Event created');
    } catch (err: any) {
      toast.error('Failed to create event');
      console.error(err);
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      const res = await api(`/events/${id}`, { method: 'DELETE' }, userEmail);
      if (!res.ok) throw new Error(await res.text());
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast.success('Event deleted');
    } catch (err: any) {
      toast.error('Failed to delete event');
      console.error(err);
    }
  };

  // Polls

  const createPoll = async (poll: any) => {
    try {
      const body = { ...poll, created_at: new Date().toISOString() };
      const res = await api('/polls', { method: 'POST', body: JSON.stringify(body) }, userEmail);
      if (!res.ok) throw new Error(await res.text());
      const data = await safeJson(res);
      setPolls((prev) => [data?.poll ?? body, ...prev]);
      toast.success('Poll created');
    } catch (err: any) {
      toast.error('Failed to create poll');
      console.error(err);
    }
  };

  const vote = async (pollId: string, optionIndex: number) => {
    try {
      const poll = polls.find((p) => p.id === pollId);
      if (!poll) return;
      const voters: string[] = poll.voters ?? [];
      if (voters.includes(userId ?? '')) {
        toast.error("You've already voted on this poll");
        return;
      }
      const options = (poll.options ?? []).map((opt: any, i: number) =>
        i === optionIndex ? { ...opt, votes: (opt.votes ?? 0) + 1 } : opt
      );
      const updates = { options, voters: [...voters, userId ?? ''] };
      const res = await api(`/polls/${pollId}`, { method: 'PUT', body: JSON.stringify(updates) }, userEmail);
      if (!res.ok) throw new Error(await res.text());
      setPolls((prev) => prev.map((p) => (p.id === pollId ? { ...p, ...updates } : p)));
      toast.success('Vote recorded');
    } catch (err: any) {
      toast.error('Failed to record vote');
      console.error(err);
    }
  };

  // Channels

  const createChannel = async (channel: any) => {
    try {
      const body = { ...channel, member_count: 1, created_at: new Date().toISOString() };
      const res = await api('/channels', { method: 'POST', body: JSON.stringify(body) }, userEmail);
      if (!res.ok) throw new Error(await res.text());
      const data = await safeJson(res);
      setChannels((prev) => [data?.channel ?? body, ...prev]);
      toast.success('Channel created');
    } catch (err: any) {
      toast.error('Failed to create channel');
      console.error(err);
    }
  };

  return {
    posts,
    announcements,
    polls,
    events,
    channels,
    loading,
    createPost,
    updatePost,
    deletePost,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    createEvent,
    deleteEvent,
    createPoll,
    vote,
    createChannel,
    refresh: load,
  };
}
