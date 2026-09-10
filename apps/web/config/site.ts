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
   * The catalogue's own nine sections, in the catalogue's own order, with the colour-coded zone each
   * mostly serves (plan §4.1). Slugs match docs/discovery/catalogue-seed.csv — change both together.
   */
  productAreas: [
    {
      slug: "warewashing",
      name: "Warewashing and kitchen hygiene",
      blurb: "Auto-dosed dishwasher detergent and rinse aid, heavy-duty potwash, and a decarbonising soak for pots and pans.",
      zones: ["GREEN"],
    },
    {
      slug: "disinfection",
      name: "Disinfection and sanitisation",
      blurb: "QAC and chlorine chemistry for surfaces and food contact, a powder wash for salads and fruit, and alcohol hand sanitiser.",
      zones: ["RED", "BLUE", "GREEN", "YELLOW"],
    },
    {
      slug: "specialty",
      name: "Speciality products",
      blurb: "Descaling, ovens and grills, crockery destaining, and a caustic drain and fat-trap opener.",
      zones: ["GREEN", "BLUE"],
    },
    {
      slug: "personal-hygiene",
      name: "Personal hygiene",
      blurb: "Germicidal handwash, perfumed or fragrance-free, and a shower gel. Dispenser-ready and used neat.",
      zones: ["RED"],
    },
    {
      slug: "housekeeping",
      name: "Housekeeping, public areas and fitness centres",
      blurb: "Glass, tiles and bathrooms, floor stripping and polishing, carpet shampoo, degreaser, air fresheners and furniture polish.",
      zones: ["BLUE", "RED"],
    },
    {
      slug: "process-hygiene",
      name: "Food, beverage and process hygiene",
      blurb: "Alkaline and acid CIP detergents, peracetic disinfection, a food-safe destainer and raw caustic.",
      zones: ["GREEN"],
    },
    {
      slug: "laundry",
      name: "Laundry",
      blurb: "One-shot and fully built detergent powders, boosters, bleaches, softener, sour, and the A. L. Wilson spotting range.",
      zones: ["BLUE"],
    },
    {
      slug: "bactro",
      name: "Bactro biological range",
      blurb: "Bacterial and enzyme cleaners, liquid and tablet, for washrooms, drains, grease traps and urinals.",
      zones: ["RED"],
    },
    {
      slug: "equipment",
      name: "Cleaning equipment and consumables",
      blurb: "Scrubbing machines, vacuums, janitor carts, wringer buckets, mops, brooms, squeegees, gloves and paper dispensers.",
      zones: [],
    },
  ],
  services: [
    {
      slug: "training",
      name: "Training",
      blurb: "Staff training that builds professional, consistent cleaning practice.",
      detail:
        "On-site training for housekeeping, kitchen and laundry teams: correct dilution, contact times, colour-coded zoning, safe handling and the records auditors ask for.",
    },
    {
      slug: "equipment",
      name: "Equipment service and repair",
      blurb: "Service and repair for all types of cleaning equipment.",
      detail: "Servicing and repair of dosing systems, dispensers, floor machines and laundry dosing so that the chemicals you buy are applied at the ratio they were designed for.",
    },
    {
      slug: "housekeeping",
      name: "Housekeeping services",
      blurb: "Managed housekeeping to keep workplaces healthy.",
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
