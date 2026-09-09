# 0012 — Swahili is a route group sharing components, and revalidation is by path

**Status:** accepted · **Date:** 2026-09-09

## Decision
`/sw` is a route group whose pages import the same server components as the English ones and pass them
a different message lookup from a single catalogue holding both languages (`lib/i18n/messages.ts`).
`guard:i18n` fails the build when a Swahili entry is missing, empty, or still the English string.

Separately: cached catalogue pages are refreshed with `revalidatePath`, not `revalidateTag`.

## Why — one catalogue, one component tree
Two message files drift silently; one file with both languages side by side makes a missing translation
visible in review. The types make a missing key a compile error, but they cannot catch the subtler
failure — a Swahili value that is still the English string — which typechecks and ships a
half-translated page. That is what the guard is for, and it was verified by breaking it deliberately
before it was committed.

Sharing components rather than duplicating the tree means a change to the cart is a change to one cart.
The alternative — a parallel `/sw` tree — is faster to start and guarantees the two diverge.

Translations are Kenyan Swahili as used in commerce, not as taught: "oda" for an order, "lipa" for pay,
English loanwords where the loanword is what people actually say. "VAT", "M-Pesa" and the language names
are deliberately identical in both catalogues, and the guard has an explicit exception list for them, so
"same as English" stays a failure everywhere else.

## Why — paths rather than tags for revalidation
Tagged caching in Next means `unstable_cache`, which serialises its value through JSON. Every price on
this site is a `bigint` of minor units (ADR 0004), and `JSON.stringify` throws on a bigint — verified,
not assumed. Tagging catalogue queries would mean converting money to strings going in and back coming
out, adding a conversion at exactly the boundary where a rounding mistake becomes a wrong price charged
to a customer.

Product and category pages are already ISR at 300 seconds, so `revalidatePath` from the admin seam gives
the same "live within a second of the change" behaviour with none of that risk. The seam is the reason
this is cheap: every catalogue mutation already goes through one place (ADR 0009), so revalidation is a
line there rather than something scattered across routes and eventually forgotten.

## Consequences
- Only the pages the brief names — navigation, the cart and checkout, and the key pages — are
  translated. Product copy stays English until the PO has Swahili product descriptions, and the Swahili
  home page says so rather than pretending otherwise.
- `hreflang` is emitted both ways on every translated page, and the language switcher uses real links so
  the other language is shareable and indexable.
- Revalidation failures are logged and swallowed. A page stale for five minutes is not a reason to fail
  a write that already succeeded.
- If a future feature genuinely needs tagged caching, it must keep money out of the cached value.
