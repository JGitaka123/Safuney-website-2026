import { db } from "@safuney/db";
import { notifyOrderPaid } from "@/lib/notify";
import { publicBaseUrl } from "./context";

/** After a verified callback marks an order paid, tell the customer. Never throws into the provider response. */
export async function notifyIfPaid(result: { outcome: string; orderNumber?: string }): Promise<void> {
  if (result.outcome !== "APPLIED" || !result.orderNumber) return;
  try {
    const order = await db().order.findUnique({ where: { number: result.orderNumber }, include: { items: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
    if (!order || order.status !== "PAID") return;
    const r = await notifyOrderPaid(
      { number: order.number, accessToken: order.accessToken, email: order.guestEmail, phone: order.guestPhone, totalMinorUnits: order.totalMinorUnits, paymentMethod: order.paymentMethod, status: order.status, baseUrl: publicBaseUrl(), items: order.items.map((i) => ({ name: i.name, packLabel: i.packLabel, qty: i.qty })) },
      order.payments[0]?.providerRef ?? null,
    );
    console.info("order paid notification", order.number, r.email, r.sms);
  } catch (e) {
    console.error("notifyIfPaid failed", e);
  }
}
