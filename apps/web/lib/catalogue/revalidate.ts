import { revalidatePath } from "next/cache";
import { db } from "@safuney/db";

/**
 * Pushes a catalogue or stock change out to the cached public pages immediately.
 *
 * **Why paths and not `revalidateTag`.** Tagged caching means `unstable_cache`, which serialises its
 * value through JSON — and every price on this site is a `bigint` of minor units (ADR 0004), which
 * `JSON.stringify` throws on. Wrapping the catalogue queries in a tagged cache would mean converting
 * money to strings on the way in and back on the way out, adding a conversion at exactly the boundary
 * where a rounding mistake becomes a wrong price. Product and category pages are already ISR
 * (`revalidate = 300`), so a path revalidation gives the same "live within a second of the change"
 * behaviour with none of that risk.
 *
 * Called after a price, publish or stock change. Failures are logged and swallowed: a stale page for
 * five minutes is not a reason to fail the write that already succeeded.
 */
export async function revalidateVariant(variantId: string): Promise<void> {
  try {
    const variant = await db().productVariant.findUnique({
      where: { id: variantId },
      select: { product: { select: { slug: true, category: { select: { slug: true } } } } },
    });
    if (!variant) return;
    await revalidateProduct(variant.product.slug, variant.product.category.slug);
  } catch (e) {
    console.error("revalidateVariant failed", e);
  }
}

export async function revalidateProductId(productId: string): Promise<void> {
  try {
    const product = await db().product.findUnique({ where: { id: productId }, select: { slug: true, category: { select: { slug: true } } } });
    if (product) await revalidateProduct(product.slug, product.category.slug);
  } catch (e) {
    console.error("revalidateProductId failed", e);
  }
}

export async function revalidateProduct(productSlug: string, categorySlug: string): Promise<void> {
  revalidatePath(`/products/${categorySlug}/${productSlug}`);
  revalidatePath(`/products/${categorySlug}`);
  revalidatePath("/products");
  revalidatePath("/order-sheet");
  // A publish changes what the sitemap and the resource pages list, not only the product page.
  revalidatePath("/sitemap.xml");
  revalidatePath("/resources/dilution");
}

/** After a bulk import, one sweep rather than a revalidation per row. */
export async function revalidateCatalogue(): Promise<void> {
  revalidatePath("/products", "layout");
  revalidatePath("/order-sheet");
  revalidatePath("/sitemap.xml");
  revalidatePath("/resources/dilution");
  revalidatePath("/resources/colour-coding");
}
