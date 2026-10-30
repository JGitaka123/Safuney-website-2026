/**
 * Tells staff that an order is ready to pick: paid by M-Pesa or card, or confirmed for cash on
 * delivery or invoice. Without it a new order waits on the warehouse board until someone happens to
 * look. One email per order to ORDERS_INBOX, however many of the paths below report it.
 */
import { db } from "@safuney/db";
import * as money from "@safuney/db/money";
import { sendEmail } from "@/lib/email";
import { config, services } from "@/lib/env";
import { methodLabel } from "./labels";
import { publicBaseUrl } from "./context";

const READY = new Set(["PAID", "CONFIRMED"]);

/** Never throws: an alert that fails must not undo or block the order it is about. */
export async function alertStaffIfReady(ref: { number?: string; id?: string }): Promise<void> {
  if ((!ref.number && !ref.id) || !services.email()) return;
  try {
    // Claim the alert with the order row locked, so two paths reporting the same order send one email.
    const order = await db().$transaction(async (tx) => {
      const o = await tx.order.findUnique({ where: ref.id ? { id: ref.id } : { number: ref.number! }, select: { id: true, status: true } });
      if (!o || !READY.has(o.status)) return null;
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
      if (await tx.orderEvent.findFirst({ where: { orderId: o.id, type: "staff_alerted" }, select: { id: true } })) return null;
      await tx.orderEvent.create({ data: { orderId: o.id, status: o.status, type: "staff_alerted", payload: { to: "orders_inbox" } } });
      return tx.order.findUniqueOrThrow({ where: { id: o.id }, include: { items: true, payments: { where: { status: "SUCCEEDED" }, take: 1 } } });
    });
    if (!order) return;

    const billing = (order.billingAddress ?? {}) as { name?: string; email?: string; phone?: string; organisation?: string | null };
    const ship = (order.shippingAddress ?? {}) as { county?: string; town?: string; line1?: string | null; landmark?: string | null; deliveryNotes?: string | null; recipientName?: string; recipientPhone?: string };
    const total = money.formatKes(order.totalMinorUnits);
    const payment =
      order.status === "PAID"
        ? `Paid by ${methodLabel(order.paymentMethod)}${order.payments[0]?.providerRef ? `, receipt ${order.payments[0].providerRef}` : ""}`
        : order.paymentMethod === "COD"
          ? `Cash on delivery: collect ${total}`
          : "On invoice";
    const delivery =
      order.deliveryMethod === "PICKUP"
        ? `Customer collects${order.deliverySlot ? `, ${order.deliverySlot}` : ""}`
        : [`Delivery to ${[ship.line1, ship.town, ship.county].filter(Boolean).join(", ")}`, ship.landmark && `Landmark: ${ship.landmark}`, order.deliverySlot && `Slot: ${order.deliverySlot}`, ship.recipientName && `Receiver: ${ship.recipientName}${ship.recipientPhone ? `, ${ship.recipientPhone}` : ""}`, ship.deliveryNotes && `Notes: ${ship.deliveryNotes}`]
            .filter(Boolean)
            .join("\n");
    const text = [
      `${payment}.`,
      "",
      ...order.items.map((i) => `${i.qty} × ${i.name} ${i.packLabel} (${i.sku})`),
      `Total ${total}`,
      "",
      delivery,
      "",
      `Customer: ${[billing.name, billing.organisation, order.guestPhone ?? billing.phone, order.guestEmail ?? billing.email].filter(Boolean).join(", ")}`,
      ...(order.poNumber ? [`PO number: ${order.poNumber}`] : []),
      ...(order.notes ? [`Customer notes: ${order.notes}`] : []),
      "",
      `Open it on the warehouse board: ${publicBaseUrl()}/warehouse/${order.id}`,
    ].join("\n");
    const r = await sendEmail({ to: config.ordersInbox, subject: `New order ${order.number} ready to pick: ${order.status === "PAID" ? "paid" : order.paymentMethod === "COD" ? "cash on delivery" : "on invoice"}, ${total}`, text, ...(order.guestEmail ? { replyTo: order.guestEmail } : {}) });
    console.info("staff order alert", order.number, r.sent ? "sent" : r.reason);
  } catch (e) {
    console.error("staff order alert failed", e);
  }
}
