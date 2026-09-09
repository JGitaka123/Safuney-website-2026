/**
 * Live stock and a delivery estimate for a variant.
 *
 * Two rules, both about not over-promising:
 *
 * 1. **Available means unreserved.** `stockOnHand` includes units held by live orders, so quoting it
 *    would sell the same pack twice. Availability is on-hand minus reserved, and never below zero.
 * 2. **Exact counts are only shown when they are low.** "3 left" is useful and creates urgency
 *    honestly; "417 in stock" tells a buyer nothing and turns a stock count into a competitor's
 *    intelligence. Above the threshold it just says the pack is in stock.
 *
 * The estimate is a working-day window from the fastest active delivery zone, described as a range
 * rather than a date, because it is an estimate and a date reads as a promise.
 */
import { db } from "@safuney/db";
import { services } from "@/lib/env";

export interface Availability {
  available: number;
  /** Shown only when stock is low enough for the number to mean something. */
  showCount: boolean;
  madeToOrder: boolean;
  label: string;
  /** e.g. "Delivered in 1–2 working days" — null when we cannot say. */
  eta: string | null;
}

export async function availabilityFor(variantId: string): Promise<Availability | null> {
  if (!services.database()) return null;
  const variant = await db().productVariant.findUnique({
    where: { id: variantId },
    select: { stockOnHand: true, stockReserved: true, lowStockThreshold: true, isMadeToOrder: true, isActive: true },
  });
  if (!variant || !variant.isActive) return null;

  const available = Math.max(0, variant.stockOnHand - variant.stockReserved);
  const low = available > 0 && available <= Math.max(variant.lowStockThreshold, 1);
  const eta = await deliveryEstimate(available > 0);

  let label: string;
  if (available > 0) label = low ? `${available} left in stock` : "In stock";
  else if (variant.isMadeToOrder) label = "Made to order";
  else label = "Out of stock";

  return { available, showCount: low, madeToOrder: variant.isMadeToOrder, label, eta };
}

/** The fastest lead time any active zone offers, as a range. Made-to-order adds the production window. */
async function deliveryEstimate(inStock: boolean): Promise<string | null> {
  if (!services.database()) return null;
  try {
    const zone = await db().deliveryZone.findFirst({ where: { isActive: true }, orderBy: { leadTimeDays: "asc" }, select: { leadTimeDays: true } });
    if (!zone) return null;
    const from = Math.max(1, zone.leadTimeDays);
    if (inStock) return `Delivered in ${from}–${from + 1} working days in Nairobi`;
    // Not in stock: the honest answer is a wider window and a "talk to us", not a date.
    return `Usually ${from + 4}–${from + 9} working days when made to order — ask us to confirm`;
  } catch (e) {
    console.error("delivery estimate unavailable", e);
    return null;
  }
}
