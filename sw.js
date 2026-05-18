// Niyyah service worker — minimal, conservative.
// Goal: enable PWA install + survive flaky networks. Never serve a stale HTML.

const CACHE = 'niyyah-v1';
const STATIC_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'www.gstatic.com'
];

self.addEventListener('install', (e) => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Auth / Firestore / Functions / Stripe / analytics — never intercept
  if (
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis.com') && !STATIC_HOSTS.includes(url.hostname) ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('stripe.com') ||
    url.hostname.includes('cloudfunctions')
  ) return;

  // Network-first for navigations + the HTML doc — never trap a user on stale UI
  if (req.mode === 'navigate' || (req.destination === '' && url.pathname.endsWith('.html'))) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        const fallback = await caches.match('/');
        if (fallback) return fallback;
        throw e;
      }
    })());
    return;
  }

  // Cache-first for static third-party assets (fonts, chart.js, firebase sdk)
  if (STATIC_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.status === 200) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        if (cached) return cached;
        throw e;
      }
    })());
  }
});
