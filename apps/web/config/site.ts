/**
 * Company facts used across the site.
 *
 * Source: Safuney's own PRODUCT CATALOGUE JULY 2024, page 16 — the address block, the three phone
 * lines, the email and the website are printed there by the company itself, which is why they are
 * marked confirmed. Anything still `poConfirmed: false` is a commitment the catalogue does not make
 * (a WhatsApp line, a technical desk, a delivery promise) and needs the PO's word before cut-over.
 * See docs/discovery/questions-for-po.md.
 */
export const site = {
  legalName: "Safuney Limited",
  shortName: "Safuney",
  /** The company's own strapline, set beside the logo on every catalogue page. */
  strapline: "Clean, safer, healthier",
  /** How the catalogue cover describes the business, under the logo. */
  descriptor: "Cleaning & Hygiene Solutions",
  tagline:
    "Professional cleaning and hygiene solutions and support services for institutional, hospitality, industrial and commercial customers.",
  contact: {
    phone: { display: "+254 796 808 822", e164: "+254796808822", poConfirmed: true },
    /**
     * The other two lines the catalogue prints. It does not say what each is for, so the site lists
     * them as alternates rather than inventing a sales/accounts split they never claimed.
     */
    alternatePhones: [
      { display: "+254 732 890 574", e164: "+254732890574" },
      { display: "+254 722 890 574", e164: "+254722890574" },
    ],
    /** WhatsApp number defaults to the first phone line until the PO confirms a separate one (question 2). */
    whatsapp: { e164: "254796808822", poConfirmed: false },
    /**
     * A separate line for technical advice — dilution, compatibility, what to use on what.
     *
     * The best supplier sites in this trade publish a different number for the technical desk than for
     * sales, because it tells a buyer there is a real technical department rather than a call centre.
     * We do not have one yet, and printing the sales number twice under two labels would fake exactly
     * the signal it is meant to send. So the header renders this only when it is set AND different,
     * and shows the sales line alone until then.
     */
    technical: { display: "", e164: "", poConfirmed: false },
    email: { address: "info@safuney.com", poConfirmed: true },
    address: {
      lines: ["Park View Heights, Mombasa Road", "Mezzanine 3, Office A", "Nairobi, Kenya"],
      /** The catalogue prints "P.O BOX 34079 - 0100"; 00100 is the Nairobi GPO code (PO question 12). */
      poBox: "P.O. Box 34079 - 00100, Nairobi",
      poConfirmed: true,
    },
  },
  nav: {
    primary: [
      { href: "/products", label: "Products" },
      { href: "/solutions", label: "Solutions" },
      { href: "/services", label: "Services" },
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
    help: [
      { href: "/solutions", label: "Solutions by industry" },
      { href: "/resources", label: "Guides and safety data" },
      { href: "/delivery-and-returns", label: "Delivery and returns" },
      { href: "/quote", label: "Request a quote" },
      { href: "/account/credit", label: "Open a credit account" },
      { href: "/account", label: "Corporate account" },
    ],
    legal: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms of sale" },
    ],
  },
  /**
   * The delivery promise, shown in the header.
   *
   * Trade buyers compare on this and it has to be a commitment with numbers in it, not "fast
   * delivery". These are placeholders until the PO confirms the real terms, which is why
   * `poConfirmed` is false and why the header falls back to a claim we can already stand behind.
   */
  delivery: {
    promise: "Nairobi next working day · countrywide 2–3 days",
    freeAbove: "",
    poConfirmed: false,
  },
  /**
   * What the storefront tells a first-time buyer about the company (ADR 0017). Source: the directors'
   * Business Growth Strategy v2 (2 September 2026) — the plant, the reps' territories and eTIMS
   * compliance are stated there as things the company already has.
   */
  company: {
    /** Where the chemicals are blended. */
    plant: "Ruai, Nairobi",
    /** The three sales territories, one rep each. */
    regions: ["Nairobi and Mount Kenya", "the Coast", "Western and Nakuru"],
    /** "eTIMS-compliant supplier" is the line the strategy asks every quotation to carry. */
    etims: true,
  },
  /**
   * The lead offer: a free site survey, and a two-week trial beside the current supplier where it suits
   * the site (growth strategy, Pillar 2). It is a commercial promise the directors have to be ready to
   * honour, so it is one switch: `enabled: false` removes every mention of it from the site.
   */
  offer: {
    enabled: true,
    poConfirmed: false,
    title: "Free site survey",
    summary: "We check what you use and what it costs per clean, then recommend a programme, with a two-week trial where it suits.",
  },
  /**
   * Customers named on the site — only with each customer's written permission (growth strategy,
   * Pillar 5). Empty until the directors confirm who has agreed; the strip does not render while empty.
   */
  clients: [] as string[],
  /** Products put in front of a first-time visitor, in this order. Slugs from the catalogue. */
  featuredProducts: [
    "saf-quartsan",
    "saf-multiklin",
    "saf-autoklin",
    "grease-buster",
    "sanibac",
    "saflin-015-one-shot",
    "bactro-extreme-liquid",
    "safuney-m511",
    "saf-autorinse",
    "sanitouch",
    "saf-window-cleaner",
    "bactro-trap-tablets",
  ],
  /**
   * The catalogue's own nine sections, in the catalogue's own order, with the colour-coded zone each
   * mostly serves (plan §4.1). Slugs match docs/discovery/catalogue-seed.csv — change both together.
   * Blurbs are one short line: a list of what is in the range, not a description of it.
   */
  productAreas: [
    {
      slug: "warewashing",
      name: "Warewashing and kitchen hygiene",
      blurb: "Dishwasher detergent, rinse aid, potwash and pot-and-pan soak.",
      zones: ["GREEN"],
    },
    {
      slug: "disinfection",
      name: "Disinfection and sanitisation",
      blurb: "Sanitisers, chlorine disinfectant, salad wash and hand sanitiser.",
      zones: ["RED", "BLUE", "GREEN", "YELLOW"],
    },
    {
      slug: "specialty",
      name: "Speciality products",
      blurb: "Descaler, oven and grill cleaner, destainer and drain opener.",
      zones: ["GREEN", "BLUE"],
    },
    {
      slug: "personal-hygiene",
      name: "Personal hygiene",
      blurb: "Germicidal handwash and shower gel, dispenser-ready.",
      zones: ["RED"],
    },
    {
      slug: "housekeeping",
      name: "Housekeeping, public areas and fitness centres",
      blurb: "Glass, tiles, floors, carpets, air fresheners and polish.",
      zones: ["BLUE", "RED"],
    },
    {
      slug: "process-hygiene",
      name: "Food, beverage and process hygiene",
      blurb: "CIP detergents, peracetic disinfectant, destainer and caustic.",
      zones: ["GREEN"],
    },
    {
      slug: "laundry",
      name: "Laundry",
      blurb: "Detergent powders, boosters, bleaches, softener and stain spotters.",
      zones: ["BLUE"],
    },
    {
      slug: "bactro",
      name: "Bactro biological range",
      blurb: "Biological cleaners and tablets for washrooms, drains and urinals.",
      zones: ["RED"],
    },
    {
      slug: "equipment",
      name: "Cleaning equipment and consumables",
      blurb: "Machines, trolleys, buckets, mops, brooms, gloves and dispensers.",
      zones: [],
    },
  ],
  services: [
    {
      slug: "training",
      name: "Training",
      blurb: "Dilution, zones and safe handling, taught on site.",
      detail:
        "On-site training for housekeeping, kitchen and laundry teams: correct dilution, contact times, colour-coded zoning, safe handling and the records auditors ask for.",
    },
    {
      slug: "equipment",
      name: "Equipment service and repair",
      blurb: "Dosing systems, dispensers and machines kept working.",
      detail: "Servicing and repair of dosing systems, dispensers, floor machines and laundry dosing so that the chemicals you buy are applied at the ratio they were designed for.",
    },
    {
      slug: "housekeeping",
      name: "Housekeeping services",
      blurb: "Trained, supervised teams, supplied with the right products.",
      detail: "Managed housekeeping teams for offices, institutions and hospitality sites, supplied with the right products, trained on them and supervised.",
    },
  ],
  industries: [
    "Hospitality",
    "Healthcare",
    "Foodservice",
    "Education",
    "Industrial",
    "Agricultural",
    "Gaming and recreation",
    "Country clubs",
    "Maintenance contractors",
  ],
} as const;

export type ProductArea = (typeof site.productAreas)[number];
