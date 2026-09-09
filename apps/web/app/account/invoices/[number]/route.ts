import { NextResponse, type NextRequest } from "next/server";
import { db } from "@safuney/db";
import { viewer } from "@/lib/auth/session";
import { renderInvoicePdf } from "@/lib/b2b/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tax invoice PDF for members of the organisation it was issued to (or the order's own account). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  const who = await viewer();
  if (!who) return new NextResponse("sign in required", { status: 401 });
  const { number } = await ctx.params;
  const invoice = await db().invoice.findUnique({ where: { number: number.replace(/\.pdf$/i, "") }, include: { order: { select: { number: true, userId: true } } } });
  if (!invoice) return new NextResponse("not found", { status: 404 });
  const member = invoice.customerId ? who.memberships.some((m) => m.customerId === invoice.customerId) : false;
  const own = invoice.order.userId === who.id;
  if (!member && !own) return new NextResponse("not found", { status: 404 });
  const pdf = await renderInvoicePdf(invoice, invoice.order.number);
  return new NextResponse(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${invoice.number}.pdf"`, "cache-control": "private, no-store" } });
}
