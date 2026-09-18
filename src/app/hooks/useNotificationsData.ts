import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/constants';
import { useUser } from '../context/UserContext';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  link?: string | null;
  read: boolean;
  is_read: boolean;
  created_at: string;
  message?: string;
  app_filter?: string;
  severity?: string;
}

function normalize(row: Record<string, unknown>): Notification {
  return {
    ...(row as Notification),
    body: (row.body ?? row.message ?? '') as string,
    read: Boolean(row.is_read ?? row.read ?? false),
    is_read: Boolean(row.is_read ?? row.read ?? false),
    app_filter: (row.app_filter ?? row.app ?? 'all') as string,
  };
}

function showBrowserNotification(n: Notification) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(n.title, { body: n.body, icon: '/favicon.ico', tag: n.id });
  } catch {}
}

export function useNotifications() {
  const { currentUser } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const knownIds = useState(() => new Set<string>())[0];

  const fetchNotifications = useCallback(async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    // Notifications may be inserted with auth UUID, app_users.id, or employee_id
    const ids = [...new Set([
      currentUser.id,
      currentUser.appUserId,
      currentUser.employeeId,
    ].filter(Boolean))] as string[];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(100);

    console.log('[Notif] ids:', ids, 'rows:', data?.length ?? 0, 'error:', error);

    const notifs = (data ?? []).map(normalize);

    const isFirstLoad = knownIds.size === 0;
    notifs.forEach((n) => {
      if (!n.read && !knownIds.has(n.id)) {
        if (!isFirstLoad) showBrowserNotification(n);
        knownIds.add(n.id);
      }
    });

    setNotifications(notifs);
    setUnreadCount(notifs.filter((n) => !n.read).length);
    setLoading(false);
  }, [currentUser?.id, currentUser?.appUserId, currentUser?.employeeId]);

  // Request browser notification permission once
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Realtime subscription for instant updates
  useEffect(() => {
    if (!currentUser?.id) return;
    const notifUserId = currentUser.appUserId ?? currentUser.id;
    // Use a unique channel name to avoid reusing an already-subscribed channel
    const channelName = `notif-hook-${notifUserId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${notifUserId}`,
      }, (payload) => {
        const incoming = normalize(payload.new as Record<string, unknown>);
        if (!knownIds.has(incoming.id)) {
          showBrowserNotification(incoming);
          knownIds.add(incoming.id);
          setNotifications((prev) => [incoming, ...prev]);
          if (!incoming.read) setUnreadCount((c) => c + 1);
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentUser?.id, currentUser?.appUserId]);

  const markRead = useCallback(async (id: string) => {
    void supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true, is_read: true } : n));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!currentUser?.id) return;
    const ids = [...new Set([currentUser.id, currentUser.appUserId, currentUser.employeeId].filter(Boolean))] as string[];
    void supabase.from('notifications').update({ is_read: true }).in('user_id', ids).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true, is_read: true })));
    setUnreadCount(0);
  }, [currentUser?.id, currentUser?.appUserId, currentUser?.employeeId]);

  const deleteNotification = useCallback(async (id: string) => {
    void supabase.from('notifications').delete().eq('id', id);
    setNotifications((prev) => {
      const removed = prev.find((n) => n.id === id);
      if (removed && !removed.read) setUnreadCount((c) => Math.max(0, c - 1));
      return prev.filter((n) => n.id !== id);
    });
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, deleteNotification, refresh: fetchNotifications };
}
