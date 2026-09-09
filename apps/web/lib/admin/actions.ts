"use server";

import { revalidatePath } from "next/cache";
import { db } from "@safuney/db";
import { adminAction, AdminError, type AdminResult } from "./action";
import { applyImport, ImportError } from "./catalogue-csv";

/** "1,250" / "1250.50" → minor units. */
function parseKes(raw: string): bigint | null {
  const cleaned = raw.replace(/[,\s]|KES/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return BigInt(whole!) * 100n + BigInt(frac.padEnd(2, "0"));
}

export const setVariantPrice = adminAction(
  "catalogue.variant.price",
  "catalogue.write",
  "ProductVariant",
  async (ctx, variantId: string, priceKes: string): Promise<AdminResult> => {
    const minor = parseKes(priceKes);
    if (minor === null) throw new AdminError("Enter the price in shillings, for example 1,250 or 1250.50.");
    const before = await db().productVariant.findUnique({ where: { id: variantId }, select: { sku: true, priceMinorUnits: true } });
    if (!before) throw new AdminError("That variant no longer exists.");
    await db().productVariant.update({ where: { id: variantId }, data: { priceMinorUnits: minor } });
    ctx.audit({ entity: "ProductVariant", entityId: variantId, before: { priceMinorUnits: before.priceMinorUnits }, after: { priceMinorUnits: minor } });
    revalidatePath("/admin/catalogue");
    return { ok: true, message: `Price for ${before.sku} updated.`, id: variantId };
  },
);

export const adjustStock = adminAction(
  "catalogue.variant.stock",
  "catalogue.write",
  "ProductVariant",
  async (ctx, variantId: string, countedRaw: string, reason: string): Promise<AdminResult> => {
    if (!/^\d+$/.test(countedRaw.trim())) throw new AdminError("Enter the counted quantity as a whole number.");
    const counted = Number.parseInt(countedRaw, 10);
    const before = await db().productVariant.findUnique({ where: { id: variantId }, select: { sku: true, stockOnHand: true, stockReserved: true } });
    if (!before) throw new AdminError("That variant no longer exists.");
    // A stock count is what is physically on the shelf, which includes units reserved for live orders.
    if (counted < before.stockReserved) throw new AdminError(`${before.stockReserved} of these are already reserved for live orders. Cancel those first, or count at least ${before.stockReserved}.`);
    await db().$transaction([
      db().productVariant.update({ where: { id: variantId }, data: { stockOnHand: counted } }),
      db().inventoryMovement.create({ data: { variantId, type: "ADJUSTMENT", qty: counted - before.stockOnHand, reason: reason.trim() || "stock count", reference: `admin ${ctx.who.id}` } }),
    ]);
    ctx.audit({ entity: "ProductVariant", entityId: variantId, before: { stockOnHand: before.stockOnHand }, after: { stockOnHand: counted, reason } });
    revalidatePath("/admin/catalogue");
    return { ok: true, message: `${before.sku} set to ${counted}.`, id: variantId };
  },
);

export const setProductReviewed = adminAction(
  "catalogue.product.review",
  "catalogue.write",
  "Product",
  async (ctx, productId: string, reviewed: boolean): Promise<AdminResult> => {
    const before = await db().product.findUnique({ where: { id: productId }, select: { name: true, needsPoReview: true, isActive: true } });
    if (!before) throw new AdminError("That product no longer exists.");
    // Marking a product reviewed is what puts it in front of customers, so it goes active with it.
    await db().product.update({ where: { id: productId }, data: { needsPoReview: !reviewed, isActive: reviewed ? true : before.isActive } });
    ctx.audit({ entity: "Product", entityId: productId, before: { needsPoReview: before.needsPoReview, isActive: before.isActive }, after: { needsPoReview: !reviewed, isActive: reviewed ? true : before.isActive } });
    revalidatePath("/admin/catalogue");
    return { ok: true, message: reviewed ? `${before.name} is now visible to customers.` : `${before.name} is hidden until reviewed.`, id: productId };
  },
);

export const importCatalogue = adminAction(
  "catalogue.import",
  "catalogue.write",
  "Product",
  async (ctx, csv: string): Promise<AdminResult> => {
    try {
      const { created, updated } = await applyImport(csv, ctx.who.id);
      ctx.audit({ entity: "Product", after: { created, updated, bytes: csv.length } });
      revalidatePath("/admin/catalogue");
      return { ok: true, message: `${created} new, ${updated} updated.` };
    } catch (e) {
      if (e instanceof ImportError) throw new AdminError(e.message);
      throw e;
    }
  },
);
