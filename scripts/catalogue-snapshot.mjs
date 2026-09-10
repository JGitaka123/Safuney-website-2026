#!/usr/bin/env node
/**
 * Catalogue snapshot (ADR 0017).
 *
 * Compiles Safuney's own catalogue — docs/discovery/catalogue-seed.csv, the pack shots listed in
 * catalogue-images.json, and the zones and dosing in catalogue-meta.json — into one JSON file the web app
 * imports: apps/web/lib/catalogue/snapshot.json. The shop window reads it whenever the database is not
 * configured or holds no published products, so the real range is never hidden behind an
 * infrastructure step. Once the database is seeded, the database wins everywhere.
 *
 *   node scripts/catalogue-snapshot.mjs          write the snapshot
 *   node scripts/catalogue-snapshot.mjs --check  exit 1 if the committed snapshot is stale
 *
 * Pack-label, SKU, unit and hazard rules mirror packages/db/src/seed.ts, so a quote raised from the
 * snapshot names the same pack the seeded database will hold. Change both together.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = "apps/web/lib/catalogue/snapshot.json";
const UNIT_LABEL = { L: "L", ML: "ml", KG: "kg", G: "g", PCS: "pcs" };
const HAZARDS = new Set(["NONE", "IRRITANT", "CORROSIVE", "OXIDISER", "FLAMMABLE", "HARMFUL", "ENVIRONMENTAL"]);

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
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

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  });
}

/** The snapshot as a plain object. `root` is the repository root. */
export function buildSnapshot(root = ROOT) {
  const read = (p) => readFileSync(join(root, p), "utf8");
  const rows = parseCsv(read("docs/discovery/catalogue-seed.csv"));
  const images = JSON.parse(read("docs/discovery/catalogue-images.json"));
  const meta = JSON.parse(read("docs/discovery/catalogue-meta.json"));

  const categories = [];
  const products = new Map();
  for (const r of rows) {
    const categorySlug = r["category_slug"];
    if (!r["product_slug"]) {
      categories.push({ slug: categorySlug, name: r["category_name"], description: r["short_description"], zone: meta.zonesByCategory[categorySlug] ?? "NONE" });
      continue;
    }
    // Same rule as the seed: a row is published unless it says otherwise.
    if ((r["needs_po_review"] || "true").toLowerCase() !== "false") continue;

    const slug = r["product_slug"];
    let product = products.get(slug);
    if (!product) {
      const image = images[slug];
      const hazard = (r["hazard_class"] || "").trim().toUpperCase();
      product = {
        slug,
        name: r["product_name"],
        brand: r["brand"] || null,
        categorySlug,
        shortDescription: r["short_description"] || r["product_name"],
        zone: meta.zonesByCategory[categorySlug] ?? "NONE",
        hazardClass: HAZARDS.has(hazard) ? hazard : "NONE",
        dilutionText: r["dilution_guidance"] || null,
        dilutionGuidance: meta.dilutionGuidance[slug] ?? [],
        image: image ? { url: image.url, width: image.width, height: image.height, alt: image.alt } : null,
        variants: [],
      };
      products.set(slug, product);
    }

    const unitKey = (r["unit"] || "PCS").trim().toUpperCase();
    const unit = unitKey in UNIT_LABEL ? unitKey : "PCS";
    const packLabel = r["pack_label"] || (r["pack_size"] ? `${r["pack_size"]} ${UNIT_LABEL[unit]}` : "each");
    const base = slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
    const sku = r["sku"] || (r["pack_size"] ? `${base}-${packLabel.replace(/\s+/g, "").toUpperCase()}` : base);
    product.variants.push({ sku, packLabel, packSizeValue: r["pack_size"] || "1", unit, vatRateBps: Number(r["vat_rate_bps"] || "1600") });
  }

  return { source: "PRODUCT CATALOGUE JULY 2024, via docs/discovery/catalogue-seed.csv", categories, products: [...products.values()] };
}

export function serialise(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const next = serialise(buildSnapshot());
  const target = join(ROOT, OUT);
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(target, "utf8").replace(/\r\n/g, "\n");
    } catch {
      // Missing counts as stale.
    }
    if (current !== next) {
      console.error(`catalogue-snapshot: ${OUT} is out of date. Run \`node scripts/catalogue-snapshot.mjs\` and commit the result.`);
      process.exit(1);
    }
    console.log("catalogue-snapshot: OK — the snapshot matches the catalogue.");
  } else {
    writeFileSync(target, next);
    const s = JSON.parse(next);
    console.log(`catalogue-snapshot: wrote ${OUT} — ${s.categories.length} categories, ${s.products.length} products.`);
  }
}
