# Questions for the PO

Reply in any order; short answers are fine. "Don't know yet" is a valid answer and will be recorded as
an open item rather than guessed.

## Answered by PRODUCT CATALOGUE JULY 2024

The catalogue you sent settled several of these, and the site now uses its answers rather than the
guesses that stood before (ADR 0016):

- **Q1 contact details** — confirmed from page 16 and marked `poConfirmed: true`. The catalogue prints
  two more lines, **+254 732 890 574** and **+254 722 890 574**; they are listed as alternates because
  the document does not say what each is for. See Q18 if one of them is a technical desk.
- **Q5 brand assets** — the logo, the two brand colours and the "Clean, safer, healthier" strapline are
  taken from the catalogue. The interim droplet is gone. See Q19: a vector original would still help.
- **Q6 brands** — the A. L. Wilson spotting range (Yellow Go, Qwik Go, Tar Go Dry) is recorded as
  distributed; everything else is recorded as Safuney's own. Correct that if it is wrong.
- **Q11 catalogue** — done. Nine sections, 76 products, 102 packs and a photograph of nearly every one
  are now seeded from it.

## Still open after the catalogue — these block launch

13. **Prices.** The catalogue has no prices, and this is the only thing it could not supply. Until a
    price list arrives, every pack shows "Price on request" and offers a quote; the cart refuses to
    sell an unpriced pack. Send the list in any format — a spreadsheet, a PDF or a photo of a printed
    one — and it becomes the catalogue CSV.
14. **Safety data sheets.** Every product currently carries **no hazard class**, deliberately: the
    catalogue names caustics, acids, chlorine donors, peroxides and an alcohol sanitiser, but a hazard
    mark on a product page is a safety claim and the SDS is the only source we will take it from.
    Send the SDS set and the marks, the storage warnings and the compliance library all populate.
15. **Pack sizes the catalogue does not state.** These 17 are listed without a pack size rather than
    with a guessed one: SAF BACTOSAN, LIMEKLIN, PRIMA RESHINE, SAF DEGREASER, MULTI-POL FURNITURE
    POLISH, SAFTEX LIQUID, SAFTEX ACID, SAF OZONIT, SAF MULTIKLIN (fragrance-free), DIPSHINE, HYDROGEN
    PEROXIDE 35% and 50%, SAFLIN RUST AWAY, FABRON SPOTTER B, BACTRO ZYME TABLETS, YELLOW GO, QWIK GO,
    TAR GO DRY. The 21 equipment lines have no pack sizes either — tell us how they are sold (each, by
    the pair, by the case).
16. **P.O. Box.** The catalogue prints "P.O BOX 34079 - 0100". The site shows **00100** on the
    assumption that is the Nairobi GPO code. Confirm or correct.
17. **Product photography.** The pack shots come out of the PDF at around 130 px across, which is
    enough for a product tile and thin for a product page. Higher-resolution originals, if they exist,
    drop straight in.
18. **Technical line.** Is one of the three phone numbers a technical or advice desk rather than sales?
    The header already supports a separate technical line and shows it the moment it is set.
19. **Logo original.** Is there an SVG or high-resolution version of the logo? The lock-up on the site
    is the catalogue's own bitmap at 275 x 84, which is enough at header size; the mark had to be
    redrawn as vector to survive a 512 px app icon.

## Must answer before Phase 1

1. ~~**Contact details.**~~ Answered by the catalogue — see above.
2. **WhatsApp.** Which number should the WhatsApp click-to-chat use? Is it the same as the phone above?
3. **Opening hours** (weekdays, Saturday, Sunday/public holidays).
4. **Registered company name, KRA PIN, VAT registration number** (and whether you are VAT-registered).
5. ~~**Brand assets.**~~ Answered by the catalogue — see above, and Q19.
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
11. ~~**Catalogue.**~~ Received and seeded — see above. The **price list** is still outstanding (Q13).
12. **Current-site crawl.** Please run the 5-minute capture in `current-site/README.md` — the build
    environment cannot reach safuney.com, and the redirect map at launch depends on it.

## Needed before Phase 3 (payments) — not now

20. Safaricom Daraja: do you already have a Paybill or Till number? Sandbox app credentials can be created
    at developer.safaricom.co.ke — tell me when you have an account and I will write the steps.
21. Paystack account (test keys first).
22. Africa's Talking account for SMS (sender ID), if you want SMS order updates.

## Needed before Phase 9 (launch) — not now

23. Which registrar / hosting company holds `safuney.com`, and do you have the login?
24. `www.safuney.com` or `safuney.com` as the canonical address? (Recommendation: apex `safuney.com`,
    `www` redirects to it.)

## Things I assumed — say so if wrong

- The site is English-first with a Swahili locale added in Phase 7.
- Kenya is the only delivery country.
- VAT is 16 % on all products unless you say otherwise.
- The catalogue's own pack shots are good enough to launch on; higher-resolution originals replace them without any code change (Q17).
