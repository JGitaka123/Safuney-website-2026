import { Prisma, type OrderStatus, type PrismaClient } from "@safuney/db";

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

/** A line an unpaid order can no longer hold, because the stock went to someone else after its hold lapsed. */
export interface UnavailableLine {
  sku: string;
  name: string;
  packLabel: string;
  wanted: number;
  available: number;
}

/** Thrown by renewHold when any stocked line cannot be held again; nothing has been changed. */
export class HoldLapsedError extends Error {
  constructor(readonly lines: UnavailableLine[]) {
    super(`Stock no longer available for ${lines.map((l) => l.sku).join(", ")}`);
  }
}

/**
 * Makes an unpaid order hold its stock again before the customer is asked to pay.
 *
 * An order whose 30-minute hold lapsed can still be paid (releaseExpiredReservations keeps it open),
 * and by the time a payment callback arrives the money has already moved: all the callback can do
 * then is record a shortfall. So the check belongs here, before collection starts: every line takes
 * back what it no longer holds, or, if any stocked line cannot, nothing changes and the caller tells
 * the customer instead of charging them.
 *
 * Locks the order row first and then the variants in id order: the sweep and the paid callback take
 * the same locks in the same order, so none of them can deadlock with this, and a sweep cannot release
 * a hold this has just renewed (its claim re-reads the order after this commits). Made-to-order lines
 * hold what exists, as at checkout, and never block. Returns the units newly reserved.
 */
export async function renewHold(tx: Prisma.TransactionClient, orderId: string, reference: string): Promise<number> {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { id: true, variantId: true, sku: true, name: true, packLabel: true, qty: true, reservedQty: true } });
  const missing = items.filter((i): i is typeof i & { variantId: string } => Boolean(i.variantId) && i.qty > i.reservedQty).sort((a, b) => a.variantId.localeCompare(b.variantId));
  if (missing.length === 0) return 0;

  const ids = [...new Set(missing.map((i) => i.variantId))];
  await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
  const variants = new Map((await tx.productVariant.findMany({ where: { id: { in: ids } }, select: { id: true, stockOnHand: true, stockReserved: true, isMadeToOrder: true } })).map((v) => [v.id, v]));

  // Decide every line before writing any, so a refusal leaves the order exactly as it was.
  const plan: Array<{ itemId: string; variantId: string; take: number }> = [];
  const unavailable: UnavailableLine[] = [];
  const free = new Map(ids.map((id) => [id, Math.max(0, (variants.get(id)?.stockOnHand ?? 0) - (variants.get(id)?.stockReserved ?? 0))]));
  for (const item of missing) {
    const v = variants.get(item.variantId);
    if (!v) continue; // a deleted variant: nothing to hold, as releaseItems treats it
    const want = item.qty - item.reservedQty;
    const available = free.get(v.id) ?? 0;
    if (!v.isMadeToOrder && available < want) {
      unavailable.push({ sku: item.sku, name: item.name, packLabel: item.packLabel, wanted: item.qty, available: item.reservedQty + available });
      continue;
    }
    const take = Math.min(want, available);
    free.set(v.id, available - take);
    if (take > 0) plan.push({ itemId: item.id, variantId: v.id, take });
  }
  if (unavailable.length > 0) throw new HoldLapsedError(unavailable);

  let renewed = 0;
  for (const p of plan) {
    await tx.productVariant.update({ where: { id: p.variantId }, data: { stockReserved: { increment: p.take } } });
    await tx.inventoryMovement.create({ data: { variantId: p.variantId, type: "RESERVATION", qty: p.take, reason: "hold_renewed", reference } });
    await tx.orderItem.update({ where: { id: p.itemId }, data: { reservedQty: { increment: p.take } } });
    renewed += p.take;
  }
  return renewed;
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
