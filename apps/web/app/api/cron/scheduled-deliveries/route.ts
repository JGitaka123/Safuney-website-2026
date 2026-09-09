import { NextResponse, type NextRequest } from "next/server";
import { db } from "@safuney/db";
import { orderService, publicBaseUrl } from "@/lib/orders/context";
import { SubscriptionService } from "@/lib/b2b/subscriptions";
import { services } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron (vercel.json): remind three days ahead and place the scheduled deliveries that are due. */
export async function GET(req: NextRequest) {
  const secret = process.env["CRON_SECRET"];
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("unauthorized", { status: 401 });
  if (!services.database()) return NextResponse.json({ database: false });
  const result = await new SubscriptionService(db(), orderService()).runDue(publicBaseUrl());
  return NextResponse.json(result);
}
