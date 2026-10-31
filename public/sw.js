// Offline support for the hosted site. On install the app shell (the page and
// the scripts and styles it loads) is saved, so the site opens offline even
// before you've browsed it. After that, content-hashed files are served
// cache-first, and pages, data chunks and ESPN data network-first with the
// saved copy as a fallback.
const CACHE = 'nba-hub-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch('./', { cache: 'no-cache' });
      if (!res.ok) return;
      const html = await res.clone().text();
      await cache.put('./', res);
      const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await Promise.all(assets.map((a) => cache.add(a).catch(() => undefined)));
    })().then(() => self.skipWaiting()),
  );
});
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
  // Page and data: network first, the saved copy as a fallback (the page itself under './').
  e.respondWith(
    fetch(req)
      .then((res) => store(req, res))
      .catch(async () => (await caches.match(req)) || (req.mode === 'navigate' && (await caches.match('./'))) || Response.error()),
  );
});

function store(req, res) {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}
