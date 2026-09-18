/**
 * usePushNotifications
 *
 * Manages the full browser push subscription lifecycle:
 *   - Checks browser support & current permission
 *   - Uses the VAPID public key stored in VITE_VAPID_PUBLIC_KEY env var
 *   - Subscribes / unsubscribes via PushManager
 *   - Persists the subscription directly to Supabase push_subscriptions table
 *   - Handles service-worker push navigation messages
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../utils/constants';
import { useUser } from '../context/UserContext';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

type Permission = 'default' | 'granted' | 'denied';

export interface UsePushNotificationsResult {
  supported: boolean;
  permission: Permission;
  subscribed: boolean;
  loading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function saveSubscription(userId: string, sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  void supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: (json.keys as Record<string, string>)?.p256dh ?? '',
      auth: (json.keys as Record<string, string>)?.auth ?? '',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
}

async function removeSubscription(endpoint: string): Promise<void> {
  void supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

const STORAGE_KEY = 'push_subscribed';

export function usePushNotifications(): UsePushNotificationsResult {
  const { currentUser } = useUser();
  const navigate = useNavigate();

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    Boolean(VAPID_PUBLIC_KEY);

  const [permission, setPermission] = useState<Permission>(
    supported ? (Notification.permission as Permission) : 'denied'
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setSubscribed(Boolean(existing));
      if (!existing) localStorage.removeItem(STORAGE_KEY);
    });
  }, [supported]);

  useEffect(() => {
    if (!supported) return;
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'PUSH_NAVIGATE' && event.data.link) {
        navigate(event.data.link as string);
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [supported, navigate]);

  const subscribe = useCallback(async () => {
    if (!supported || !currentUser?.id) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as Permission);
      if (perm !== 'granted') return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await saveSubscription(currentUser.id, sub);
      setSubscribed(true);
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (err) {
      console.error('[Push] Subscribe failed:', err);
    } finally {
      setLoading(false);
    }
  }, [supported, currentUser?.id]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removeSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
