/* Improvement Ladder — offline cache */
const CACHE = "il-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Page loads are network-first (with a short timeout) so updates arrive on the
   very next open; everything else is cache-first. Offline always falls back to cache. */
function navFetch(req) {
  return new Promise(resolve => {
    let settled = false;
    const useCache = () => caches.match("./index.html").then(hit => {
      if (hit) { settled = true; resolve(hit); }
    });
    const timer = setTimeout(() => { if (!settled) useCache(); }, 2500);
    fetch(req).then(res => {
      clearTimeout(timer);
      if (res.ok) caches.open(CACHE).then(c => c.put("./index.html", res.clone()));
      if (!settled) { settled = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      if (!settled) caches.match("./index.html").then(hit => { settled = true; resolve(hit); });
    });
  });
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (e.request.mode === "navigate") {
    e.respondWith(navFetch(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
