/**
 * The catalogue round trip.
 *
 * Export writes one row per variant with its product's fields repeated; import reads the same shape.
 * The PO fixes the catalogue in a spreadsheet, so what matters is that a file exported and imported
 * unchanged produces no changes at all, and that a bad row names the column and the value rather than
 * failing the whole upload.
 *
 * Nothing is written until the operator has seen the diff and confirmed it, and then it is written in
 * one transaction: a half-applied price list is worse than a rejected one.
 */
import { db, type HazardClass, type Prisma, type Unit } from "@safuney/db";
import { parseCsv, toCsv, type Row } from "./csv";

export const COLUMNS = [
  "sku",
  "product_slug",
  "product_name",
  "brand",
  "category_slug",
  "short_description",
  "hazard_class",
  "needs_po_review",
  "product_active",
  "pack_label",
  "pack_size_value",
  "unit",
  "price_kes",
  "compare_at_kes",
  "vat_rate_bps",
  "stock_on_hand",
  "low_stock_threshold",
  "made_to_order",
  "variant_active",
  "seo_title",
  "seo_description",
] as const;

const UNITS: Unit[] = ["L", "ML", "KG", "G", "PCS"];
const HAZARDS: HazardClass[] = ["NONE", "IRRITANT", "CORROSIVE", "OXIDISER", "FLAMMABLE", "HARMFUL", "ENVIRONMENTAL"];

export interface RowChange {
  line: number;
  sku: string;
  kind: "new" | "changed" | "unchanged" | "error";
  productName: string;
  /** Field-level diff for a changed row, so the operator sees exactly what moves. */
  changes: Array<{ field: string; from: string; to: string }>;
  error?: string;
}

export interface ImportPlan {
  rows: RowChange[];
  counts: { new: number; changed: number; unchanged: number; error: number };
}

/** "1,250" or "1250.50" → minor units. Rejects anything else rather than guessing. */
function parseKes(raw: string, field: string): bigint {
  const cleaned = raw.replace(/[,\s]|KES/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) throw new Error(`${field}: "${raw}" is not an amount in shillings.`);
  const [whole, frac = ""] = cleaned.split(".");
  return BigInt(whole!) * 100n + BigInt(frac.padEnd(2, "0"));
}

function parseInt10(raw: string, field: string): number {
  if (!/^-?\d+$/.test(raw.trim())) throw new Error(`${field}: "${raw}" is not a whole number.`);
  return Number.parseInt(raw, 10);
}

function parseBool(raw: string, field: string): boolean {
  const v = raw.trim().toLowerCase();
  if (["yes", "true", "1", "y"].includes(v)) return true;
  if (["no", "false", "0", "n", ""].includes(v)) return false;
  throw new Error(`${field}: "${raw}" is not yes or no.`);
}

function money(minor: bigint): string {
  return (Number(minor) / 100).toFixed(2);
}

/** Every active and inactive variant, in the import's own shape. */
export async function exportCatalogue(): Promise<string> {
  const variants = await db().productVariant.findMany({
    include: { product: { include: { category: { select: { slug: true } } } } },
    orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }, { sku: "asc" }],
  });
  const rows: Row[] = variants.map((v) => ({
    sku: v.sku,
    product_slug: v.product.slug,
    product_name: v.product.name,
    brand: v.product.brand ?? "",
    category_slug: v.product.category.slug,
    short_description: v.product.shortDescription,
    hazard_class: v.product.hazardClass,
    needs_po_review: v.product.needsPoReview ? "yes" : "no",
    product_active: v.product.isActive ? "yes" : "no",
    pack_label: v.packLabel,
    pack_size_value: v.packSizeValue.toString(),
    unit: v.unit,
    price_kes: money(v.priceMinorUnits),
    compare_at_kes: v.compareAtMinorUnits === null ? "" : money(v.compareAtMinorUnits),
    vat_rate_bps: String(v.vatRateBps),
    stock_on_hand: String(v.stockOnHand),
    low_stock_threshold: String(v.lowStockThreshold),
    made_to_order: v.isMadeToOrder ? "yes" : "no",
    variant_active: v.isActive ? "yes" : "no",
    seo_title: v.product.seoTitle ?? "",
    seo_description: v.product.seoDescription ?? "",
  }));
  return toCsv([...COLUMNS], rows);
}

