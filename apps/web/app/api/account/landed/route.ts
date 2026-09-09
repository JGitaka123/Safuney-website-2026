import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { afterSignIn, safeNextPath } from "@/lib/auth/after-sign-in";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Where a magic link lands: merge the guest cart, mark the header, then continue to the page the customer wanted. */
export async function GET(req: NextRequest) {
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL(`/sign-in?next=${encodeURIComponent(next)}&expired=1`, req.nextUrl.origin));
  await afterSignIn(session.user.id);
  return NextResponse.redirect(new URL(next, req.nextUrl.origin));
}
