import { NextResponse } from "next/server";
import { db } from "@safuney/db";
import { viewer } from "@/lib/auth/session";
import { ProfileService } from "@/lib/account/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Data export (portability): everything the site holds about the signed-in person, as JSON. */
export async function GET() {
  const who = await viewer();
  if (!who) return new NextResponse("sign in required", { status: 401 });
  const data = await new ProfileService(db()).exportData(who.id);
  return NextResponse.json(data, { headers: { "content-disposition": `attachment; filename="safuney-account-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "private, no-store" } });
}
