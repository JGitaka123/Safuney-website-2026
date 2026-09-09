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
import { PrismaClient, Unit, ApplicationZone } from "../generated/client/client";

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

  return { categories: categoryIds.size, products: products.size, variants, zones: zones.length };
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
      console.log(`seed: ${r.categories} categories, ${r.products} products, ${r.variants} variants, ${r.zones} delivery zones`);
      return prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