interface Parsed {
  sku: string;
  product: { slug: string; name: string; brand: string | null; categorySlug: string; shortDescription: string; hazardClass: HazardClass; needsPoReview: boolean; isActive: boolean; seoTitle: string | null; seoDescription: string | null };
  variant: { packLabel: string; packSizeValue: string; unit: Unit; priceMinorUnits: bigint; compareAtMinorUnits: bigint | null; vatRateBps: number; stockOnHand: number; lowStockThreshold: number; isMadeToOrder: boolean; isActive: boolean };
}

function parseRow(row: Row): Parsed {
  const sku = (row["sku"] ?? "").trim();
  if (!sku) throw new Error("sku: every row needs a SKU.");
  const unit = (row["unit"] ?? "").trim().toUpperCase() as Unit;
  if (!UNITS.includes(unit)) throw new Error(`unit: "${row["unit"]}" is not one of ${UNITS.join(", ")}.`);
  const hazard = ((row["hazard_class"] ?? "NONE").trim().toUpperCase() || "NONE") as HazardClass;
  if (!HAZARDS.includes(hazard)) throw new Error(`hazard_class: "${row["hazard_class"]}" is not one of ${HAZARDS.join(", ")}.`);
  const packSize = (row["pack_size_value"] ?? "").trim();
  if (!/^\d+(\.\d{1,3})?$/.test(packSize)) throw new Error(`pack_size_value: "${packSize}" is not a number.`);
  const name = (row["product_name"] ?? "").trim();
  if (!name) throw new Error("product_name: a product needs a name.");
  const compare = (row["compare_at_kes"] ?? "").trim();
  return {
    sku,
    product: {
      slug: (row["product_slug"] ?? "").trim(),
      name,
      brand: (row["brand"] ?? "").trim() || null,
      categorySlug: (row["category_slug"] ?? "").trim(),
      shortDescription: (row["short_description"] ?? "").trim(),
      hazardClass: hazard,
      needsPoReview: parseBool(row["needs_po_review"] ?? "", "needs_po_review"),
      isActive: parseBool(row["product_active"] ?? "", "product_active"),
      seoTitle: (row["seo_title"] ?? "").trim() || null,
      seoDescription: (row["seo_description"] ?? "").trim() || null,
    },
    variant: {
      packLabel: (row["pack_label"] ?? "").trim(),
      packSizeValue: packSize,
      unit,
      priceMinorUnits: parseKes(row["price_kes"] ?? "", "price_kes"),
      compareAtMinorUnits: compare ? parseKes(compare, "compare_at_kes") : null,
      vatRateBps: parseInt10(row["vat_rate_bps"] ?? "1600", "vat_rate_bps"),
      stockOnHand: parseInt10(row["stock_on_hand"] ?? "0", "stock_on_hand"),
      lowStockThreshold: parseInt10(row["low_stock_threshold"] ?? "5", "low_stock_threshold"),
      isMadeToOrder: parseBool(row["made_to_order"] ?? "", "made_to_order"),
      isActive: parseBool(row["variant_active"] ?? "", "variant_active"),
    },
  };
}

