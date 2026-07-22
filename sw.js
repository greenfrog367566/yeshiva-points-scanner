/* Menchmark service worker — offline shell + safe update strategy.
 *
 * CACHE VERSIONING / UPDATE STRATEGY (the important part):
 *  - HTML (app.html and any navigation) is served NETWORK-FIRST: when online
 *    the browser always fetches the freshly deployed file, so a push to
 *    GitHub Pages reaches teachers immediately — there is no "stale app" trap.
 *    The network response is copied into the cache so the SAME version is
 *    available offline as a fallback.
 *  - Static same-origin assets (manifest, icons) are cache-first.
 *  - Cross-origin requests (Google Sheets, the AI proxy, Sefaria) are left
 *    entirely alone — the SW never intercepts them.
 *  - skipWaiting() + clients.claim() make a new SW take control right away.
 *  - Bump CACHE_VERSION on each release to purge the old offline cache. Even
 *    if you forget, online users still get the latest app.html via
 *    network-first; the bump only refreshes the OFFLINE fallback copy.
 */
var CACHE_VERSION = "v1";
var CACHE_NAME = "menchmark-" + CACHE_VERSION;
var PRECACHE = [
  "./app.html",
  "./manifest.webmanifest",
  "./branding/menchmark-mark.svg",
  "./icons/icon-maskable.svg"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache){ return cache.addAll(PRECACHE); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys
        .filter(function(k){ return k.indexOf("menchmark-") === 0 && k !== CACHE_NAME; })
        .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event){
  var req = event.request;
  if(req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch(e){ return; }
  // Never touch cross-origin traffic — Sheets sync, AI proxy, Sefaria, etc.
  if(url.origin !== self.location.origin) return;

  var isHTML = req.mode === "navigate" ||
    (req.headers.get("accept") || "").indexOf("text/html") >= 0;

  if(isHTML){
    // Network-first: fresh deploy wins when online; cache is the offline net.
    event.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(m){ return m || caches.match("./app.html"); });
      })
    );
    return;
  }

  // Cache-first for same-origin static assets.
  event.respondWith(
    caches.match(req).then(function(m){
      if(m) return m;
      return fetch(req).then(function(res){
        if(res && res.ok){
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(c){ c.put(req, copy); });
        }
        return res;
      });
    })
  );
});

// Lets the page trigger an immediate activation of a waiting SW if desired.
self.addEventListener("message", function(event){
  if(event.data === "skipWaiting") self.skipWaiting();
});
