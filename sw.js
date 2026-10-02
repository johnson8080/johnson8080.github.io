const CACHE = "fuel-trips-v5";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-48.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.searchParams.has("__v")) return; // update check: always go to the network

  // The app page: network first (so updates arrive). If the network is slow
  // (over 4 seconds) or offline, open the saved copy instead.
  if (req.mode === "navigate") {
    e.respondWith(
      new Promise((resolve) => {
        let done = false;
        const fallback = () =>
          caches.match("index.html").then((r) => r || caches.match("./"));
        const timer = setTimeout(() => {
          fallback().then((r) => {
            if (r && !done) { done = true; resolve(r); }
          });
        }, 4000);
        fetch(req)
          .then((res) => {
            clearTimeout(timer);
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("index.html", copy));
            if (!done) { done = true; resolve(res); }
          })
          .catch(() => {
            clearTimeout(timer);
            if (!done) {
              done = true;
              fallback().then((r) => resolve(r || Response.error()));
            }
          });
      })
    );
    return;
  }

  // Everything else (icons, fonts): cache first, refresh in background
  if (url.origin === location.origin || url.hostname==="fonts.googleapis.com" || url.hostname.endsWith("gstatic.com")) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === "opaque")) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
});
