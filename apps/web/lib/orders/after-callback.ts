import { db } from "@safuney/db";
import { notifyOrderPaid } from "@/lib/notify";
import { publicBaseUrl } from "./context";
import { alertStaffIfReady } from "./staff-alert";

/** A receipt this long after the payment would only confuse; it also keeps old orders quiet on first deploy. */
const RECEIPT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Sends the customer's "payment received" message once per order, whichever path saw the payment
 * first: the provider's callback, or the status poll asking the provider because the callback was late.
 * A callback that lands after the poll is a duplicate, so keying this on "the callback applied it"
 * would leave that customer with no receipt at all. Never throws.
 */
export async function sendReceiptOnce(ref: { number?: string; id?: string }, now: Date = new Date()): Promise<void> {
  if (!ref.number && !ref.id) return;
  try {
    // Claimed with the order row locked, so a callback and a poll arriving together send one message.
    const order = await db().$transaction(async (tx) => {
      const o = await tx.order.findUnique({ where: ref.id ? { id: ref.id } : { number: ref.number! }, select: { id: true, status: true } });
      if (!o || o.status !== "PAID") return null;
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
      if (await tx.orderEvent.findFirst({ where: { orderId: o.id, type: "receipt_sent" }, select: { id: true } })) return null;
      const paid = await tx.payment.findFirst({ where: { orderId: o.id, status: "SUCCEEDED" }, orderBy: { confirmedAt: "desc" }, select: { providerRef: true, confirmedAt: true } });
      if (!paid?.confirmedAt || now.getTime() - paid.confirmedAt.getTime() > RECEIPT_WINDOW_MS) return null;
      await tx.orderEvent.create({ data: { orderId: o.id, status: "PAID", type: "receipt_sent", payload: {} } });
      const full = await tx.order.findUniqueOrThrow({ where: { id: o.id }, include: { items: true } });
      return { ...full, receipt: paid.providerRef };
    });
    if (!order) return;
    const r = await notifyOrderPaid(
      { number: order.number, accessToken: order.accessToken, email: order.guestEmail, phone: order.guestPhone, totalMinorUnits: order.totalMinorUnits, paymentMethod: order.paymentMethod, status: order.status, baseUrl: publicBaseUrl(), items: order.items.map((i) => ({ name: i.name, packLabel: i.packLabel, qty: i.qty })) },
      order.receipt ?? null,
    );
    console.info("order paid notification", order.number, r.email, r.sms);
  } catch (e) {
    console.error("payment receipt failed", e);
  }
}

/** After a verified callback, tell the customer and the warehouse. Both send once, so a duplicate is safe to pass. */
export async function notifyIfPaid(result: { outcome: string; orderNumber?: string }): Promise<void> {
  if ((result.outcome !== "APPLIED" && result.outcome !== "DUPLICATE") || !result.orderNumber) return;
  await sendReceiptOnce({ number: result.orderNumber });
  await alertStaffIfReady({ number: result.orderNumber });
}
