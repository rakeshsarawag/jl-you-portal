// Service Worker for Portal Jeshan Labs PWA
const CACHE_NAME = 'jeshan-portal-v1.1.0';
const DATA_CACHE_NAME = 'jeshan-portal-data-v1.1.0';

// Files to cache immediately on install
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll(STATIC_CACHE_URLS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // On localhost, always go to network — no caching so the server stop is visible
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return;
  }

  // Never cache cross-origin requests (Supabase auth, API, etc.)
  // cache.match() ignores Authorization headers by default, so caching auth
  // responses would serve one user's data to another user after a session switch.
  if (url.hostname !== self.location.hostname) {
    return;
  }

  // Handle static assets - cache first, then network
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      });
    }).catch(() => {
      // Return offline page if available
      if (request.destination === 'document') {
        return caches.match('/offline.html');
      }
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

// Push notification — receives payload from server and shows OS notification
self.addEventListener('push', (event) => {
  const defaults = {
    title: 'JL You Portal',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    type: 'info',
    link: '/',
  };

  let payload = defaults;
  if (event.data) {
    try {
      payload = { ...defaults, ...event.data.json() };
    } catch {
      payload = { ...defaults, body: event.data.text() };
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    vibrate: [100, 50, 100],
    tag: `jl-portal-${payload.type}-${Date.now()}`,
    requireInteraction: false,
    silent: false,
    data: { link: payload.link ?? '/' },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Notification click — open or focus the app and navigate to the linked route
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const link = event.notification.data?.link ?? '/';
  const targetUrl = self.location.origin + link;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If the app is already open, focus it and send a navigation message
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'PUSH_NAVIGATE', link });
          return;
        }
      }
      // No existing window — open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

// Helper function to sync data when back online
async function syncData() {
  // Get pending sync items from IndexedDB or Cache Storage
  // This is where you'd implement your offline sync logic
  console.log('[ServiceWorker] Syncing offline data...');
  
  try {
    // Example: sync offline form submissions, messages, etc.
    const cache = await caches.open(DATA_CACHE_NAME);
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (request.url.includes('pending-')) {
        try {
          await fetch(request);
          await cache.delete(request);
        } catch (error) {
          console.error('[ServiceWorker] Sync failed for:', request.url);
        }
      }
    }
    
    console.log('[ServiceWorker] Data sync complete');
  } catch (error) {
    console.error('[ServiceWorker] Sync error:', error);
    throw error;
  }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('[ServiceWorker] Periodic sync:', event.tag);
  
  if (event.tag === 'update-data') {
    event.waitUntil(syncData());
  }
});
