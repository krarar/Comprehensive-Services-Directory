// ==============================
// SERVICE WORKER - دليل الخدمات
// Version: 3.0
// ==============================
const CACHE_VERSION = 'v3';
const CACHE_NAME = 'dal-khidmat-' + CACHE_VERSION;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
];

// Install - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => console.log('[SW] Failed to cache:', url, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - network first with cache fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Firebase requests
  if (request.method !== 'GET') return;
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis.com') && url.pathname.includes('/v1/') ) return;
  if (url.hostname.includes('firestore') || url.hostname.includes('storage.googleapis')) return;

  // For HTML - network first, cache fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./') ))
    );
    return;
  }

  // For static assets (fonts, icons, FA) - cache first
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.pathname.match(/\.(png|ico|svg|woff2?|ttf)$/)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Default - stale while revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Background sync for offline posts (future)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-posts') {
    console.log('[SW] Background sync: posts');
  }
});

// Push notifications (future)
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'دليل الخدمات', {
      body: data.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      dir: 'rtl',
      lang: 'ar',
    })
  );
});
