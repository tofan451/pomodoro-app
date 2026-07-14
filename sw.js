/* Focus — service worker.
   App shell (index/styles/app.js): network-first so updates arrive
   immediately, with the cache as the offline fallback.
   Big static assets (sounds, icons, backgrounds): cache-first, cached on
   first use, so the installed app works offline without re-downloading. */

const CACHE = "focus-v2";
const CORE = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest"];
const CACHE_FIRST = /\/(sounds|icons|backgrounds)\//;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

function cachePut(request, response) {
  if (response && response.ok && response.status === 200) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // Google APIs etc. go straight out

  if (CACHE_FIRST.test(url.pathname)) {
    event.respondWith(
      caches
        .match(request)
        .then((hit) => hit || fetch(request).then((res) => cachePut(request, res)))
    );
    return;
  }

  // App shell: network-first, cache fallback (offline).
  event.respondWith(
    fetch(request)
      .then((res) => cachePut(request, res))
      .catch(() =>
        caches
          .match(request, { ignoreSearch: request.mode === "navigate" })
          .then((hit) => hit || (request.mode === "navigate" ? caches.match("index.html") : Promise.reject(new Error("offline"))))
      )
  );
});
