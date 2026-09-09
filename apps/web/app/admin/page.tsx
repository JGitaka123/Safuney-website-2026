import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatKes } from "@safuney/db/money";
import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";
import { dashboard } from "@/lib/admin/dashboard";
import { statusLabel } from "@/lib/orders/labels";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminHome() {
  const who = await viewer();
  if (!who || !can(who.role, "dashboard.view")) redirect("/account?denied=1");
  const d = await dashboard();

  const money = [
    { label: "Sales today", value: formatKes(d.sales.today) },
    { label: "Last 7 days", value: formatKes(d.sales.week) },
    { label: "Last 30 days", value: formatKes(d.sales.month) },
  ];
  const attention = [
    { label: "Open orders", count: d.openOrders, href: "/admin/orders", permission: "orders.view" as const },
    { label: "Low stock", count: d.lowStock, href: "/admin/catalogue?filter=low-stock", permission: "catalogue.view" as const },
    { label: "Quotes to price", count: d.pendingQuotes, href: "/sales/quotes", permission: "orders.view" as const },
    { label: "Credit applications", count: d.pendingCredit, href: "/sales/credit", permission: "credit.decide" as const },
    { label: "Failed payments (7 days)", count: d.failedPayments, href: "/admin/orders?filter=payment-failed", permission: "orders.view" as const },
  ].filter((a) => can(who.role, a.permission));

  return (
    <div>
      <h1 className="text-h1">Overview</h1>

      <h2 className="mt-6 text-h3">Sales</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {money.map((m) => (
          <li key={m.label} className="border border-line bg-surface p-4">
            <span className="block text-caption uppercase tracking-wide text-ink-muted">{m.label}</span>
            <span className="mt-1 block text-h2 tabular-nums text-ink">{m.value}</span>
          </li>
        ))}
      </ul>

      {attention.length > 0 && (
        <>
          <h2 className="mt-8 text-h3">Needs a person</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attention.map((a) => (
              <li key={a.label}>
                <Link href={a.href} className="block border border-line bg-surface p-4 hover:border-accent">
                  <span className="block text-h2 tabular-nums text-ink">{a.count}</span>
                  <span className="block text-body text-ink-muted">{a.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-8 text-h3">Orders by status</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {d.byStatus.map((s) => (
          <li key={s.status} className="border border-line bg-surface px-3 py-2 text-body">
            <span className="text-ink-muted">{statusLabel(s.status)}</span> <span className="tabular-nums text-ink">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
