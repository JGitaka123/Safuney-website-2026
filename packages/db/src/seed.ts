/**
 * Seed: loads docs/discovery/catalogue-seed.csv (categories, products, variants) plus baseline
 * settings, delivery zones and feature flags. Idempotent: re-running upserts by slug/sku/key.
 *
 * The catalogue is Safuney's own PRODUCT CATALOGUE JULY 2024 — names, pack sizes, dosing and
 * photography are theirs, transcribed rather than invented (ADR 0016). What that document does not
 * contain is prices, so every variant seeds at price 0. A variant priced at 0 is "price on
 * application": it is listed, searchable and photographed, but the cart refuses it and the page
 * asks for a quote instead (see apps/web/lib/cart/service.ts). That keeps non-negotiable #1 — the
 * server is the price authority — while still showing the real range.
 *
 * needsPoReview is therefore false for catalogue rows: the copy is the company's own published
 * copy, and it is the price, not the product, that is missing.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "./password";
import { PrismaClient, Unit, ApplicationZone, HazardClass, RelationKind, UserRole } from "../generated/client/client";

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

/**
 * Colour-coded zone per catalogue category (plan §2.2), and the structured dosing for the dilution
 * calculator and the planner. Both live in docs/discovery/catalogue-meta.json rather than here because
 * the web app's catalogue snapshot (scripts/catalogue-snapshot.mjs, ADR 0017) reads the same figures;
 * one source means the seeded database and the snapshot cannot disagree.
 *
 * A category carries one zone; products that genuinely span zones (a general-purpose sanitiser) get
 * theirs corrected in the admin console. Only ratios the catalogue actually states appear in the dosing:
 * products dosed by mass (g per kg of linen, g per litre of water) are not ratios and would be wrong in
 * a "1 part to N" calculator, so their figures stay in the prose `dilutionText` the CSV carries.
 * `ratio: 0` means used neat.
 */
type Dosing = Array<{ use: string; ratio: number; contactTimeMinutes?: number; note?: string }>;
type CatalogueMeta = { zonesByCategory: Record<string, keyof typeof ApplicationZone>; dilutionGuidance: Record<string, Dosing> };
const META = JSON.parse(readFileSync(resolve(REPO_ROOT, "docs/discovery/catalogue-meta.json"), "utf8")) as CatalogueMeta;
const ZONE_BY_CATEGORY: Record<string, ApplicationZone> = Object.fromEntries(
  Object.entries(META.zonesByCategory).map(([slug, zone]) => [slug, ApplicationZone[zone]]),
);
const DILUTION_GUIDANCE: Record<string, Dosing> = META.dilutionGuidance;

/** Pack-shot manifest written by scripts/extract-catalogue-images.mjs (ADR 0016). */
type CatalogueImage = { url: string; width: number; height: number; alt: string; source: string };
function catalogueImages(): Record<string, CatalogueImage> {
  try {
    return JSON.parse(readFileSync(resolve(REPO_ROOT, "docs/discovery/catalogue-images.json"), "utf8")) as Record<string, CatalogueImage>;
  } catch {
    return {};
  }
}

