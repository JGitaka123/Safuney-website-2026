import type { OrderStatus, Prisma, PrismaClient } from "@safuney/db";

/** How long an unpaid order holds its stock. */
export const RESERVATION_MINUTES = 30;
/** How long an order waiting for an approver holds its stock. */
export const APPROVAL_HOLD_DAYS = 7;

/** Statuses that hold stock without having taken it out of the warehouse yet. */
const HOLDING: OrderStatus[] = ["PENDING_PAYMENT", "PAYMENT_FAILED", "AWAITING_APPROVAL"];

/** Puts an order's reserved units back on the shelf, never below zero. */
export async function releaseItems(
  tx: Prisma.TransactionClient,
  items: Array<{ variantId: string | null; qty: number }>,
  reference: string,
  reason: string,
): Promise<void> {
  for (const item of items) {
    if (!item.variantId) continue;
    const v = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { stockReserved: true } });
    const release = Math.min(item.qty, v?.stockReserved ?? 0);
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
    include: { items: true },
    take: 200,
  });
  for (const order of expired) {
    await prisma.$transaction(async (tx) => {
      // Re-read inside the transaction: a concurrent request may have released or paid this order.
      const current = await tx.order.findUnique({ where: { id: order.id }, select: { status: true, reservationExpiresAt: true } });
      if (!current || current.reservationExpiresAt === null || current.reservationExpiresAt.getTime() >= now.getTime()) return;
      if (!HOLDING.includes(current.status)) return;
      const approval = current.status === "AWAITING_APPROVAL";
      await releaseItems(tx, order.items, order.number, approval ? "approval_expired" : "reservation_expired");
      const status: OrderStatus = approval ? "CANCELLED" : current.status;
      await tx.order.update({ where: { id: order.id }, data: { reservationExpiresAt: null, status } });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status,
          type: approval ? "approval_expired" : "reservation_released",
          payload: { after: approval ? `${APPROVAL_HOLD_DAYS} days` : `${RESERVATION_MINUTES} min` },
        },
      });
    });
  }
  return expired.length;
}
