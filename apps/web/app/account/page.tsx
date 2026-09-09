import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { creditService } from "@/lib/credit";
import { db, isDatabaseConfigured } from "@safuney/db";
import { logoutAction } from "../login/actions";
import { approveOrderAction, rejectOrderAction } from "./actions";

export const metadata: Metadata = {
  title: "Corporate account dashboard",
};

export default async function AccountPage() {
  const session = await getCurrentSession();

  if (!session) {
    return (
      <div className="mx-auto max-w-page px-5 py-12 md:px-6 md:py-20">
        <div className="mx-auto max-w-lg rounded-chip border border-line bg-surface p-8 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-ground-deep text-h3 text-ink">
            🏢
          </span>
          <h1 className="mt-4 text-h2 font-semibold text-ink">Corporate Account Portal</h1>
          <p className="mt-2 text-small text-ink-muted">
            Sign in with your organisation credentials to view your available credit limit, approve orders, and track deliveries.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-button bg-ink px-6 text-button text-white hover:bg-accent-deep"
            >
              Sign in to account
            </Link>
            <Link
              href="/account/credit-application"
              className="inline-flex min-h-11 items-center justify-center rounded-button border border-stainless bg-surface px-6 text-button text-ink hover:bg-ground-deep"
            >
              Apply for credit
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Load live credit profile if customer is set
  let creditProfile = null;
  let recentOrders: Array<any> = [];
  let pendingApprovals: Array<any> = [];

  if (session.customer && isDatabaseConfigured()) {
    try {
      creditProfile = await creditService().getCreditProfile(session.customer.id);
      const prisma = db();
      recentOrders = await prisma.order.findMany({
        where: { customerId: session.customer.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      if (session.memberRole === "APPROVER" || session.memberRole === "OWNER") {
        pendingApprovals = await prisma.order.findMany({
          where: {
            customerId: session.customer.id,
            status: "AWAITING_APPROVAL",
          },
          orderBy: { createdAt: "asc" },
        });
      }
    } catch (e) {
      console.error("Error loading account data", e);
    }
  }

  // Fallback demo profile if DB isn't connected
  const creditLimit = creditProfile?.creditLimitMinorUnits ?? session.customer?.creditLimitMinorUnits ?? 50000000n;
  const outstanding = creditProfile?.outstandingBalanceMinorUnits ?? 12480000n; // KES 124,800.00
  const available = creditProfile?.availableCreditMinorUnits ?? (creditLimit - outstanding);
  const termsDays = creditProfile?.creditTermsDays ?? session.customer?.creditTermsDays ?? 30;

  const limitKES = Number(creditLimit) / 100;
  const outstandingKES = Number(outstanding) / 100;
  const availableKES = Number(available) / 100;
  const usagePercent = limitKES > 0 ? Math.min(100, Math.round((outstandingKES / limitKES) * 100)) : 0;

  return (
    <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <nav aria-label="Breadcrumb" className="text-small text-ink-muted">
            <Link href="/" className="hover:underline underline-offset-[3px]">
              Home
            </Link>
            <span aria-hidden> / </span>
            <span aria-current="page">Account</span>
          </nav>
          <h1 className="mt-2 text-h1 font-semibold text-ink">
            {session.customer?.displayName ?? "Organisation Account"}
          </h1>
          <p className="text-small text-ink-muted">
            Logged in as <strong className="text-ink">{session.user.name}</strong> ({session.user.email}) · Role:{" "}
            <span className="inline-flex rounded-chip border border-line bg-ground px-2 py-0.5 font-mono text-label font-medium text-ink">
              {session.memberRole ?? session.user.role}
            </span>
          </p>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center rounded-button border border-stainless bg-surface px-4 text-small font-medium text-ink hover:bg-ground-deep"
          >
            Sign out
          </button>
        </form>
      </div>

      {creditProfile?.isStopSupply ? (
        <div className="mt-6 rounded-chip border border-warning-ink bg-warning-wash p-4 text-warning-ink">
          <p className="text-label font-bold">⚠️ Credit ordering suspended (Stop-supply active)</p>
          <p className="mt-1 text-small">{creditProfile.stopSupplyReason}</p>
        </div>
      ) : null}

      {/* Credit Overview Widget */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-chip border border-line bg-surface p-5">
          <span className="text-caption text-ink-muted uppercase tracking-wide">Approved credit limit</span>
          <p className="mt-2 font-mono text-h3 font-semibold text-ink">
            KES {limitKES.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-small text-ink-muted">{termsDays}-day payment terms</span>
        </div>

        <div className="rounded-chip border border-line bg-surface p-5">
          <span className="text-caption text-ink-muted uppercase tracking-wide">Outstanding receivables</span>
          <p className="mt-2 font-mono text-h3 font-semibold text-ink">
            KES {outstandingKES.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-small text-ink-muted">Unpaid tax invoices</span>
        </div>

        <div className="rounded-chip border border-accent bg-accent-wash/30 p-5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold text-accent uppercase tracking-wide">Available credit to order</span>
            <span className="font-mono text-small font-semibold text-ink">{usagePercent}% utilised</span>
          </div>
          <p className="mt-2 font-mono text-h2 font-semibold text-accent">
            KES {availableKES.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-3 h-2 w-full rounded-full bg-line overflow-hidden">
            <div
              className={`h-full ${usagePercent > 80 ? "bg-warning-ink" : "bg-accent"}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Pending Approvals (For APPROVER / OWNER) */}
      {session.memberRole === "APPROVER" || session.memberRole === "OWNER" ? (
        <div className="mt-12 rounded-chip border border-line bg-surface p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-h3 font-semibold text-ink">Pending Order Approvals</h2>
              <p className="text-small text-ink-muted">
                Orders placed by buyers exceeding your internal threshold (KES {((Number(session.customer?.approvalThresholdMinorUnits ?? 15000000n)) / 100).toLocaleString("en-KE")}) requiring finance sign-off.
              </p>
            </div>
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-caption font-bold text-white">
              {pendingApprovals.length}
            </span>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="mt-6 rounded-chip border border-dashed border-line p-6 text-center text-small text-ink-muted">
              No orders are currently waiting for approval.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-small">
                <thead>
                  <tr className="border-b border-line text-ink-muted">
                    <th className="pb-3 font-medium">Order number</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Buyer</th>
                    <th className="pb-3 text-right font-medium">Total</th>
                    <th className="pb-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pendingApprovals.map((ord) => (
                    <tr key={ord.id}>
                      <td className="py-3 font-mono font-medium text-accent">
                        <Link href={`/orders/${ord.number}?token=${ord.accessToken}`} className="hover:underline">
                          {ord.number}
                        </Link>
                      </td>
                      <td className="py-3 text-ink-muted">
                        {new Date(ord.createdAt).toLocaleDateString("en-KE")}
                      </td>
                      <td className="py-3 text-ink">{ord.guestEmail ?? "Staff Buyer"}</td>
                      <td className="py-3 text-right font-mono font-semibold text-ink">
                        KES {(Number(ord.totalMinorUnits) / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <form action={approveOrderAction}>
                            <input type="hidden" name="orderId" value={ord.id} />
                            <button
                              type="submit"
                              className="rounded-chip bg-ink px-3 py-1 text-caption font-medium text-white hover:bg-accent-deep"
                            >
                              Approve
                            </button>
                          </form>
                          <form action={rejectOrderAction}>
                            <input type="hidden" name="orderId" value={ord.id} />
                            <button
                              type="submit"
                              className="rounded-chip border border-stainless bg-surface px-3 py-1 text-caption font-medium text-ink hover:bg-ground-deep"
                            >
                              Reject
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* Recent Orders Section */}
      <div className="mt-12 rounded-chip border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-ink">Recent Organisation Orders</h2>
          <Link href="/products" className="text-small font-medium text-accent hover:underline">
            New purchase order +
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="mt-6 rounded-chip border border-dashed border-line p-8 text-center text-small text-ink-muted">
            No orders have been placed under this corporate account yet.
            <div className="mt-3">
              <Link href="/order-sheet" className="font-medium text-accent hover:underline">
                Open bulk order sheet →
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-small">
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  <th className="pb-3 font-medium">Order number</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">PO Number</th>
                  <th className="pb-3 font-medium">Payment method</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentOrders.map((ord) => (
                  <tr key={ord.id}>
                    <td className="py-3 font-mono font-medium text-accent">
                      <Link href={`/orders/${ord.number}?token=${ord.accessToken}`} className="hover:underline">
                        {ord.number}
                      </Link>
                    </td>
                    <td className="py-3 text-ink-muted">
                      {new Date(ord.createdAt).toLocaleDateString("en-KE")}
                    </td>
                    <td className="py-3 font-mono text-ink-muted">{ord.poNumber ?? "—"}</td>
                    <td className="py-3 font-medium text-ink">{ord.paymentMethod}</td>
                    <td className="py-3">
                      <span className="inline-flex rounded-chip border border-line bg-ground px-2 py-0.5 text-caption font-medium text-ink">
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono font-medium text-ink">
                      KES {(Number(ord.totalMinorUnits) / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
