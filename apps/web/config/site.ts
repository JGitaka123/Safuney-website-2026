/**
 * Company facts used across the site.
 *
 * Source: safuney.com (harvested via search-engine snippets on 2026-09-09 because the live site could
 * not be fetched from the build environment). Every value marked `poConfirmed: false` must be confirmed
 * by the product owner before domain cut-over. See docs/discovery/questions-for-po.md.
 */
export const site = {
  legalName: "Safuney Limited",
  shortName: "Safuney",
  tagline:
    "Professional cleaning and hygiene solutions and support services for institutional, hospitality, industrial and commercial customers.",
  contact: {
    phone: { display: "+254 796 808 822", e164: "+254796808822", poConfirmed: false },
    /** WhatsApp number defaults to the phone line until the PO confirms a separate one (question 2). */
    whatsapp: { e164: "254796808822", poConfirmed: false },
    email: { address: "info@safuney.com", poConfirmed: false },
    address: {
      lines: ["Park View Heights, Mombasa Road", "Mezzanine 3, Office A", "Nairobi, Kenya"],
      poBox: "P.O. Box 34079 - 00100, Nairobi",
      poConfirmed: false,
    },
  },
  nav: {
    primary: [
      { href: "/products", label: "Products" },
      { href: "/services", label: "Services" },
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
    help: [
      { href: "/delivery-and-returns", label: "Delivery and returns" },
      { href: "/quote", label: "Request a quote" },
      { href: "/account/credit-application", label: "Open a credit account" },
      { href: "/account", label: "Corporate account" },
    ],
    legal: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms of sale" },
    ],
  },
  /** Product areas named on the current site, with the colour-coded zones each serves (plan §4.1). */
  productAreas: [
    {
      slug: "foodservice",
      name: "Foodservice and kitchen hygiene",
      blurb: "Detergents, degreasers and disinfectants that keep commercial kitchens clean and safe for staff and customers.",
      zones: ["GREEN"],
    },
    {
      slug: "disinfection",
      name: "Disinfection and sanitisation",
      blurb: "QAC surface and food-contact sanitisers, chlorine-based disinfectants and bleaching solutions, salad and fruit wash, alcohol hand sanitiser.",
      zones: ["RED", "BLUE", "GREEN", "YELLOW"],
    },
    {
      slug: "laundry",
      name: "Laundry",
      blurb: "Commercial laundry detergents and fabric conditioners made to deliver results in a single wash.",
      zones: [],
    },
    {
      slug: "housekeeping",
      name: "Housekeeping and janitorial",
      blurb: "General-purpose cleaners and disinfectants for floors, washrooms and public areas.",
      zones: ["BLUE", "RED"],
    },
    {
      slug: "healthcare",
      name: "Healthcare and medical equipment",
      blurb: "Critical cleaning for demanding human-health and veterinary applications.",
      zones: ["YELLOW"],
    },
    {
      slug: "laboratory",
      name: "Laboratory",
      blurb: "Precision cleaning of laboratory equipment, glassware and safety ware.",
      zones: [],
    },
    {
      slug: "specialty",
      name: "Specialty products",
      blurb: "Descalers, oven, grill and hood cleaners, crockery destainers, enzyme-based drain and septic treatments.",
      zones: ["GREEN", "BLUE"],
    },
    {
      slug: "personal-hygiene",
      name: "Personal hygiene",
      blurb: "Hand-hygiene products for washrooms, kitchens and clinical settings.",
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
