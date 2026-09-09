/**
 * The numbers on `/admin`: what the desk needs to look at today.
 *
 * One indexed query per tile rather than one wide read, so a slow tile is obvious and a tile the
 * viewer may not see is never run.
 */
import { db, type OrderStatus } from "@safuney/db";

/** Orders that count as money in: paid, or confirmed on account. */
const EARNING: OrderStatus[] = ["PAID", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"];
const OPEN: OrderStatus[] = ["AWAITING_APPROVAL", "PENDING_PAYMENT", "PAYMENT_FAILED", "PAID", "CONFIRMED", "PACKED", "DISPATCHED"];

export interface Dashboard {
  sales: { today: bigint; week: bigint; month: bigint };
  byStatus: Array<{ status: OrderStatus; count: number }>;
  lowStock: number;
  pendingQuotes: number;
  pendingCredit: number;
  failedPayments: number;
  openOrders: number;
}

function since(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

async function salesSince(from: Date): Promise<bigint> {
  const agg = await db().order.aggregate({ where: { status: { in: EARNING }, placedAt: { gte: from } }, _sum: { totalMinorUnits: true } });
  return agg._sum.totalMinorUnits ?? 0n;
}

export async function dashboard(): Promise<Dashboard> {
  const prisma = db();
  const [today, week, month, grouped, lowStock, pendingQuotes, pendingCredit, failedPayments, openOrders] = await Promise.all([
    salesSince(since(0)),
    salesSince(since(7)),
    salesSince(since(30)),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    // Prisma cannot compare two columns in `where`, and the threshold differs per variant.
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "ProductVariant" WHERE "isActive" = true AND "stockOnHand" - "stockReserved" <= "lowStockThreshold"`,
    prisma.quote.count({ where: { status: "REQUESTED" } }),
    prisma.creditApplication.count({ where: { status: "PENDING" } }),
    prisma.payment.count({ where: { status: "FAILED", createdAt: { gte: since(7) } } }),
    prisma.order.count({ where: { status: { in: OPEN } } }),
  ]);
  return {
    sales: { today, week, month },
    byStatus: grouped.map((g) => ({ status: g.status, count: g._count._all })).sort((a, b) => b.count - a.count),
    lowStock: Number(lowStock[0]?.count ?? 0n),
    pendingQuotes,
    pendingCredit,
    failedPayments,
    openOrders,
  };
}
