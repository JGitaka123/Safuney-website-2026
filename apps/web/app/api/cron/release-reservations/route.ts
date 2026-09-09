import { NextResponse, type NextRequest } from "next/server";
import { orderService } from "@/lib/orders/context";
import { services } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vercel Cron (see vercel.json): release stock held by unpaid orders past their reservation window. */
export async function GET(req: NextRequest) {
  const secret = process.env["CRON_SECRET"];
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("unauthorized", { status: 401 });
  if (!services.database()) return NextResponse.json({ released: 0, database: false });
  const released = await orderService().releaseExpiredReservations();
  return NextResponse.json({ released });
}
