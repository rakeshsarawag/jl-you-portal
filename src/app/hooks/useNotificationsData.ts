import { useState, useEffect, useCallback } from 'react';
import { supabase, API_BASE, apiHeaders } from '../utils/constants';
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

// Use || so that is_read=false, read=true → still true
function normalize(row: Record<string, unknown>): Notification {
  const isRead = Boolean(row.is_read) || Boolean(row.read);
  return {
    ...(row as Notification),
    body: (row.body ?? row.message ?? '') as string,
    read: isRead,
    is_read: isRead,
    app_filter: (row.app_filter ?? row.app ?? 'all') as string,
  };
}

// Custom event so all useNotifications() instances stay in sync
const NOTIF_EVENT = 'jl-notifications-changed';
export function dispatchNotifChanged() {
  window.dispatchEvent(new Event(NOTIF_EVENT));
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
    // Re-fetch when another hook instance mutates data
    window.addEventListener(NOTIF_EVENT, fetchNotifications);
    return () => {
      clearInterval(interval);
      window.removeEventListener(NOTIF_EVENT, fetchNotifications);
    };
  }, [fetchNotifications]);

  // Realtime subscription for instant updates
  useEffect(() => {
    if (!currentUser?.id) return;
    const notifUserId = currentUser.appUserId ?? currentUser.id;
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
    // Optimistic update
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true, is_read: true } : n));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    // Route through service-role API to bypass RLS
    try {
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PUT',
        headers: apiHeaders(),
      });
    } catch {}
    dispatchNotifChanged();
  }, []);

  const markAllRead = useCallback(async () => {
    if (!currentUser?.id) return;
    const ids = [...new Set([currentUser.id, currentUser.appUserId, currentUser.employeeId].filter(Boolean))] as string[];
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true, is_read: true })));
    setUnreadCount(0);
    // Route through service-role API (supports multiple user_ids, bypasses RLS)
    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PUT',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ids[0], userIds: ids }),
      });
    } catch {}
    dispatchNotifChanged();
  }, [currentUser?.id, currentUser?.appUserId, currentUser?.employeeId]);

  const deleteNotification = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) => {
      const removed = prev.find((n) => n.id === id);
      if (removed && !removed.read) setUnreadCount((c) => Math.max(0, c - 1));
      return prev.filter((n) => n.id !== id);
    });
    // Route through service-role API (users have no DELETE RLS policy)
    try {
      await fetch(`${API_BASE}/notifications/${id}`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });
    } catch {}
    dispatchNotifChanged();
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, deleteNotification, refresh: fetchNotifications };
}
