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
 *  - CACHE_VERSION is the release number, and scripts/bump-version.js moves
 *    it alongside app.html/version.json/CHANGELOG.md, with
 *    check-version-sync.js enforcing the agreement. It used to be a hand-
 *    bumped "v1" that nobody remembered: 0.10.0 shipped still reading "v1",
 *    which is what prompted wiring it into the gate that already existed for
 *    exactly this drift class.
 *
 *    What the bump is FOR, stated precisely, because it is easy to
 *    overstate: app.html is NETWORK-FIRST and every online load copies the
 *    fresh response back into this cache, so the offline fallback of the app
 *    itself is never stale for anyone who has opened it online — a missed
 *    bump costs that nothing. It matters for the CACHE-FIRST branch below
 *    (manifest, icons, vendor/firebase/*.js), which never revalidates: once
 *    one of those is cached it is pinned for the life of the cache, so
 *    changing a vendored SDK file or an icon IN PLACE reaches an already-
 *    installed rebbi only when the cache name changes. Nothing has hit that
 *    yet — the SDK was added, never modified — which is precisely why it is
 *    worth making automatic before something does.
 */
var CACHE_VERSION = "0.11.0";
var CACHE_NAME = "menchmark-" + CACHE_VERSION;
var PRECACHE = [
  "./app.html",
  "./manifest.webmanifest",
  "./branding/menchmark-mark.svg",
  "./icons/icon-maskable.svg"
];
// Deliberately NOT listing vendor/firebase/*.js here: this array is fetched
// unconditionally for every install, tier-1 and tier-2 alike, and CLAUDE.md
// rule 3's amendment requires the tier-2 majority to re-download nothing
// extra. Instead, the SDK gets cached the same way any other same-origin
// asset does — the cache-first branch in the fetch handler below — the
// first time a tier-1 browser actually requests it via <script src>. That's
// still "precached" in the sense that matters (available offline after
// first load); it's just never eagerly fetched for someone who never asks.

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

  // version.json is the update check's answer and must never come from cache.
  // The cache-first branch below would otherwise pin it to whatever was true
  // the first time it was fetched, so the app would keep reporting itself up
  // to date forever — the exact failure the check exists to catch. Straight to
  // the network; if that fails the check fails silent, which is intended.
  if(url.pathname.indexOf("/version.json") >= 0) return;

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
