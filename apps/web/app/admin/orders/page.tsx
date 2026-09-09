import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db, type OrderStatus, type Prisma } from "@safuney/db";
import { formatKes } from "@safuney/db/money";
import { Table, TBody, Td, Th, THead, Tr } from "@safuney/ui";
import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";
import { methodLabel, statusLabel } from "@/lib/orders/labels";

export const metadata: Metadata = { title: "Orders" };

const STATUSES: OrderStatus[] = ["AWAITING_APPROVAL", "PENDING_PAYMENT", "PAYMENT_FAILED", "PAID", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED", "CANCELLED", "REFUNDED"];

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; filter?: string }> }) {
  const who = await viewer();
  if (!who || !can(who.role, "orders.view")) redirect("/account?denied=1");
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = STATUSES.find((s) => s === params.status);

  const where: Prisma.OrderWhereInput = {
    status: params.filter === "payment-failed" ? "PAYMENT_FAILED" : status ? status : { not: "DRAFT" },
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" as const } },
            { guestEmail: { contains: q, mode: "insensitive" as const } },
            { guestPhone: { contains: q } },
            { poNumber: { contains: q, mode: "insensitive" as const } },
            { customer: { displayName: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const orders = await db().order.findMany({
    where,
    select: { id: true, number: true, status: true, totalMinorUnits: true, paymentMethod: true, placedAt: true, createdAt: true, guestEmail: true, poNumber: true, customer: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-h1">Orders</h1>
      <form className="mt-5 flex flex-wrap items-end gap-3" action="/admin/orders">
        <label className="text-caption text-ink-muted">
          <span className="block">Search</span>
          <input name="q" defaultValue={q} placeholder="Number, email, phone, PO" className="mt-1 min-h-11 border border-line bg-surface px-3 text-body text-ink" />
        </label>
        <label className="text-caption text-ink-muted">
          <span className="block">Status</span>
          <select name="status" defaultValue={status ?? ""} className="mt-1 min-h-11 border border-line bg-surface px-3 text-body text-ink">
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 border border-stainless bg-surface px-4 text-body text-ink hover:border-ink">
          Apply
        </button>
      </form>

      <div className="mt-5">
        <Table caption="Orders, newest first">
          <THead>
            <Tr>
              <Th>Order</Th>
              <Th>Placed</Th>
              <Th>Who</Th>
              <Th>Status</Th>
              <Th>Pay by</Th>
              <Th>Total</Th>
            </Tr>
          </THead>
          <TBody>
            {orders.map((o) => (
              <Tr key={o.id}>
                <Td>
                  <Link href={`/admin/orders/${o.number}`} className="font-mono text-accent underline">
                    {o.number}
                  </Link>
                  {o.poNumber ? <span className="mt-1 block text-caption text-ink-muted">PO {o.poNumber}</span> : null}
                </Td>
                <Td className="whitespace-nowrap text-caption">{(o.placedAt ?? o.createdAt).toISOString().slice(0, 10)}</Td>
                <Td>{o.customer?.displayName ?? o.guestEmail ?? "Guest"}</Td>
                <Td>{statusLabel(o.status)}</Td>
                <Td>{methodLabel(o.paymentMethod)}</Td>
                <Td className="whitespace-nowrap tabular-nums">{formatKes(o.totalMinorUnits)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
      {orders.length === 0 ? <p className="mt-4 text-body text-ink-muted">No orders match that.</p> : null}
    </div>
  );
}
