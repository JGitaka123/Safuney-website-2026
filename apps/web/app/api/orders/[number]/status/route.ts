import { after, NextResponse, type NextRequest } from "next/server";
import { alertStaffIfReady } from "@/lib/orders/staff-alert";
import { orderService } from "@/lib/orders/context";
import { OrderError } from "@/lib/orders/service";
import { services } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Status polling for the pending page. Requires the order's access token. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  if (!services.database()) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const { number } = await ctx.params;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "token required" }, { status: 401 });
  try {
    const s = await orderService().refreshStatus(number, token);
    // The poll can be what marks an order paid (it asks the provider when the callback is late), and
    // then no callback ever reports it. The alert is sent once per order, so asking on every poll is safe.
    if (s.status === "PAID") after(() => alertStaffIfReady({ number }));
    return NextResponse.json(s, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof OrderError && e.code === "NOT_FOUND") return NextResponse.json({ error: "not found" }, { status: 404 });
    console.error("status poll failed", e);
    return NextResponse.json({ error: "error" }, { status: 500 });
  }
}