function toHazard(h: string): HazardClass {
  const key = h.trim().toUpperCase();
  if (key in HazardClass) return HazardClass[key as keyof typeof HazardClass];
  return HazardClass.NONE;
}

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
      // Description is updated too, not only name and zone. Leaving it out meant a corrected seed
      // never reached a database that had already been seeded — which is how the Phase 0 discovery
      // notes survived in the category descriptions long after the CSV was fixed. Nothing in the
      // admin console edits a category description, so there is no operator edit to clobber here.
      update: {
        name: r["category_name"]!,
        description: r["short_description"] || null,
        zone: ZONE_BY_CATEGORY[slug] ?? ApplicationZone.NONE,
      },
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
  const images = catalogueImages();
  let variants = 0;
  const products = new Set<string>();
  for (const r of rows) {
    const slug = r["product_slug"];
    if (!slug) continue;
    const categoryId = categoryIds.get(r["category_slug"]!);
    if (!categoryId) throw new Error(`Row ${slug}: unknown category ${r["category_slug"]}`);
    const needsReview = (r["needs_po_review"] ?? "true").toLowerCase() !== "false";
    const guidance = DILUTION_GUIDANCE[slug];
    const product = await prisma.product.upsert({
      where: { slug },
      create: {
        slug,
        name: r["product_name"]!,
        brand: r["brand"] || null,
        shortDescription: r["short_description"] || r["product_name"]!,
        categoryId,
        zone: ZONE_BY_CATEGORY[r["category_slug"]!] ?? ApplicationZone.NONE,
        hazardClass: toHazard(r["hazard_class"] ?? ""),
        dilutionText: r["dilution_guidance"] || null,
        dilutionGuidance: guidance ?? undefined,
        needsPoReview: needsReview,
        isActive: !needsReview,
      },
      // The catalogue is the source of record for everything except price and stock, so a re-seed
      // corrects copy, dosing and hazard class in a database that was already seeded.
      update: {
        name: r["product_name"]!,
        brand: r["brand"] || null,
        shortDescription: r["short_description"] || r["product_name"]!,
        categoryId,
        zone: ZONE_BY_CATEGORY[r["category_slug"]!] ?? ApplicationZone.NONE,
        hazardClass: toHazard(r["hazard_class"] ?? ""),
        dilutionText: r["dilution_guidance"] || null,
        ...(guidance ? { dilutionGuidance: guidance } : {}),
        needsPoReview: needsReview,
      },
    });
    products.add(slug);

    // The catalogue's own pack shot, cut out of the PDF (ADR 0016). One per product, replaced in
    // place on re-seed so a corrected extraction does not leave the old file orphaned on the page.
    const image = images[slug];
    if (image) {
      const existing = await prisma.productImage.findFirst({ where: { productId: product.id }, orderBy: { sortOrder: "asc" } });
      const data = { productId: product.id, url: image.url, alt: image.alt, width: image.width, height: image.height, sortOrder: 0 };
      if (existing) await prisma.productImage.update({ where: { id: existing.id }, data });
      else await prisma.productImage.create({ data });
    }

    const packValue = r["pack_size"] ? r["pack_size"] : "1";
    const unit = toUnit(r["unit"] || "PCS");
    const packLabel = r["pack_label"] || (r["pack_size"] ? `${r["pack_size"]} ${unitLabel(unit)}` : "each");
    // SKU from the pack, so 5 L and 20 L of the same product are distinct. A product the catalogue
    // lists without a pack size has one variant and takes the bare code — appending a slug of the
    // "Pack size on request" label would put that sentence on the product page as a part number.
    const base = slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
    const sku = r["sku"] || (r["pack_size"] ? `${base}-${packLabel.replace(/\s+/g, "").toUpperCase()}` : base);
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
 * SEED_DEMO=1 — preview and CI only. Gives a subset of the real catalogue illustrative prices,
 * stock and tags so the catalogue, cart and checkout can be exercised end to end. Every figure here
 * is invented for demonstration and is replaced by the PO's price list. Refuses to run against a
 * production deployment.
 */
export async function seedDemo(prisma: PrismaClient): Promise<number> {
  if (process.env["VERCEL_ENV"] === "production") throw new Error("SEED_DEMO must never run against production");

  /**
   * Invented prices, stock and weights for a subset of the real catalogue, so the shop can be driven
   * end to end in preview and CI. Copy, pack sizes, dosing and photography are NOT invented here —
   * they come from the catalogue in the main seed, and writing marketing prose for a real named
   * product would be exactly the placeholder text this project refuses to ship.
   *
   * The products left out keep price 0 on purpose: that is the price-on-application path, and CI
   * should exercise it too. A product whose pack size the catalogue never states (SAF BACTOSAN,
   * LIMEKLIN and fifteen others) is left out on principle as well as on price — a demo price for an
   * unknown pack is a figure with no unit.
   */
  const demo: Record<string, { price: Record<string, string>; stock?: Record<string, number>; tags: string[]; kgPerPack?: Record<string, number> }> = {
    // Deep stock on the 5 L sanitiser on purpose: it is the pack the end-to-end suite orders over and
    // over, and a demo figure that runs out turns the whole run red for a reason that is not a bug.
    "saf-quartsan": { price: { "5 L": "1450", "20 L": "5200" }, stock: { "5 L": 400, "20 L": 40 }, tags: ["sanitiser", "food-contact", "no-rinse", "concentrate"] },
    "saf-autoklin": { price: { "5 L": "1250", "20 L": "4400" }, stock: { "5 L": 30, "20 L": 12 }, tags: ["warewashing", "machine-dosed", "concentrate"] },
    "saf-autorinse": { price: { "5 L": "1380", "20 L": "4900" }, stock: { "5 L": 26, "20 L": 9 }, tags: ["warewashing", "rinse-aid", "machine-dosed"] },
    "saf-guard-hd": { price: { "5 L": "1350", "20 L": "4800" }, stock: { "5 L": 35, "20 L": 11 }, tags: ["warewashing", "potwash", "concentrate"] },
    "safuney-m511": { price: { "5 L": "690", "20 L": "2400" }, stock: { "5 L": 100, "20 L": 30 }, tags: ["disinfectant", "chlorine", "washrooms"] },
    sanitouch: { price: { "5 L": "3200", "20 L": "11500" }, stock: { "5 L": 15, "20 L": 4 }, tags: ["hand-hygiene", "alcohol", "ready-to-use"] },
    "saf-salad-wash": { price: { "4 kg": "3600" }, stock: { "4 kg": 25 }, tags: ["food-contact", "produce-wash", "chlorine"] },
    "grease-buster": { price: { "5 L": "1850", "20 L": "6400" }, stock: { "5 L": 22, "20 L": 5 }, tags: ["degreaser", "ovens", "extraction-hoods", "heavy-duty"] },
    safshine: { price: { "15 kg": "5900" }, stock: { "15 kg": 6 }, tags: ["destainer", "dishwashing", "powder"] },
    "bactro-trap-tablets": { price: { "Tub of 10 x 50 g tablets": "2100" }, stock: { "Tub of 10 x 50 g tablets": 14 }, tags: ["drains", "grease-trap", "biological", "odour-control"] },
    sanibac: { price: { "5 L": "1100", "20 L": "3800" }, stock: { "5 L": 48, "20 L": 16 }, tags: ["hand-hygiene", "soap", "dispenser"] },
    "saf-multiklin": { price: { "5 L": "1050", "20 L": "3600" }, stock: { "5 L": 55, "20 L": 20 }, tags: ["general-cleaning", "concentrate", "floors"] },
    "saf-window-cleaner": { price: { "5 L": "900", "20 L": "3100" }, stock: { "5 L": 40, "20 L": 13 }, tags: ["glass", "ready-to-use", "housekeeping"] },
    "saflin-015-one-shot": { price: { "5 kg": "1900", "20 kg": "6900" }, stock: { "5 kg": 20, "20 kg": 7 }, tags: ["laundry", "powder", "one-shot"] },
  };

  let count = 0;
  for (const [slug, d] of Object.entries(demo)) {
    const product = await prisma.product.findUnique({ where: { slug }, include: { variants: true } });
    if (!product) continue;
    await prisma.product.update({ where: { id: product.id }, data: { tags: d.tags } });
    for (const v of product.variants) {
      const price = d.price[v.packLabel];
      if (!price) continue;
      // Shipping weight: the pack's own contents plus the container. Litres and kilogrammes are close
      // enough for water-like concentrates; a pack with no stated size is treated as 5 units.
      const size = Number(v.packSizeValue) || 5;
      const contentKg = v.unit === Unit.ML ? size / 1000 : v.unit === Unit.G ? size / 1000 : v.unit === Unit.PCS ? 0.05 * size : size;
      await prisma.productVariant.update({
        where: { id: v.id },
        data: {
          priceMinorUnits: BigInt(price) * 100n,
          stockOnHand: d.stock?.[v.packLabel] ?? 10,
          stockReserved: 0,
          weightGrams: Math.round(contentKg * 1050) + 150,
          isActive: true,
          sortOrder: Math.round(contentKg * 10),
        },
      });
    }
    count++;
  }

  // Related products: things that are genuinely used together.
  const bySlug = async (s: string) => (await prisma.product.findUnique({ where: { slug: s } }))?.id;
  const pairs: Array<[string, string, RelationKind]> = [
    ["grease-buster", "saf-bactosan", RelationKind.FREQUENTLY_BOUGHT_TOGETHER],
    ["saf-quartsan", "saf-bactosan", RelationKind.FREQUENTLY_BOUGHT_TOGETHER],
    ["safuney-m511", "bactro-trap-tablets", RelationKind.ALTERNATIVE],
    ["safshine", "limeklin", RelationKind.FREQUENTLY_BOUGHT_TOGETHER],
    ["saf-autoklin", "saf-autorinse", RelationKind.FREQUENTLY_BOUGHT_TOGETHER],
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

  // Demo staff for previews and CI: the password is DEMO_STAFF_PASSWORD (default below), no second factor
  // until they enrol one. Never created in production (this function refuses to run there).
  const staffPassword = hashPassword(process.env["DEMO_STAFF_PASSWORD"] ?? "safuney-demo-2026");
  for (const [email, role, name] of [["sales@safuney.test", UserRole.SALES, "Demo sales"], ["finance@safuney.test", UserRole.FINANCE, "Demo finance"], ["admin@safuney.test", UserRole.ADMIN, "Demo admin"], ["warehouse@safuney.test", UserRole.WAREHOUSE, "Demo warehouse"]] as const) {
    await prisma.user.upsert({ where: { email }, create: { email, name, role, passwordHash: staffPassword, emailVerified: new Date() }, update: { role, passwordHash: staffPassword, isActive: true } });
  }
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
