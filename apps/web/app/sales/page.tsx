import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@safuney/db";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sales", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Sales desk: what needs a person today. The full admin console is Phase 6. */
export default async function SalesPage() {
  await requireRole(["SALES", "ADMIN"], "/sales");
  const [quotes, credit] = await Promise.all([db().quote.count({ where: { status: "REQUESTED" } }), db().creditApplication.count({ where: { status: "PENDING" } })]);
  const cards = [
    { href: "/sales/quotes", label: "Quotes to price", count: quotes },
    { href: "/sales/credit", label: "Credit applications (finance)", count: credit },
  ];
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Sales desk</h1>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="block border border-line bg-surface p-5 hover:border-accent">
              <span className="block text-h1 tabular-nums text-ink">{c.count}</span>
              <span className="block text-body text-ink-muted">{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
