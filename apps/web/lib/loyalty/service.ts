/**
 * Volume tiers and the annual spend statement.
 *
 * The tier machinery already exists: `PriceListItem` carries a `minQty`, and the pricing engine
 * already picks the best matching tier. What was missing is the customer-facing half — a buyer who
 * cannot see that ordering ten instead of eight is cheaper does not order ten.
 *
 * Prices here are read for display only. The server remains the price authority: what a customer is
 * actually charged is resolved again when the order is placed, from the same tables.
 */
import { db } from "@safuney/db";
import * as money from "@safuney/db/money";
import { services } from "@/lib/env";

export interface VolumeTier {
  minQty: number;
  priceMinorUnits: bigint;
  /** Saving against the list price of this variant, per pack. */
  savingMinorUnits: bigint;
  savingPercent: number;
}

/** The tiers this customer would get on this variant, cheapest quantity first. */
export async function tiersFor(variantId: string, customerId: string | null): Promise<VolumeTier[]> {
  if (!services.database() || !customerId) return [];
  const customer = await db().customer.findUnique({ where: { id: customerId }, select: { priceListId: true } });
  if (!customer?.priceListId) return [];
  const [variant, items] = await Promise.all([
    db().productVariant.findUnique({ where: { id: variantId }, select: { priceMinorUnits: true } }),
    db().priceListItem.findMany({
      where: { priceListId: customer.priceListId, variantId, priceList: { isActive: true } },
      select: { minQty: true, priceMinorUnits: true },
      orderBy: { minQty: "asc" },
    }),
  ]);
  if (!variant || items.length === 0) return [];
  // Compare against list, which is what the customer sees if they are not on a price list at all.
  const list = variant.priceMinorUnits;
  return items
    .filter((i) => i.priceMinorUnits < list)
    .map((i) => ({
      minQty: i.minQty,
      priceMinorUnits: i.priceMinorUnits,
      savingMinorUnits: list - i.priceMinorUnits,
      savingPercent: list > 0n ? Math.round(Number(((list - i.priceMinorUnits) * 100n) / list)) : 0,
    }));
}

export interface SpendStatement {
  year: number;
  totalMinorUnits: bigint;
  orderCount: number;
  months: Array<{ month: number; label: string; totalMinorUnits: bigint; orders: number }>;
  topProducts: Array<{ name: string; packLabel: string; qty: number; totalMinorUnits: bigint }>;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * What an organisation spent with us in a calendar year.
 *
 * Counts orders that were actually fulfilled or paid for — a cancelled order is not spend, and a
 * refunded one is money that came back. Finance people check these against their own ledger, so the
 * definition has to be the boring one.
 */
export async function spendStatement(customerId: string, year: number): Promise<SpendStatement> {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const orders = await db().order.findMany({
    where: {
      customerId,
      status: { in: ["PAID", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"] },
      placedAt: { gte: from, lt: to },
    },
    select: { totalMinorUnits: true, placedAt: true, items: { select: { name: true, packLabel: true, qty: true, lineTotalMinorUnits: true } } },
  });

  const months = MONTHS.map((label, i) => ({ month: i + 1, label, totalMinorUnits: 0n, orders: 0 }));
  const products = new Map<string, { name: string; packLabel: string; qty: number; totalMinorUnits: bigint }>();
  let total = 0n;

  for (const order of orders) {
    total += order.totalMinorUnits;
    const m = order.placedAt ? order.placedAt.getUTCMonth() : 0;
    months[m]!.totalMinorUnits += order.totalMinorUnits;
    months[m]!.orders += 1;
    for (const item of order.items) {
      const key = `${item.name}|${item.packLabel}`;
      const existing = products.get(key) ?? { name: item.name, packLabel: item.packLabel, qty: 0, totalMinorUnits: 0n };
      existing.qty += item.qty;
      existing.totalMinorUnits += item.lineTotalMinorUnits;
      products.set(key, existing);
    }
  }

  return {
    year,
    totalMinorUnits: total,
    orderCount: orders.length,
    months,
    topProducts: [...products.values()].sort((a, b) => (b.totalMinorUnits > a.totalMinorUnits ? 1 : -1)).slice(0, 10),
  };
}

/** Years this account has any spend in, newest first — so the page offers only real years. */
export async function spendYears(customerId: string): Promise<number[]> {
  const rows = await db().order.findMany({
    where: { customerId, status: { in: ["PAID", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"] }, placedAt: { not: null } },
    select: { placedAt: true },
  });
  const years = new Set(rows.map((r) => r.placedAt!.getUTCFullYear()));
  years.add(new Date().getUTCFullYear());
  return [...years].sort((a, b) => b - a);
}

export const formatKes = money.formatKes;
