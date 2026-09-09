import { NextResponse, type NextRequest } from "next/server";
import { orderService } from "@/lib/orders/context";
import { toRawCallback } from "@/lib/orders/callback-http";
import { notifyIfPaid } from "@/lib/orders/after-callback";
import { services } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Paystack webhook: HMAC-SHA512 over the raw body. 200 on accepted/duplicate, 401 on bad signature. */
export async function POST(req: NextRequest) {
  if (!services.database()) return new NextResponse("unavailable", { status: 503 });
  const raw = await toRawCallback(req);
  try {
    const r = await orderService().handleCallback("CARD", raw);
    await notifyIfPaid(r);
    console.info("paystack webhook", r.outcome, r.detail ?? "");
    if (r.outcome === "REJECTED") return new NextResponse("rejected", { status: r.detail === "UNKNOWN_EVENT" ? 200 : 401 });
    return new NextResponse("ok", { status: 200 });
  } catch (e) {
    console.error("paystack webhook failed", e);
    return new NextResponse("error", { status: 500 });
  }
}
