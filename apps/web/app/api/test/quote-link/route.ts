import { NextResponse, type NextRequest } from "next/server";
import { db } from "@safuney/db";
import { authMockMode } from "@/lib/auth/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Test-only (mock mode, never production): the accept link that would have been emailed for a quote. */
export async function GET(req: NextRequest) {
  if (!authMockMode()) return new NextResponse("not found", { status: 404 });
  const number = req.nextUrl.searchParams.get("number") ?? "";
  const q = await db().quote.findUnique({ where: { number }, select: { accessToken: true } });
  if (!q) return new NextResponse("not found", { status: 404 });
  return NextResponse.json({ token: q.accessToken });
}
