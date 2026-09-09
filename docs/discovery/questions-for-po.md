# Questions for the PO — answer before Phase 1 starts

Reply in any order; short answers are fine. "Don't know yet" is a valid answer and will be recorded as
an open item rather than guessed.

## Must answer before Phase 1

1. **Contact details.** Are these correct and current? Phone **+254 796 808 822**, email
   **info@safuney.com**, office **Park View Heights, Mombasa Road, Mezzanine 3, Office A, Nairobi**,
   **P.O. Box 34079 – 00100 Nairobi**. (All were read from search results, not from the site itself.)
2. **WhatsApp.** Which number should the WhatsApp click-to-chat use? Is it the same as the phone above?
3. **Opening hours** (weekdays, Saturday, Sunday/public holidays).
4. **Registered company name, KRA PIN, VAT registration number** (and whether you are VAT-registered).
5. **Brand assets.** Do you have a logo file (SVG or high-resolution PNG), brand colours, or a brand
   guide? If not, the logo will be taken from the current site and flagged "interim".
6. **Brands.** Which brands does Safuney *distribute*, and which products does it *manufacture or
   private-label*? This decides how product names, "brand" filters and any manufacturer logos appear.
7. **Pricing display.** Show prices **VAT-inclusive** (typical for walk-in and small customers) or
   **VAT-exclusive** with VAT shown as a line (typical for B2B)? Or inclusive for guests and exclusive for
   logged-in organisation accounts?
8. **Delivery.** Delivery zones and fees (Nairobi metro, Kiambu/Thika, other counties), free-delivery
   threshold, minimum order value, pickup address, delivery days/slots, who delivers (own vehicle,
   courier).
9. **Credit terms.** Do you offer credit accounts today? Standard terms (e.g. 30 days), typical limit,
   what documents you require (certificate of incorporation, KRA PIN, trade references), who approves.
10. **Returns policy.** Do you accept returns, on what conditions, and how are damaged deliveries handled?
11. **Catalogue.** Can you send a price list / product list (Excel, PDF or photo)? It will become
    `catalogue-seed.csv`. If none exists, the site can launch with unreviewed items hidden.
12. **Current-site crawl.** Please run the 5-minute capture in `current-site/README.md` — the build
    environment cannot reach safuney.com, and the redirect map at launch depends on it.

## Needed before Phase 3 (payments) — not now

13. Safaricom Daraja: do you already have a Paybill or Till number? Sandbox app credentials can be created
    at developer.safaricom.co.ke — tell me when you have an account and I will write the steps.
14. Paystack account (test keys first).
15. Africa's Talking account for SMS (sender ID), if you want SMS order updates.

## Needed before Phase 9 (launch) — not now

16. Which registrar / hosting company holds `safuney.com`, and do you have the login?
17. `www.safuney.com` or `safuney.com` as the canonical address? (Recommendation: apex `safuney.com`,
    `www` redirects to it.)

## Things I assumed — say so if wrong

- The site is English-first with a Swahili locale added in Phase 7.
- Kenya is the only delivery country.
- VAT is 16 % on all products unless you say otherwise.
- Product photos will be shot by you or a photographer per the Phase 1 guidelines; interim renders are acceptable on previews but not at launch.
