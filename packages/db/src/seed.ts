/**
 * Seed: loads docs/discovery/catalogue-seed.csv (categories, products, variants) plus baseline
 * settings, delivery zones and feature flags. Idempotent: re-running upserts by slug/sku/key.
 *
 * Every catalogue row from the CSV keeps needsPoReview=true and price 0 until the PO reviews it,
 * and unreviewed products are never shown on the live site.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Unit, ApplicationZone, HazardClass, RelationKind } from "../generated/client/client";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "../../..");

type Row = Record<string, string>;

export function parseCsv(text: string): Row[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  const header = splitCsvLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Row = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const ZONE_BY_CATEGORY: Record<string, ApplicationZone> = {
  foodservice: ApplicationZone.GREEN,
  disinfection: ApplicationZone.GREEN,
  housekeeping: ApplicationZone.BLUE,
  laundry: ApplicationZone.BLUE,
  healthcare: ApplicationZone.YELLOW,
  laboratory: ApplicationZone.YELLOW,
  "personal-hygiene": ApplicationZone.RED,
};

function toUnit(u: string): Unit {
  const key = u.trim().toUpperCase();
  if (key in Unit) return Unit[key as keyof typeof Unit];
  return Unit.PCS;
}

export async function seed(prisma: PrismaClient, csvPath = resolve(REPO_ROOT, "docs/discovery/catalogue-seed.csv")) {
  const rows = parseCsv(readFileSync(csvPath, "utf8"));

  // Categories first (header rows have no product_slug).
  const categoryIds = new Map<string, string>();
  let sort = 0;
  for (const r of rows) {
    if (r["product_slug"]) continue;
    const slug = r["category_slug"]!;
    const cat = await prisma.category.upsert({
      where: { slug },
      create: {
        slug,
        name: r["category_name"]!,
        description: r["short_description"] || null,
        zone: ZONE_BY_CATEGORY[slug] ?? ApplicationZone.NONE,
        sortOrder: sort++,
      },
      update: { name: r["category_name"]!, zone: ZONE_BY_CATEGORY[slug] ?? ApplicationZone.NONE },
    });
    categoryIds.set(slug, cat.id);
  }
  // Parent links (second pass, so order in the CSV does not matter).
  for (const r of rows) {
    if (r["product_slug"] || !r["parent_category_slug"]) continue;
    const parentId = categoryIds.get(r["parent_category_slug"]!);
    if (parentId) await prisma.category.update({ where: { slug: r["category_slug"]! }, data: { parentId } });
  }

  // Products + variants.
  let variants = 0;
  const products = new Set<string>();
  for (const r of rows) {
    const slug = r["product_slug"];
    if (!slug) continue;
    const categoryId = categoryIds.get(r["category_slug"]!);
    if (!categoryId) throw new Error(`Row ${slug}: unknown category ${r["category_slug"]}`);
    const needsReview = (r["needs_po_review"] ?? "true").toLowerCase() !== "false";
    const product = await prisma.product.upsert({
      where: { slug },
      create: {
        slug,
        name: r["product_name"]!,
        brand: r["brand"] || null,
        shortDescription: r["short_description"] || r["product_name"]!,
        categoryId,
        zone: ZONE_BY_CATEGORY[r["category_slug"]!] ?? ApplicationZone.NONE,
        dilutionText: r["dilution_guidance"] || null,
        needsPoReview: needsReview,
        isActive: !needsReview,
      },
      update: {
        name: r["product_name"]!,
        brand: r["brand"] || null,
        shortDescription: r["short_description"] || r["product_name"]!,
        categoryId,
        needsPoReview: needsReview,
      },
    });
    products.add(slug);

    const packValue = r["pack_size"] ? r["pack_size"] : "1";
    const unit = toUnit(r["unit"] || "PCS");
    const packLabel = r["pack_size"] ? `${r["pack_size"]} ${unitLabel(unit)}` : "each";
    const sku = r["sku"] || `${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${packLabel.replace(/\s+/g, "").toUpperCase()}`;
    await prisma.productVariant.upsert({
      where: { sku },
      create: {
        productId: product.id,
        sku,
        packSizeValue: packValue,
        unit,
        packLabel,
        priceMinorUnits: BigInt(r["price_minor_units"] || "0"),
        compareAtMinorUnits: r["compare_at_minor_units"] && r["compare_at_minor_units"] !== "0" ? BigInt(r["compare_at_minor_units"]) : null,
        vatRateBps: Number(r["vat_rate_bps"] || "1600"),
        isActive: true,
      },
      update: {
        packSizeValue: packValue,
        unit,
        packLabel,
        priceMinorUnits: BigInt(r["price_minor_units"] || "0"),
        vatRateBps: Number(r["vat_rate_bps"] || "1600"),
      },
    });
    variants++;
  }

  // Delivery zones from the brief. Fees are 0 and flagged unconfigured until the PO answers Q8.
  const zones = [
    { slug: "nairobi-metro", name: "Nairobi metro", counties: ["Nairobi"], sortOrder: 0 },
    { slug: "kiambu-thika", name: "Kiambu and Thika", counties: ["Kiambu"], sortOrder: 1 },
    { slug: "other-counties", name: "Other counties", counties: [], sortOrder: 2 },
  ];
  for (const z of zones) {
    await prisma.deliveryZone.upsert({
      where: { slug: z.slug },
      create: { ...z, feeRules: [{ feeMinorUnits: "0" }], leadTimeDays: z.slug === "other-counties" ? 3 : 1, isActive: false },
      update: { name: z.name, counties: z.counties },
    });
  }

  const settings: Array<[string, unknown]> = [
    ["pricing.displayMode", "EX_VAT"], // PO question 7; EX_VAT until answered
    ["delivery.configured", false], // PO question 8
    ["orders.minimumMinorUnits", "0"],
    ["company.legalName", "Safuney Limited"],
    ["company.kraPin", ""],
    ["company.vatNumber", ""],
  ];
  for (const [key, value] of settings) {
    await prisma.setting.upsert({ where: { key }, create: { key, value: value as never }, update: {} });
  }

  const flags: Array<[string, string]> = [
    ["shop.enabled", "Show catalogue, cart and checkout navigation"],
    ["advisor.enabled", "AI product advisor (Phase 8)"],
    ["search.semantic", "Voyage + pgvector hybrid search (Phase 8)"],
    ["subscriptions.enabled", "Auto-replenishment (Phase 8)"],
    ["whatsapp.enabled", "WhatsApp ordering (Phase 8)"],
    ["planner.enabled", "Facility hygiene planner (Phase 8)"],
    ["compliance.hub", "SDS/COA library with subscriptions (Phase 8)"],
    ["pwa.enabled", "Offline browsing and queued cart (Phase 8)"],
    ["reps.enabled", "Sales-rep mode (Phase 8)"],
    ["loyalty.enabled", "Volume-tier pricing (Phase 8)"],
    ["stock.live", "Live stock and ETA on product pages (Phase 8)"],
  ];
  for (const [key, description] of flags) {
    await prisma.featureFlag.upsert({ where: { key }, create: { key, description, enabled: false }, update: { description } });
  }

  const demo = process.env["SEED_DEMO"] === "1" ? await seedDemo(prisma) : 0;

  return { categories: categoryIds.size, products: products.size, variants, zones: zones.length, demo };
}

/**
 * SEED_DEMO=1 — preview and CI only. Marks the harvested products as reviewed and gives them
 * illustrative prices, stock, dilution guidance, hazard classes and tags so the catalogue, cart and
 * checkout can be exercised end to end. Every figure here is invented for demonstration and is
 * replaced by the PO's catalogue import. Refuses to run against a production deployment.
 */
