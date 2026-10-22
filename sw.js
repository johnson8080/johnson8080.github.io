const CACHE = "fuel-trips-v1.8.5";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-maskable-512-v2.png", "icons/apple-touch-icon-v2.png", "icons/favicon-48-v2.png", "icons/splash-ring-192.png", "icons/splash-ring-512.png"];

self.addEventListener("install", (e) => {
  // Add files one by one so a single missing icon cannot stop the whole install
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
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

  // The app page: open the saved copy straight away (so the opening animation
  // starts at once, even on slow data) and refresh the saved copy in the
  // background for the next launch. The app's own "New version" banner still
  // tells you when an update is waiting. A manual reload, or a first visit with
  // nothing saved yet, goes to the network (slow network: saved copy after 4s).
  if (req.mode === "navigate") {
    const keep = (res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("index.html", copy));
      }
      return res;
    };
    const saved = () => caches.match("index.html").then((r) => r || caches.match("./"));
    const reload = req.cache === "reload" || req.cache === "no-cache" || req.cache === "no-store";
    if (!reload) {
      const net = fetch(req).then(keep).catch(() => null);
      e.waitUntil(net);
      e.respondWith(saved().then((hit) => hit || net.then((r) => r || Response.error())));
      return;
    }
    e.respondWith(
      new Promise((resolve) => {
        let done = false;
        const timer = setTimeout(() => {
          saved().then((r) => { if (r && !done) { done = true; resolve(r); } });
        }, 4000);
        fetch(req)
          .then((res) => {
            clearTimeout(timer);
            keep(res);
            if (!done) { done = true; resolve(res); }
          })
          .catch(() => {
            clearTimeout(timer);
            if (!done) { done = true; saved().then((r) => resolve(r || Response.error())); }
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
