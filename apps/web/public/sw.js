/*
 * Service worker for offline product browsing.
 *
 * The rule that shapes everything here: NOTHING with a price, a session or a stock figure is ever
 * cached. A stale price shown offline is a price a customer believes, and the server is the price
 * authority (non-negotiable #1). So this caches the shell and static assets, and serves a plain
 * offline notice for anything else it cannot reach.
 *
 * Registered only when the PWA feature flag is on; see components/site/pwa-register.tsx.
 */
const VERSION = "safuney-v1";
const SHELL = `${VERSION}-shell`;

/** Paths whose responses must never be stored, whatever the request looks like. */
const NEVER_CACHE = [
  "/api/",
  "/cart",
  "/checkout",
  "/account",
  "/admin",
  "/orders",
  "/quotes",
  "/sales",
  "/warehouse",
  "/sign-in",
  "/advisor",
];

const OFFLINE_HTML = `<!doctype html><html lang="en-KE"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — Safuney</title>
<style>body{margin:0;font:16px/1.5 "IBM Plex Sans",system-ui,sans-serif;color:#10202b;background:#f4f7f9;
display:grid;min-height:100vh;place-items:center;padding:24px}main{max-width:34rem}h1{font-size:1.5rem;
margin:0 0 .5rem}p{margin:.5rem 0;color:#4a5c68}a{color:#0b5e73}</style></head><body><main>
<h1>You are offline</h1><p>Pages you have already opened are still available. Prices, stock and anything
in your cart need a connection — we do not show you a price we cannot stand behind.</p>
<p><a href="/">Try again</a></p></main></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(["/", "/products"])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function cacheable(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (NEVER_CACHE.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`) || url.pathname.startsWith(p))) return false;
  // A signed-in response can differ per person; only cache what carries no session.
  if (request.headers.get("cookie")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Static assets: cache first. They are content-hashed, so a hit is always correct.
  if (url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/"))) {
    event.respondWith(
      caches.match(request).then((hit) => hit ?? fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })),
    );
    return;
  }

  // Everything else: network first, so a price is never served from a cache.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && cacheable(request, url)) {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        if (request.mode === "navigate") {
          return new Response(OFFLINE_HTML, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
        }
        return Response.error();
      }),
  );
});
