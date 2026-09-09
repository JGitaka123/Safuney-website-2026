# 0011 — Unconfirmed company facts are never asserted, in structured data or on the page

**Status:** accepted · **Date:** 2026-09-09

## Decision
Every company fact in `apps/web/config/site.ts` carries `poConfirmed`. `LocalBusiness` structured data
emits only the confirmed ones and returns `null` — rendering no script tag at all — when nothing is
confirmed. Pages that would otherwise show certifications, case studies or safety data sheets we do
not have say so in the company's own voice instead, and offer the thing we can actually do.

## Why
The brief asks for compliance and certification pages, case studies, and an SDS library, and is
explicit that only PO-confirmed certifications and real, approved case studies may ship. It also
forbids placeholder text, enforced by `guard:placeholders`. Those two constraints together rule out
the usual answer, which is a page of plausible filler that someone means to replace.

Structured data raises the stakes. It is a claim made to a search engine and shown to a customer as
fact — an address in a knowledge panel is somewhere a person drives. The company facts on this site
were harvested from search-engine snippets because the live site could not be fetched from the build
environment; they are good enough to put in a footer where a human reads them in context, and not good
enough to assert as machine-readable fact.

An empty state is not a failure of the page. "We have not published our safety data sheets yet, because
we are not going to put up a sheet we have not checked against the product in the drum — ask us and we
will send the current versions the same working day" tells a buyer more about the supplier than a list
of PDFs would.

## Consequences
- `localBusinessJsonLd()` returns `null` today, and a test asserts it. When the PO confirms the address
  and phone, flipping `poConfirmed` to `true` is the whole change.
- The KRA PIN and VAT number come from `/admin/settings` rather than config, because the PO enters them
  once and they must appear on tax invoices too. The trust strip shows the "Registered" block only when
  at least one is set.
- Pages with nothing to show still exist, are indexed, and rank for their own name — which is what makes
  them findable when the PO does fill them.

## Alternatives considered
- **Ship the pages with placeholder content and a TODO.** Fails `guard:placeholders`, and in practice
  the placeholder is what launches.
- **Omit the pages until there is content.** Loses the URL and the internal linking, and makes filling
  them a development task rather than an admin one.