function diffOf(parsed: Parsed, existing: { packLabel: string; packSizeValue: { toString(): string }; unit: string; priceMinorUnits: bigint; compareAtMinorUnits: bigint | null; vatRateBps: number; stockOnHand: number; lowStockThreshold: number; isMadeToOrder: boolean; isActive: boolean; product: { name: string; brand: string | null; shortDescription: string; hazardClass: string; needsPoReview: boolean; isActive: boolean; seoTitle: string | null; seoDescription: string | null; category: { slug: string } } }): Array<{ field: string; from: string; to: string }> {
  const out: Array<{ field: string; from: string; to: string }> = [];
  const cmp = (field: string, from: string, to: string) => { if (from !== to) out.push({ field, from, to }); };
  const p = existing.product;
  cmp("product_name", p.name, parsed.product.name);
  cmp("brand", p.brand ?? "", parsed.product.brand ?? "");
  cmp("category_slug", p.category.slug, parsed.product.categorySlug);
  cmp("short_description", p.shortDescription, parsed.product.shortDescription);
  cmp("hazard_class", p.hazardClass, parsed.product.hazardClass);
  cmp("needs_po_review", p.needsPoReview ? "yes" : "no", parsed.product.needsPoReview ? "yes" : "no");
  cmp("product_active", p.isActive ? "yes" : "no", parsed.product.isActive ? "yes" : "no");
  cmp("seo_title", p.seoTitle ?? "", parsed.product.seoTitle ?? "");
  cmp("seo_description", p.seoDescription ?? "", parsed.product.seoDescription ?? "");
  cmp("pack_label", existing.packLabel, parsed.variant.packLabel);
  cmp("pack_size_value", existing.packSizeValue.toString(), parsed.variant.packSizeValue);
  cmp("unit", existing.unit, parsed.variant.unit);
  cmp("price_kes", money(existing.priceMinorUnits), money(parsed.variant.priceMinorUnits));
  cmp("compare_at_kes", existing.compareAtMinorUnits === null ? "" : money(existing.compareAtMinorUnits), parsed.variant.compareAtMinorUnits === null ? "" : money(parsed.variant.compareAtMinorUnits));
  cmp("vat_rate_bps", String(existing.vatRateBps), String(parsed.variant.vatRateBps));
  cmp("stock_on_hand", String(existing.stockOnHand), String(parsed.variant.stockOnHand));
  cmp("low_stock_threshold", String(existing.lowStockThreshold), String(parsed.variant.lowStockThreshold));
  cmp("made_to_order", existing.isMadeToOrder ? "yes" : "no", parsed.variant.isMadeToOrder ? "yes" : "no");
  cmp("variant_active", existing.isActive ? "yes" : "no", parsed.variant.isActive ? "yes" : "no");
  return out;
}

/**
 * Reads the file and says what would happen. Nothing is written.
 *
 * `pack_size_value` is compared as text on purpose: Postgres returns "5.000" for a Decimal(10,3), and
 * the export writes that back, so a round trip has to compare equal without re-parsing.
 */
export async function planImport(text: string): Promise<ImportPlan> {
  const { headers, rows } = parseCsv(text);
  const missing = (["sku", "product_name", "price_kes", "unit", "pack_label"] as const).filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return { rows: [{ line: 1, sku: "", kind: "error", productName: "", changes: [], error: `The file is missing these columns: ${missing.join(", ")}. Export the catalogue first and edit that file.` }], counts: { new: 0, changed: 0, unchanged: 0, error: 1 } };
  }

  const parsedRows: Array<{ line: number; parsed?: Parsed; error?: string; sku: string }> = rows.map((row, i) => {
    try {
      const parsed = parseRow(row);
      return { line: i + 2, parsed, sku: parsed.sku };
    } catch (e) {
      return { line: i + 2, error: e instanceof Error ? e.message : "Could not read this row.", sku: (row["sku"] ?? "").trim() };
    }
  });

  const skus = parsedRows.filter((r) => r.parsed).map((r) => r.sku);
  const existing = await db().productVariant.findMany({
    where: { sku: { in: skus } },
    include: { product: { include: { category: { select: { slug: true } } } } },
  });
  const bySku = new Map(existing.map((v) => [v.sku, v]));
  const categories = new Set((await db().category.findMany({ select: { slug: true } })).map((c) => c.slug));
  const seen = new Set<string>();

  const out: RowChange[] = parsedRows.map((r) => {
    if (!r.parsed) return { line: r.line, sku: r.sku, kind: "error", productName: "", changes: [], error: r.error! };
    const p = r.parsed;
    if (seen.has(p.sku)) return { line: r.line, sku: p.sku, kind: "error", productName: p.product.name, changes: [], error: "This SKU appears twice in the file; the later row would silently win." };
    seen.add(p.sku);
    const found = bySku.get(p.sku);
    if (!found && !categories.has(p.product.categorySlug)) {
      return { line: r.line, sku: p.sku, kind: "error", productName: p.product.name, changes: [], error: `category_slug: "${p.product.categorySlug}" does not exist. Create the category first.` };
    }
    if (!found) return { line: r.line, sku: p.sku, kind: "new", productName: p.product.name, changes: [] };
    if (p.product.categorySlug && !categories.has(p.product.categorySlug)) {
      return { line: r.line, sku: p.sku, kind: "error", productName: p.product.name, changes: [], error: `category_slug: "${p.product.categorySlug}" does not exist.` };
    }
    const changes = diffOf(p, found);
    return { line: r.line, sku: p.sku, kind: changes.length > 0 ? "changed" : "unchanged", productName: p.product.name, changes };
  });

  return {
    rows: out,
    counts: {
      new: out.filter((r) => r.kind === "new").length,
      changed: out.filter((r) => r.kind === "changed").length,
      unchanged: out.filter((r) => r.kind === "unchanged").length,
      error: out.filter((r) => r.kind === "error").length,
    },
  };
}

