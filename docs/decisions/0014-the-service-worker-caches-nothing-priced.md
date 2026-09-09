# 0014 — The service worker caches nothing priced, personalised or transactional

**Status:** accepted · **Date:** 2026-09-09

## Decision
The PWA service worker caches the shell and content-hashed static assets. Everything else is
network-first, and these paths are never stored at all: `/api/`, `/cart`, `/checkout`, `/account`,
`/admin`, `/orders`, `/quotes`, `/sales`, `/warehouse`, `/sign-in`, `/advisor`. Any request carrying a
cookie is excluded regardless of path. Offline navigation to something uncached gets a plain page that
says prices and stock need a connection.

## Why
A service worker is the one piece of this site that can show a customer something the server did not
just say. A cached price is a price the customer believes, and the server is the price authority
(non-negotiable #1). Stale stock is the same problem wearing a different hat: it sells a pack that is
already reserved.

The cookie rule exists because path lists rot. A future page under some new prefix that renders a
signed-in customer's data would otherwise be cached and served to whoever opens the browser next on a
shared phone — and shared phones are common in exactly the market this feature is for.

Offline product browsing is still worth having. Kenyan buyers order from phones on patchy connections,
and a catalogue that opens instantly while the signal comes back is genuinely useful. The value is in
the descriptions, the dilution guidance and the safety data — none of which changes minute to minute.

## Consequences
- The offline page is deliberately plain and honest: "prices, stock and anything in your cart need a
  connection — we do not show you a price we cannot stand behind."
- `PwaRegister` **unregisters** the worker and clears its caches when the flag goes off. A service worker
  outlives the page that installed it; without this, switching the feature off would leave every phone
  that ever visited still running the old one, and the flag would stop being a flag.
- Cache names are versioned, and activation deletes everything from an older version.

## Alternatives considered
- **Cache product pages with a short TTL.** Simpler, and it still shows a stale price — just for less
  time. The failure mode is identical, so the mitigation is not one.
- **A workbox-generated worker.** More features, another dependency, and a default caching strategy that
  would have to be fought rather than used.
