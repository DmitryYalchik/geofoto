// Network-first: always fresh when online, works from cache when offline.
const CACHE = 'geofoto-__BUILD_SHA__'; // unique per deploy, set by GitHub Actions
const ASSETS = ['./', './index.html', './manifest.json', './icon-180.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// A weak connection must not leave a white screen: if the server is silent this long, answer from the copy.
const TIMEOUT = 3000;

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // 'no-cache' revalidates with the server instead of taking the browser's HTTP cache (GitHub Pages allows 10 min).
  // A navigation request cannot be copied with options, so it is rebuilt from its URL.
  const req = e.request.mode === 'navigate'
    ? new Request(e.request.url, { cache: 'no-cache' })
    : new Request(e.request, { cache: 'no-cache' });
  // One copy per page: update checks and other ?query requests do not pile up separate copies.
  const key = e.request.mode === 'navigate' || url.search ? url.origin + url.pathname : e.request;
  const net = fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return r;
  });
  net.catch(() => {});
  const cached = () => caches.match(key).then(r => r || caches.match(e.request, { ignoreSearch: true }));
  const slow = new Promise(res => setTimeout(res, TIMEOUT)).then(cached).then(r => r || net);
  e.respondWith(
    Promise.race([net, slow]).catch(() => cached().then(r => r || Response.error()))
  );
});