export class ImportError extends Error {}

/**
 * Applies the file in one transaction.
 *
 * The plan is recomputed here rather than trusted from the preview: the operator saw the diff on a
 * page that may be minutes old, and prices must not be written against a stale read. Any error row
 * rejects the whole file.
 *
 * `stockOnHand` moves through an `InventoryMovement` so a corrected count is auditable like every
 * other stock change; `stockReserved` is never touched, because live orders hold those units.
 */
export async function applyImport(text: string, actorId: string): Promise<{ created: number; updated: number }> {
  const plan = await planImport(text);
  if (plan.counts.error > 0) {
    const first = plan.rows.find((r) => r.kind === "error")!;
    throw new ImportError(`Nothing was imported. Line ${first.line}: ${first.error}`);
  }
  const { rows } = parseCsv(text);
  const parsed = rows.map(parseRow);
  let created = 0;
  let updated = 0;

  await db().$transaction(async (tx) => {
    const categories = new Map((await tx.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));
    // Stable order so two concurrent imports cannot deadlock on the same rows.
    for (const p of [...parsed].sort((a, b) => a.sku.localeCompare(b.sku))) {
      const found = await tx.productVariant.findUnique({ where: { sku: p.sku }, include: { product: true } });
      const productData: Prisma.ProductUncheckedUpdateInput = {
        name: p.product.name,
        brand: p.product.brand,
        shortDescription: p.product.shortDescription,
        hazardClass: p.product.hazardClass,
        needsPoReview: p.product.needsPoReview,
        isActive: p.product.isActive,
        seoTitle: p.product.seoTitle,
        seoDescription: p.product.seoDescription,
        ...(p.product.categorySlug ? { categoryId: categories.get(p.product.categorySlug)! } : {}),
      };
      const variantData = {
        packLabel: p.variant.packLabel,
        packSizeValue: p.variant.packSizeValue,
        unit: p.variant.unit,
        priceMinorUnits: p.variant.priceMinorUnits,
        compareAtMinorUnits: p.variant.compareAtMinorUnits,
        vatRateBps: p.variant.vatRateBps,
        lowStockThreshold: p.variant.lowStockThreshold,
        isMadeToOrder: p.variant.isMadeToOrder,
        isActive: p.variant.isActive,
      };

      if (!found) {
        const slug = p.product.slug || p.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const product = await tx.product.upsert({
          where: { slug },
          create: { slug, name: p.product.name, brand: p.product.brand, shortDescription: p.product.shortDescription, categoryId: categories.get(p.product.categorySlug)!, hazardClass: p.product.hazardClass, needsPoReview: p.product.needsPoReview, isActive: p.product.isActive, seoTitle: p.product.seoTitle, seoDescription: p.product.seoDescription },
          update: productData,
        });
        await tx.productVariant.create({ data: { ...variantData, sku: p.sku, productId: product.id, stockOnHand: p.variant.stockOnHand } });
        if (p.variant.stockOnHand !== 0) {
          const v = await tx.productVariant.findUniqueOrThrow({ where: { sku: p.sku }, select: { id: true } });
          await tx.inventoryMovement.create({ data: { variantId: v.id, type: "ADJUSTMENT", qty: p.variant.stockOnHand, reason: "csv_import", reference: `import by ${actorId}` } });
        }
        created++;
        continue;
      }

      await tx.product.update({ where: { id: found.productId }, data: productData });
      await tx.productVariant.update({ where: { id: found.id }, data: variantData });
      if (p.variant.stockOnHand !== found.stockOnHand) {
        const delta = p.variant.stockOnHand - found.stockOnHand;
        await tx.productVariant.update({ where: { id: found.id }, data: { stockOnHand: p.variant.stockOnHand } });
        await tx.inventoryMovement.create({ data: { variantId: found.id, type: "ADJUSTMENT", qty: delta, reason: "csv_import", reference: `import by ${actorId}` } });
      }
      updated++;
    }
  }, { timeout: 30_000 });

  return { created, updated };
}
