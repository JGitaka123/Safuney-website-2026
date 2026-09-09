/**
 * Solutions by industry.
 *
 * Each industry is a real page assembled from the catalogue: the zones that industry cleans, the
 * product areas it buys from, and the questions its buyers actually ask. Nothing here claims a
 * customer, a certification or a case study we do not have — the brief is explicit that case studies
 * ship only when the PO approves real ones, and the honest version of a page with none is a page that
 * does not mention them.
 *
 * The prose is about what the products do, which is knowable from the catalogue and from the trade,
 * not about who has bought them.
 */
import type { ZoneKey } from "@safuney/ui";

export interface Industry {
  slug: string;
  name: string;
  /** One line under the heading. */
  summary: string;
  /** What cleaning in this setting has to achieve, in the buyer's terms. */
  intro: string;
  zones: ZoneKey[];
  /** Category slugs from the catalogue, in the order this buyer cares about them. */
  categories: string[];
  /** What their buyers ask, answered truthfully about the products we sell. */
  faq: Array<{ q: string; a: string }>;
}

export const INDUSTRIES: readonly Industry[] = [
  {
    slug: "hospitality",
    name: "Hospitality",
    summary: "Hotels, lodges and conference venues: guest rooms, kitchens, laundry and public areas.",
    intro:
      "A hotel cleans four very different environments on one shift — guest bathrooms, public floors, a commercial kitchen and a laundry — and the cost of mixing them up is a guest complaint or a failed inspection. Colour-coded zoning keeps the cloth that cleaned a toilet away from a breakfast counter, and correct dilution keeps the cost per room predictable instead of drifting up with every new housekeeper.",
    zones: ["RED", "BLUE", "GREEN"],
    categories: ["housekeeping", "disinfection", "laundry", "foodservice", "specialty"],
    faq: [
      { q: "How do we stop housekeepers over-diluting?", a: "Buy concentrates with a dosing system rather than ready-to-use bottles, and train on the ratio. Every product page shows its dilution and a calculator that turns a room count into litres, so a supervisor can check the figure rather than guess it." },
      { q: "Can one disinfectant cover guest rooms and the kitchen?", a: "A QAC sanitiser approved for food-contact surfaces covers both, but the cloths and the colour coding still have to be separate. Where a washroom needs a stronger kill, a chlorine-based product is the right tool — and must never be mixed with an acidic descaler." },
      { q: "What do we need for an audit?", a: "The safety data sheet for every chemical on site, the dilution chart, and a record that staff were trained. The SDS is on each product page; training is one of our services." },
    ],
  },
  {
    slug: "healthcare",
    name: "Healthcare",
    summary: "Hospitals, clinics and laboratories: infection prevention with a documented method.",
    intro:
      "In clinical settings the cleaning method is part of the infection-prevention plan, not a housekeeping detail. What matters is contact time, the right product for the surface, and a colour code that keeps isolation areas separate from everything else.",
    zones: ["YELLOW", "RED", "BLUE"],
    categories: ["healthcare", "disinfection", "housekeeping", "personal-hygiene", "laboratory"],
    faq: [
      { q: "Why does contact time matter more than concentration?", a: "A disinfectant kills over time at its stated dilution. Wiping it off after ten seconds gives you a clean-looking surface and none of the kill. Every dilution figure on this site assumes the contact time on the label." },
      { q: "Do you supply for isolation areas?", a: "Yellow-zone products for clinical and isolation areas are listed under Healthcare. Keep their cloths, mops and buckets separate from every other zone." },
      { q: "What about hand hygiene?", a: "Alcohol hand sanitiser and washroom hand products are under Personal hygiene. Alcohol works on visibly clean hands; where hands are soiled, soap and water first." },
    ],
  },
  {
    slug: "foodservice",
    name: "Foodservice",
    summary: "Restaurants, canteens and central kitchens: food-contact safe, and fast enough for service.",
    intro:
      "A commercial kitchen is cleaned between services, by people who are already busy, with products that are safe on surfaces food touches. That means a food-contact-approved sanitiser, a degreaser strong enough for extraction canopies and fryers, and a destainer for crockery — used in the right order, because degreasing after sanitising undoes the sanitising.",
    zones: ["GREEN"],
    categories: ["foodservice", "disinfection", "specialty", "personal-hygiene"],
    faq: [
      { q: "Clean first or sanitise first?", a: "Clean first, always. A sanitiser applied over grease sanitises the grease. Degrease, rinse, then sanitise and leave the contact time." },
      { q: "Is a food-contact sanitiser safe without rinsing?", a: "At its stated dilution, a QAC sanitiser sold for food-contact use is designed to be left to air-dry. Above that dilution it is not — which is the practical reason to dose rather than pour." },
      { q: "What removes tea and coffee staining from crockery?", a: "A destainer used as a soak, not a scrub. Scouring damages the glaze and makes the next stain hold faster." },
    ],
  },
  {
    slug: "education",
    name: "Education",
    summary: "Schools, colleges and boarding facilities: classrooms, washrooms, kitchens and dormitories.",
    intro:
      "Schools clean at scale, on a budget, with staff who turn over. That argues for a short product list that covers everything, concentrates that stretch, and a colour code simple enough to survive new staff. Boarding facilities add laundry and a kitchen, and term-time outbreaks make washroom hygiene the thing that actually matters.",
    zones: ["RED", "BLUE", "GREEN"],
    categories: ["housekeeping", "disinfection", "personal-hygiene", "laundry", "foodservice"],
    faq: [
      { q: "How short can our product list be?", a: "For most schools: one general-purpose cleaner-disinfectant, one washroom product, one food-contact sanitiser for the kitchen, hand soap and a laundry detergent. Five products, four colours." },
      { q: "How do we make concentrates last?", a: "Dose them. A 5 L concentrate at 1:40 is 200 L of solution — but only if it is measured. Poured by eye it is closer to 80 L, and the difference is most of a cleaning budget." },
      { q: "What should change during an outbreak?", a: "Increase frequency on touch points and washrooms rather than switching to a stronger chemical. In a school, hand hygiene does more than surface disinfection." },
    ],
  },
  {
    slug: "industrial",
    name: "Industrial",
    summary: "Factories, workshops and processing plants: heavy soil, hard surfaces, safety first.",
    intro:
      "Industrial cleaning is mostly degreasing, descaling and drain maintenance, on surfaces that tolerate stronger chemistry than a hotel floor — and around staff who need to know what they are handling. Hazard class, protective equipment and safe storage matter more here than anywhere else on this site, which is why every product carries its hazard mark and its safety data sheet.",
    zones: ["BLUE"],
    categories: ["specialty", "housekeeping", "disinfection", "laboratory"],
    faq: [
      { q: "What must never be stored together?", a: "Chlorine-based products and acidic descalers. Together they release chlorine gas. Separate shelves, and never the same dosing equipment." },
      { q: "Do you supply safety data sheets?", a: "Yes — on the product page and in the SDS library. Print the current version for the site file; the library keeps the version history." },
      { q: "What clears drains without damaging pipework?", a: "An enzyme-based drain and septic treatment, dosed regularly, rather than a caustic opener used in an emergency. It is slower, and it does not eat the pipe." },
    ],
  },
  {
    slug: "facilities-management",
    name: "Facilities management",
    summary: "Contract cleaners and FM providers: multiple sites, one method, costs you can defend.",
    intro:
      "A facilities contractor is judged on consistency across sites and on a cost per square metre that holds. Both come from the same place: a standard product list, dosing rather than pouring, and staff trained on the same method everywhere. Corporate accounts here carry agreed pricing, so a site manager ordering in Nakuru pays what was negotiated in Nairobi.",
    zones: ["RED", "BLUE", "GREEN", "YELLOW"],
    categories: ["housekeeping", "disinfection", "foodservice", "specialty", "personal-hygiene"],
    faq: [
      { q: "Can each site order on our account?", a: "Yes. An organisation account holds your agreed prices, and you can require approval above a threshold so a site cannot commit you beyond it." },
      { q: "Can we repeat an order?", a: "Save an order as a list and reorder it in one action, or set a scheduled delivery so it repeats without anyone having to remember." },
      { q: "How do we prove method to a client?", a: "Colour-coded zoning, the dilution chart per product, safety data sheets on file, and trained staff. We supply all four." },
    ],
  },
];

export function industryBySlug(slug: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}
