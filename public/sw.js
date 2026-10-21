// Offline support for the hosted site: the app shell is served cache-first
// (its files are content-hashed), ESPN data network-first with a cached
// fallback so recently viewed pages still open without a connection.
const CACHE = 'nba-hub-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const espnData = /(^|\.)espn\.com$/.test(url.hostname);
  if (!sameOrigin && !espnData) return;

  if (sameOrigin && url.pathname.includes('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => store(req, res))));
    return;
  }
  // Page and data: network first, cache as fallback.
  e.respondWith(fetch(req).then((res) => store(req, res)).catch(() => caches.match(req).then((hit) => hit || Response.error())));
});

function store(req, res) {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}
