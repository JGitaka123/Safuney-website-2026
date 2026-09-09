import type { OrderStatus, Prisma, PrismaClient } from "@safuney/db";

/** How long an unpaid order holds its stock. */
export const RESERVATION_MINUTES = 30;
/** How long an order waiting for an approver holds its stock. */
export const APPROVAL_HOLD_DAYS = 7;

/** Statuses that hold stock without having taken it out of the warehouse yet. */
const HOLDING: OrderStatus[] = ["PENDING_PAYMENT", "PAYMENT_FAILED", "AWAITING_APPROVAL"];

/**
 * Puts an order's reserved units back on the shelf.
 *
 * `reservedQty` is what this order actually took, which is not always the line quantity: a
 * made-to-order line reserves only what existed. Releasing the line quantity instead would eat
 * another order's reservation.
 *
 * Rows are touched in a stable order (by variant id) because `placeOrder` locks them the same way;
 * without that the two paths can take the same locks in opposite orders and deadlock.
 */
export async function releaseItems(
  tx: Prisma.TransactionClient,
  items: Array<{ variantId: string | null; qty: number; reservedQty?: number | null }>,
  reference: string,
  reason: string,
): Promise<void> {
  const ordered = items.filter((i): i is typeof i & { variantId: string } => Boolean(i.variantId)).sort((a, b) => a.variantId.localeCompare(b.variantId));
  for (const item of ordered) {
    const held = item.reservedQty ?? item.qty;
    if (held <= 0) continue;
    const v = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { stockReserved: true } });
    const release = Math.min(held, v?.stockReserved ?? 0);
    if (release > 0) {
      await tx.productVariant.update({ where: { id: item.variantId }, data: { stockReserved: { decrement: release } } });
      await tx.inventoryMovement.create({ data: { variantId: item.variantId, type: "RELEASE", qty: -release, reason, reference } });
    }
  }
}

/**
 * Frees stock held by orders whose window has passed: unpaid orders keep their status and can still be
 * paid if stock allows, orders nobody approved in time are cancelled.
 *
 * Called two ways, deliberately. A daily cron sweeps everything; every availability check (adding to
 * the cart, placing an order) first sweeps the variants it is about to read. The lazy path is what
 * makes the 30-minute window real: the hosting plan only allows daily cron jobs, so a customer must
 * never wait a day for someone else's abandoned checkout to let go of the last pack.
 *
 * Each order is claimed with a conditional update before anything is released. The claim is what makes
 * the concurrent case safe: only one caller can win it, so stock is released once, and an order that
 * was paid or swept in the meantime no longer matches and is left alone. Reading first and writing
 * later would let a payment land in between and be overwritten by a stale status.
 */
export async function releaseExpiredReservations(
  prisma: PrismaClient,
  opts: { variantIds?: string[]; now?: Date } = {},
): Promise<number> {
  const now = opts.now ?? new Date();
  const expired = await prisma.order.findMany({
    where: {
      status: { in: HOLDING },
      reservationExpiresAt: { lt: now },
      ...(opts.variantIds && opts.variantIds.length > 0 ? { items: { some: { variantId: { in: opts.variantIds } } } } : {}),
    },
    select: { id: true, number: true, status: true, items: { select: { variantId: true, qty: true, reservedQty: true } } },
    orderBy: { reservationExpiresAt: "asc" },
    take: 200,
  });

  let released = 0;
  for (const order of expired) {
    await prisma.$transaction(async (tx) => {
      const approval = order.status === "AWAITING_APPROVAL";
      // Claim it. Only the caller whose update matches a row may release the stock, and the condition
      // is re-evaluated after any concurrent write, so a paid order simply no longer qualifies.
      const claim = await tx.order.updateMany({
        where: { id: order.id, status: { in: HOLDING }, reservationExpiresAt: { lt: now } },
        data: { reservationExpiresAt: null, ...(approval ? { status: "CANCELLED" as OrderStatus } : {}) },
      });
      if (claim.count !== 1) return;
      await releaseItems(tx, order.items, order.number, approval ? "approval_expired" : "reservation_expired");
      // The hold is spent. An unpaid order keeps its status and can still be paid, but it no longer
      // holds anything, so a later sweep or a payment must not release these units a second time.
      await tx.orderItem.updateMany({ where: { orderId: order.id }, data: { reservedQty: 0 } });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: approval ? "CANCELLED" : order.status,
          type: approval ? "approval_expired" : "reservation_released",
          payload: { after: approval ? `${APPROVAL_HOLD_DAYS} days` : `${RESERVATION_MINUTES} min` },
        },
      });
      released++;
    });
  }
  return released;
}
