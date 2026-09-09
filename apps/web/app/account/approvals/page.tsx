import type { Metadata } from "next";
import { db, money } from "@safuney/db";
import { EmptyState } from "@safuney/ui";
import { requireViewer } from "@/lib/auth/session";
import { AccountNav } from "@/components/account/account-nav";
import { ApprovalCard, type ApprovalOrder } from "@/components/account/approval-card";

export const metadata: Metadata = { title: "Approvals", robots: { index: false } };
export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(d);
}

/** Orders waiting for the signed-in approver's decision (owners approve too). Buyers see their own waiting orders. */
export default async function ApprovalsPage() {
  const who = await requireViewer("/account/approvals");
  const orgs = who.memberships.filter((m) => m.customer.type === "ORGANISATION");
  const approverFor = orgs.filter((m) => m.role !== "BUYER").map((m) => m.customerId);
  const buyerFor = orgs.filter((m) => m.role === "BUYER").map((m) => m.customerId);
  const waiting = await db().order.findMany({
    where: { status: "AWAITING_APPROVAL", OR: [{ customerId: { in: approverFor } }, { customerId: { in: buyerFor }, userId: who.id }] },
    orderBy: { placedAt: "asc" },
    include: { items: true, user: { select: { name: true, email: true, phone: true } } },
  });
  const cards: Array<ApprovalOrder & { canDecide: boolean }> = waiting.map((o) => ({
    id: o.id,
    number: o.number,
    placedBy: o.user?.name ?? o.user?.email ?? o.user?.phone ?? "a colleague",
    placedAt: formatDate(o.placedAt ?? o.createdAt),
    totalLabel: money.formatKes(o.totalMinorUnits),
    paymentMethod: o.paymentMethod,
    poNumber: o.poNumber,
    lines: o.items.map((i) => ({ name: i.name, packLabel: i.packLabel, qty: i.qty, lineLabel: money.formatKes(i.lineTotalMinorUnits + i.lineVatMinorUnits) })),
    trackingHref: `/orders/${o.number}?token=${o.accessToken}`,
    canDecide: o.customerId !== null && approverFor.includes(o.customerId),
  }));

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Approvals</h1>
      <AccountNav current="/account/approvals" organisation={orgs.length > 0} />
      <p className="mt-6 max-w-[40rem] text-body text-ink-muted">
        Orders at or above your organisation&rsquo;s threshold wait here. Stock is held for seven days; nothing is charged until an approver says yes.
      </p>
      {cards.length === 0 ? (
        <div className="mt-6">
          <EmptyState headingLevel={2} heading="Nothing waiting" body="New orders that need a decision appear here, and the buyer is told when you decide." />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {cards.map((c) =>
            c.canDecide ? (
              <ApprovalCard key={c.id} order={c} />
            ) : (
              <article key={c.id} className="border border-line bg-surface p-5">
                <h3 className="font-mono text-body font-semibold text-ink">{c.number}</h3>
                <p className="mt-1 text-small text-ink-muted">Your order of {c.totalLabel} is waiting for an approver.</p>
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}
