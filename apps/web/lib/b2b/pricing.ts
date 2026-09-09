import type { Prisma, PrismaClient } from "@safuney/db";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Customer-specific prices (master prompt §5 PriceList): the best matching tier (highest minQty ≤ qty)
 * on the customer's price list, else the list price. Server-side only; used for cart display, checkout
 * totals and order placement, so all three agree.
 */
export async function resolvePrices(db: Db, priceListId: string | null | undefined, lines: Array<{ variantId: string; qty: number; listPriceMinorUnits: bigint }>): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>(lines.map((l) => [l.variantId, l.listPriceMinorUnits]));
  if (!priceListId || lines.length === 0) return out;
  const items = await db.priceListItem.findMany({ where: { priceListId, variantId: { in: lines.map((l) => l.variantId) }, priceList: { isActive: true } }, orderBy: { minQty: "desc" } });
  for (const line of lines) {
    const tier = items.find((i) => i.variantId === line.variantId && i.minQty <= line.qty);
    if (tier) out.set(line.variantId, tier.priceMinorUnits);
  }
  return out;
}

/** Price list of the customer an order is placed for, if any. */
export async function priceListFor(db: Db, customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null;
  const c = await db.customer.findUnique({ where: { id: customerId }, select: { priceListId: true, priceList: { select: { isActive: true } } } });
  return c?.priceListId && c.priceList?.isActive ? c.priceListId : null;
}
