import { NextResponse, type NextRequest } from "next/server";
import { MockAdapter, paymentsMode } from "@safuney/payments";
import { db } from "@safuney/db";
import { orderService } from "@/lib/orders/context";
import { notifyIfPaid } from "@/lib/orders/after-callback";
import { services } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Test-only: simulates a provider callback in PAYMENTS_MODE=mock (previews, CI). Signs the body the way
 * the mock adapter expects, so the same verification path runs. 404 in live mode.
 */
export async function POST(req: NextRequest) {
  if (paymentsMode() !== "mock" || !services.database()) return new NextResponse("not found", { status: 404 });
  const input = (await req.json().catch(() => null)) as { method?: "MPESA" | "CARD"; providerRequestId?: string; status?: string; amountMinorUnits?: string; orderNumber?: string; accessToken?: string } | null;
  if (!input?.status || !["SUCCEEDED", "CANCELLED", "FAILED"].includes(input.status)) return NextResponse.json({ error: "status must be SUCCEEDED, CANCELLED or FAILED" }, { status: 400 });
  let method = input.method;
  let providerRequestId = input.providerRequestId;
  let amountMinorUnits = input.amountMinorUnits;
  // Pages only know the order; look up the latest open payment for it (the access token proves ownership).
  if ((!method || !providerRequestId) && input.orderNumber && input.accessToken) {
    const order = await db().order.findFirst({ where: { number: input.orderNumber, accessToken: input.accessToken }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
    const payment = order?.payments[0];
    if (!order || !payment?.providerRequestId) return NextResponse.json({ error: "no open payment for that order" }, { status: 404 });
    method = order.paymentMethod === "CARD" ? "CARD" : "MPESA";
    providerRequestId = payment.providerRequestId;
    amountMinorUnits = payment.amountMinorUnits.toString();
  }
  if (!method || !providerRequestId) return NextResponse.json({ error: "method and providerRequestId (or orderNumber and accessToken) are required" }, { status: 400 });
  const body = JSON.stringify({ providerRequestId, status: input.status, amountMinorUnits });
  const r = await orderService().handleCallback(method, { body, headers: { "x-mock-signature": MockAdapter.sign(body) } });
  await notifyIfPaid(r);
  return NextResponse.json(r);
}