export async function seedDemo(prisma: PrismaClient): Promise<number> {
  if (process.env["VERCEL_ENV"] === "production") throw new Error("SEED_DEMO must never run against production");

  const demo: Record<string, {
    price: Record<string, string>; // packLabel -> ex-VAT KES
    stock?: Record<string, number>;
    hazard?: HazardClass;
    tags: string[];
    dilution?: Array<{ use: string; ratio: number; contactTimeMinutes?: number; note?: string }>;
    howToUse: string;
    longDescription: string;
    faq?: Array<{ q: string; a: string }>;
    weightGramsPerLitre?: number;
    extraPacks?: Array<{ value: string; unit: Unit; label: string }>;
  }> = {
    "qac-surface-food-contact-sanitiser": {
      price: { "1 L": "380", "5 L": "1450", "20 L": "5200" },
      stock: { "1 L": 120, "5 L": 42, "20 L": 8 },
      hazard: HazardClass.IRRITANT,
      tags: ["sanitiser", "food-contact", "no-rinse", "concentrate"],
      dilution: [
        { use: "Food-contact surfaces (no rinse)", ratio: 100, contactTimeMinutes: 1 },
        { use: "General surfaces and equipment", ratio: 50, contactTimeMinutes: 5 },
        { use: "Fogging and heavy contamination", ratio: 20, contactTimeMinutes: 10 },
      ],
      howToUse: "Clean the surface first: sanitisers do not work through grease or soil. Dilute with cold water at the ratio for the job, apply with a trigger spray or cloth, keep the surface wet for the contact time, then let it air dry. On food-contact surfaces use the 1:100 dilution and do not rinse.",
      longDescription: "A quaternary ammonium compound (QAC) sanitiser for surfaces that touch food and for general equipment in kitchens, food processing and service areas. Effective against a broad range of bacteria at the stated dilutions and contact times; leaves no odour and does not corrode stainless steel at working strength.",
      faq: [
        { q: "Do I need to rinse after use?", a: "Not at 1:100 on food-contact surfaces. At stronger dilutions, rinse with potable water before food contact." },
        { q: "Can I mix it with bleach?", a: "No. Never mix sanitisers or any cleaning chemicals; use them one at a time and rinse between products." },
      ],
      extraPacks: [{ value: "1", unit: Unit.L, label: "1 L" }, { value: "5", unit: Unit.L, label: "5 L" }, { value: "20", unit: Unit.L, label: "20 L" }],
    },
    "chlorine-salad-fruit-wash-powder": {
      price: { "1 kg": "980" },
      stock: { "1 kg": 25 },
      hazard: HazardClass.OXIDISER,
      tags: ["food-contact", "produce-wash", "chlorine"],
      dilution: [{ use: "Salad and fruit wash", ratio: 500, contactTimeMinutes: 2, note: "Rinse produce with potable water after soaking." }],
      howToUse: "Dissolve the measured powder fully in cold water before adding produce. Soak for the contact time, then rinse under running potable water. Make a fresh solution for each batch.",
      longDescription: "A chlorine-based powder for washing salads, fruit and vegetables in commercial kitchens and food preparation areas. Dissolves quickly and gives a measured chlorine dose per batch.",
      extraPacks: [{ value: "1", unit: Unit.KG, label: "1 kg" }],
    },
    "general-purpose-cleaner-disinfectant": {
      price: { "5 L": "1150", "20 L": "3990" },
      stock: { "5 L": 60, "20 L": 12 },
      hazard: HazardClass.IRRITANT,
      tags: ["disinfectant", "general-cleaning", "concentrate", "floors"],
      dilution: [
        { use: "Daily cleaning of floors and surfaces", ratio: 80, contactTimeMinutes: 5 },
        { use: "Disinfection after spills", ratio: 40, contactTimeMinutes: 10 },
      ],
      howToUse: "Dilute in a bucket or trigger spray, apply to the surface, leave wet for the contact time and wipe or mop off. No rinse needed on floors; rinse food-contact surfaces.",
      longDescription: "A combined cleaner and disinfectant for floors, walls, washrooms and general surfaces in offices, schools, hospitality and healthcare common areas. Cleans and disinfects in one step at the daily dilution.",
      extraPacks: [{ value: "5", unit: Unit.L, label: "5 L" }, { value: "20", unit: Unit.L, label: "20 L" }],
    },
    "chlorine-disinfectant-bleach": {
      price: { "5 L": "690", "20 L": "2400" },
      stock: { "5 L": 100, "20 L": 30 },
      hazard: HazardClass.CORROSIVE,
      tags: ["disinfectant", "chlorine", "laundry", "washrooms"],
      dilution: [
        { use: "Washroom and toilet disinfection", ratio: 20, contactTimeMinutes: 10 },
        { use: "Laundry whitening (per 10 L wash)", ratio: 100 },
        { use: "Blood and body-fluid spills", ratio: 10, contactTimeMinutes: 10, note: "Wear gloves and eye protection." },
      ],
      howToUse: "Always add product to water, never water to product. Use in a ventilated area, wear gloves, and keep away from acids and other cleaners. Make up fresh each day.",
      longDescription: "A sodium hypochlorite disinfectant and bleaching solution for washrooms, isolation areas, laundries and spill response. Broad-spectrum activity at the stated dilutions.",
      extraPacks: [{ value: "5", unit: Unit.L, label: "5 L" }, { value: "20", unit: Unit.L, label: "20 L" }],
    },
    "alcohol-hand-sanitiser": {
      price: { "500 ml": "420", "5 L": "3200" },
      stock: { "500 ml": 200, "5 L": 15 },
      hazard: HazardClass.FLAMMABLE,
      tags: ["hand-hygiene", "alcohol", "ready-to-use"],
      dilution: [{ use: "Hand rub", ratio: 0, note: "Apply 3 ml to dry hands and rub until dry, about 30 seconds." }],
      howToUse: "Apply to dry hands and rub all surfaces, including between the fingers and around the thumbs, until dry. Do not rinse or wipe. Keep away from flames and heat.",
      longDescription: "An alcohol-based hand rub for washrooms, kitchens, reception areas and clinical settings, in a 500 ml dispenser bottle and a 5 L refill.",
      extraPacks: [{ value: "500", unit: Unit.ML, label: "500 ml" }, { value: "5", unit: Unit.L, label: "5 L" }],
    },
    "descaler-kitchen-housekeeping": {
      price: { "5 L": "1650" },
      stock: { "5 L": 18 },
      hazard: HazardClass.CORROSIVE,
      tags: ["descaler", "acid", "kettles", "dishwashers", "concentrate"],
      dilution: [
        { use: "Kettles, urns and boilers", ratio: 10, contactTimeMinutes: 20 },
        { use: "Dishwasher descaling cycle", ratio: 20, contactTimeMinutes: 15 },
        { use: "Taps, sinks and tiles", ratio: 40, contactTimeMinutes: 5 },
      ],
      howToUse: "Wear gloves and eye protection. Dilute, apply or circulate, allow the contact time, then rinse thoroughly with clean water. Do not use on marble, terrazzo or enamel.",
      longDescription: "An acidic descaler that removes limescale from kettles, urns, dishwashers, boilers, taps and tiled surfaces in kitchens and housekeeping.",
      extraPacks: [{ value: "5", unit: Unit.L, label: "5 L" }],
    },
    "oven-grill-hood-cleaner": {
      price: { "5 L": "1850", "20 L": "6400" },
      stock: { "5 L": 22, "20 L": 5 },
      hazard: HazardClass.CORROSIVE,
      tags: ["degreaser", "ovens", "extraction-hoods", "heavy-duty"],
      dilution: [
        { use: "Ovens and grills (cold)", ratio: 0, contactTimeMinutes: 15, note: "Apply neat to a cold surface." },
        { use: "Extraction hoods and filters", ratio: 5, contactTimeMinutes: 10 },
        { use: "Fryers and heavy grease", ratio: 3, contactTimeMinutes: 15 },
      ],
      howToUse: "Switch the appliance off and let it cool. Wear gloves, goggles and an apron. Apply, allow the contact time, agitate with a pad, then rinse thoroughly. Not for aluminium.",
      longDescription: "A heavy-duty alkaline degreaser for ovens, grills, extraction hoods, filters and fryers in commercial kitchens. Breaks down burnt-on carbon and grease.",
      faq: [{ q: "Can it be used on aluminium?", a: "No. It is an alkaline product and will discolour and pit aluminium. Use it on stainless steel, enamel and cast iron only." }],
    },
    "crockery-cutlery-destainer": {
      price: { "15 kg": "5900" },
      stock: { "15 kg": 6 },
      hazard: HazardClass.OXIDISER,
      tags: ["destainer", "dishwashing", "chlorine", "powder"],
      dilution: [{ use: "Soak tank for crockery and cutlery", ratio: 200, contactTimeMinutes: 20, note: "Rinse in the dishwasher after soaking." }],
      howToUse: "Dissolve in hot water in a soak tank, immerse crockery and cutlery for the contact time, then run through the dishwasher. Do not soak silver-plated cutlery.",
      longDescription: "A chlorinated powder that removes tea, coffee and tannin stains from crockery and cutlery in a soak tank before machine washing.",
    },
    "enzyme-drain-septic-treatment": {
      price: { "5 L": "2100" },
      stock: { "5 L": 14 },
      hazard: HazardClass.NONE,
      tags: ["drains", "septic", "biological", "odour-control"],
      dilution: [
        { use: "Drain maintenance (weekly, per drain)", ratio: 0, note: "Pour 250 ml down the drain last thing at night." },
        { use: "Septic tank (per 5,000 L, monthly)", ratio: 0, note: "Flush 1 L down the nearest toilet." },
      ],
      howToUse: "Use at the end of the day so the enzymes work overnight without being flushed away. Do not use with bleach or acid within 12 hours.",
      longDescription: "A biological drain cleaner and septic tank treatment. Enzymes and bacteria digest fat, oil and grease in drains, grease traps and septic systems and control odour without corrosive chemicals.",
      extraPacks: [{ value: "5", unit: Unit.L, label: "5 L" }],
    },
  };

  let count = 0;
  for (const [slug, d] of Object.entries(demo)) {
    const product = await prisma.product.findUnique({ where: { slug }, include: { variants: true } });
    if (!product) continue;
    await prisma.product.update({
      where: { id: product.id },
      data: {
        needsPoReview: false,
        isActive: true,
        hazardClass: d.hazard ?? HazardClass.NONE,
        tags: d.tags,
        dilutionGuidance: d.dilution ?? [],
        howToUse: d.howToUse,
        longDescription: d.longDescription,
        faq: d.faq ?? [],
      },
    });
    for (const pack of d.extraPacks ?? []) {
      const sku = `${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${pack.label.replace(/\s+/g, "").toUpperCase()}`;
      await prisma.productVariant.upsert({
        where: { sku },
        create: { productId: product.id, sku, packSizeValue: pack.value, unit: pack.unit, packLabel: pack.label },
        update: {},
      });
    }
    const variants = await prisma.productVariant.findMany({ where: { productId: product.id } });
    for (const v of variants) {
      const price = d.price[v.packLabel];
      if (!price) {
        // Placeholder "each" variant from the CSV that the demo has replaced with real pack sizes.
        if (v.packLabel === "each" && Object.keys(d.price).length > 0) await prisma.productVariant.delete({ where: { id: v.id } });
        continue;
      }
      const litres = v.unit === Unit.L ? Number(v.packSizeValue) : v.unit === Unit.ML ? Number(v.packSizeValue) / 1000 : v.unit === Unit.KG ? Number(v.packSizeValue) : Number(v.packSizeValue) / 1000;
      await prisma.productVariant.update({
        where: { id: v.id },
        data: {
          priceMinorUnits: BigInt(price) * 100n,
          stockOnHand: d.stock?.[v.packLabel] ?? 10,
          stockReserved: 0,
          weightGrams: Math.round(litres * (d.weightGramsPerLitre ?? 1050)) + 150,
          isActive: true,
          sortOrder: Math.round(litres * 10),
        },
      });
    }
    count++;
  }

  // Related products: things that are genuinely used together.
  const bySlug = async (s: string) => (await prisma.product.findUnique({ where: { slug: s } }))?.id;
  const pairs: Array<[string, string, RelationKind]> = [
    ["oven-grill-hood-cleaner", "general-purpose-cleaner-disinfectant", RelationKind.FREQUENTLY_BOUGHT_TOGETHER],
    ["qac-surface-food-contact-sanitiser", "general-purpose-cleaner-disinfectant", RelationKind.FREQUENTLY_BOUGHT_TOGETHER],
    ["chlorine-disinfectant-bleach", "enzyme-drain-septic-treatment", RelationKind.ALTERNATIVE],
    ["crockery-cutlery-destainer", "descaler-kitchen-housekeeping", RelationKind.FREQUENTLY_BOUGHT_TOGETHER],
  ];
  for (const [a, b, kind] of pairs) {
    const [fromProductId, toProductId] = [await bySlug(a), await bySlug(b)];
    if (!fromProductId || !toProductId) continue;
    await prisma.productRelation.upsert({
      where: { fromProductId_toProductId_kind: { fromProductId, toProductId, kind } },
      create: { fromProductId, toProductId, kind },
      update: {},
    });
  }
  await prisma.featureFlag.upsert({ where: { key: "shop.enabled" }, create: { key: "shop.enabled", enabled: true }, update: { enabled: true } });

  // Illustrative delivery rules so checkout can be exercised (PO question 8 replaces these).
  const zoneRules: Record<string, { feeRules: unknown; freeAboveMinorUnits: bigint | null; slots: string[]; leadTimeDays: number }> = {
    "nairobi-metro": { feeRules: [{ maxWeightGrams: 15000, maxOrderMinorUnits: "1000000", feeMinorUnits: "35000" }, { maxWeightGrams: 60000, feeMinorUnits: "70000" }, { feeMinorUnits: "150000" }], freeAboveMinorUnits: 2500000n, slots: ["Morning (8 am to 12 pm)", "Afternoon (12 pm to 5 pm)"], leadTimeDays: 1 },
    "kiambu-thika": { feeRules: [{ maxWeightGrams: 15000, feeMinorUnits: "60000" }, { maxWeightGrams: 60000, feeMinorUnits: "110000" }, { feeMinorUnits: "220000" }], freeAboveMinorUnits: 4000000n, slots: ["Next working day"], leadTimeDays: 2 },
    "other-counties": { feeRules: [{ maxWeightGrams: 30000, feeMinorUnits: "150000" }, { maxWeightGrams: 100000, feeMinorUnits: "350000" }], freeAboveMinorUnits: null, slots: ["Courier, 2 to 4 working days"], leadTimeDays: 3 },
  };
  for (const [slug, z] of Object.entries(zoneRules)) {
    await prisma.deliveryZone.update({ where: { slug }, data: { feeRules: z.feeRules as never, freeAboveMinorUnits: z.freeAboveMinorUnits, slots: z.slots, leadTimeDays: z.leadTimeDays, isActive: true } });
  }
  await prisma.setting.upsert({ where: { key: "delivery.configured" }, create: { key: "delivery.configured", value: true }, update: { value: true } });
  return count;
}

function unitLabel(u: Unit): string {
  return { L: "L", ML: "ml", KG: "kg", G: "g", PCS: "pcs" }[u];
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  seed(prisma)
    .then((r) => {
      console.log(`seed: ${r.categories} categories, ${r.products} products, ${r.variants} variants, ${r.zones} delivery zones${r.demo ? `, ${r.demo} demo products priced (SEED_DEMO)` : ""}`);
      return prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
