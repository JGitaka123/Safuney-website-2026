import { NextResponse, type NextRequest } from "next/server";
import { MockAdapter, paymentsMode } from "@safuney/payments";
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
  const input = (await req.json().catch(() => null)) as { method?: "MPESA" | "CARD"; providerRequestId?: string; status?: string; amountMinorUnits?: string } | null;
  if (!input?.method || !input.providerRequestId || !input.status) return NextResponse.json({ error: "method, providerRequestId and status are required" }, { status: 400 });
  const body = JSON.stringify({ providerRequestId: input.providerRequestId, status: input.status, amountMinorUnits: input.amountMinorUnits });
  const r = await orderService().handleCallback(input.method, { body, headers: { "x-mock-signature": MockAdapter.sign(body) } });
  await notifyIfPaid(r);
  return NextResponse.json(r);
}
