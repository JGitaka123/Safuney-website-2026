import { NextResponse, type NextRequest } from "next/server";
import { orderService } from "@/lib/orders/context";
import { toRawCallback } from "@/lib/orders/callback-http";
import { notifyIfPaid } from "@/lib/orders/after-callback";
import { services } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daraja STK callback. Always answers 200 with the Daraja acknowledgement shape so Safaricom stops retrying. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ secret: string }> }) {
  if (!services.database()) return NextResponse.json({ ResultCode: 1, ResultDesc: "Unavailable" }, { status: 503 });
  const { secret } = await ctx.params;
  const raw = await toRawCallback(req, { secret });
  try {
    const r = await orderService().handleCallback("MPESA", raw);
    await notifyIfPaid(r);
    console.info("mpesa callback", r.outcome, r.detail ?? "");
    if (r.outcome === "REJECTED") return NextResponse.json({ ResultCode: 1, ResultDesc: "Rejected" }, { status: 403 });
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (e) {
    console.error("mpesa callback failed", e);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Error" }, { status: 500 });
  }
}
