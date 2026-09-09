/**
 * Company facts used across the site.
 *
 * Source: safuney.com (harvested via search-engine snippets on 2026-09-09 because the
 * live site could not be fetched from the build environment). Every value marked
 * `poConfirmed: false` must be confirmed by the product owner before domain cut-over.
 * See docs/discovery/questions-for-po.md.
 */
export const site = {
  legalName: "Safuney Limited",
  shortName: "Safuney",
  tagline:
    "Professional cleaning and hygiene solutions and support services for institutional, hospitality, industrial and commercial customers.",
  contact: {
    phone: { display: "+254 796 808 822", e164: "+254796808822", poConfirmed: false },
    email: { address: "info@safuney.com", poConfirmed: false },
    address: {
      lines: ["Park View Heights, Mombasa Road", "Mezzanine 3, Office A", "Nairobi, Kenya"],
      poBox: "P.O. Box 34079 - 00100, Nairobi",
      poConfirmed: false,
    },
  },
  /** Product areas named on the current site. Order is deliberate: highest-volume first. */
  productAreas: [
    {
      name: "Foodservice and kitchen hygiene",
      blurb: "Detergents, degreasers and disinfectants that keep commercial kitchens clean and safe for staff and customers.",
    },
    {
      name: "Disinfection and sanitisation",
      blurb: "QAC surface and food-contact sanitisers, chlorine-based disinfectants and bleaching solutions, salad and fruit wash, alcohol hand sanitiser.",
    },
    {
      name: "Laundry",
      blurb: "Commercial laundry detergents and fabric conditioners made to deliver results in a single wash.",
    },
    {
      name: "Housekeeping and janitorial",
      blurb: "General-purpose cleaners and disinfectants for floors, washrooms and public areas.",
    },
    {
      name: "Healthcare and medical equipment",
      blurb: "Critical cleaning for demanding human-health and veterinary applications.",
    },
    {
      name: "Laboratory",
      blurb: "Precision cleaning of laboratory equipment, glassware and safety ware.",
    },
    {
      name: "Specialty products",
      blurb: "Descalers, oven, grill and hood cleaners, crockery destainers, enzyme-based drain and septic treatments.",
    },
    {
      name: "Personal hygiene",
      blurb: "Hand-hygiene products for washrooms, kitchens and clinical settings.",
    },
  ],
  services: [
    { name: "Training", blurb: "Staff training that builds professional, consistent cleaning practice." },
    { name: "Equipment service and repair", blurb: "Service and repair for all types of cleaning equipment." },
    { name: "Housekeeping services", blurb: "Managed housekeeping to keep workplaces healthy." },
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
