import type { Metadata } from "next";
import Link from "next/link";
import { db, money } from "@safuney/db";
import { Button, ButtonLink, EmptyState } from "@safuney/ui";
import { requireViewer } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { statusMessage } from "@/lib/orders/service";
import { AccountNav } from "@/components/account/account-nav";
import { ReorderButton } from "@/components/account/reorder-button";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(d);
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  const who = await requireViewer("/account");
  const orders = await db().order.findMany({
    where: { userId: who.id, status: { not: "DRAFT" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, number: true, status: true, paymentMethod: true, totalMinorUnits: true, placedAt: true, createdAt: true, accessToken: true },
  });
  const organisations = who.memberships.filter((m) => m.customer.type === "ORGANISATION");

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-small text-ink-muted">Signed in as {who.email ?? who.phone}</p>
          <h1 className="mt-1 text-h1">{who.name ?? "Your account"}</h1>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>

      <AccountNav current="/account" organisation={organisations.length > 0} />

      {denied ? (
        <p role="alert" className="mt-6 border border-line bg-surface p-4 text-body text-ink">
          That page is for Safuney staff.
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section aria-labelledby="orders-heading" className="min-w-0 lg:col-span-8">
          <h2 id="orders-heading" className="text-h2">
            Orders
          </h2>
          {orders.length === 0 ? (
            <div className="mt-4">
              <EmptyState headingLevel={3} heading="No orders yet" body="Orders you place while signed in appear here with their status." actions={[<ButtonLink key="browse" href="/products" variant="secondary">Browse products</ButtonLink>]} />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
                  <div className="min-w-0">
                    <Link href={`/orders/${o.number}?token=${o.accessToken}`} className="font-mono text-body font-semibold text-ink underline-offset-[3px] hover:underline">
                      {o.number}
                    </Link>
                    <p className="text-small text-ink-muted">{statusMessage(o.status, o.paymentMethod)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <div>
                      <p className="text-body font-medium tabular-nums text-ink">{money.formatKes(o.totalMinorUnits)}</p>
                      <p className="text-small tabular-nums text-ink-muted">{formatDate(o.placedAt ?? o.createdAt)}</p>
                    </div>
                    <ReorderButton orderId={o.id} orderNumber={o.number} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="min-w-0 lg:col-span-4">
          <h2 className="text-h3">Organisation</h2>
          {organisations.length === 0 ? (
            <div className="mt-3 border border-line bg-surface p-5">
              <p className="text-body text-ink">Order for a hotel, hospital, school or business? An organisation account gives your team one place to order, with approvals, a purchase-order number on every order and the option to pay on invoice.</p>
              <Link href="/account/organisation/new" className="mt-4 inline-flex min-h-11 items-center rounded-button border border-stainless bg-surface px-4 text-button text-ink hover:bg-ground-deep">
                Set up an organisation
              </Link>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {organisations.map((m) => (
                <li key={m.customerId} className="py-3">
                  <p className="font-medium text-ink">{m.customer.displayName}</p>
                  <p className="text-small text-ink-muted">{m.role === "OWNER" ? "Owner" : m.role === "APPROVER" ? "Approver" : "Buyer"}</p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
