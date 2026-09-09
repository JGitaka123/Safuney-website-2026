import type { Metadata } from "next";
import Link from "next/link";
import { money } from "@safuney/db";
import { requireRole } from "@/lib/auth/session";
import { orderService } from "@/lib/orders/context";

export const metadata: Metadata = { title: "Warehouse", robots: { index: false } };
export const dynamic = "force-dynamic";

const LANES: Array<{ status: "PAID" | "CONFIRMED" | "PACKED" | "DISPATCHED"; label: string; hint: string }> = [
  { status: "PAID", label: "To pick (paid)", hint: "Paid online; pick, pack and mark packed." },
  { status: "CONFIRMED", label: "To pick (cash or invoice)", hint: "Paid on delivery or invoiced; stock leaves at dispatch." },
  { status: "PACKED", label: "Packed", hint: "Waiting for a rider." },
  { status: "DISPATCHED", label: "Out for delivery", hint: "Mark delivered with the receiver's name; record cash collected." },
];

function formatDate(d: Date | null): string {
  return d ? new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(d) : "";
}

/** Warehouse board: four lanes, oldest first, one tap into the pick list. */
export default async function WarehousePage() {
  const who = await requireRole(["WAREHOUSE", "ADMIN"], "/warehouse");
  const queue = await orderService().warehouseQueue(who.id);
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Warehouse</h1>
      <p className="mt-2 text-body text-ink-muted">Mombasa Road. Oldest first in every lane.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-4">
        {LANES.map((lane) => {
          const orders = queue.filter((o) => o.status === lane.status);
          return (
            <section key={lane.status} aria-labelledby={`lane-${lane.status}`} className="min-w-0">
              <h2 id={`lane-${lane.status}`} className="text-h4">
                {lane.label} <span className="tabular-nums text-ink-muted">({orders.length})</span>
              </h2>
              <p className="mt-1 text-small text-ink-muted">{lane.hint}</p>
              <ul className="mt-3 flex flex-col gap-3">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/warehouse/${o.id}`} className="block border border-line bg-surface p-4 hover:border-accent">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-body font-semibold text-ink">{o.number}</span>
                        <span className="text-small tabular-nums text-ink-muted">{formatDate(o.placedAt ?? o.createdAt)}</span>
                      </span>
                      <span className="mt-1 block text-small text-ink">
                        {o.customer?.displayName ?? (o.billingAddress as { name?: string } | null)?.name ?? o.guestEmail} · {o.items.reduce((n, i) => n + i.qty, 0)} packs · {o.deliveryMethod === "PICKUP" ? "collection" : "delivery"}
                        {o.paymentMethod === "COD" ? ` · collect ${money.formatKes(o.totalMinorUnits)}` : ""}
                      </span>
                      {o.fulfilment?.riderName ? <span className="mt-1 block text-small text-ink-muted">With {o.fulfilment.riderName}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
