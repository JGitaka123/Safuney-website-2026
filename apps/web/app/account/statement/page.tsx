import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatKes } from "@safuney/db/money";
import { Table, TBody, Td, Th, THead, Tr } from "@safuney/ui";
import { requireViewer } from "@/lib/auth/session";
import { flagEnabled } from "@/lib/flags";
import { spendStatement, spendYears } from "@/lib/loyalty/service";
import { AccountNav } from "@/components/account/account-nav";

export const metadata: Metadata = { title: "Annual statement", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function StatementPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  if (!(await flagEnabled("loyalty.enabled"))) notFound();
  const who = await requireViewer("/account/statement");
  const membership = who.memberships[0];
  if (!membership) notFound();

  const years = await spendYears(membership.customerId);
  const requested = Number.parseInt((await searchParams).year ?? "", 10);
  const year = years.includes(requested) ? requested : years[0]!;
  const statement = await spendStatement(membership.customerId, year);
  const busiest = statement.months.reduce((max, m) => (m.totalMinorUnits > max.totalMinorUnits ? m : max), statement.months[0]!);

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Annual statement</h1>
      <AccountNav current="/account/statement" organisation statement />
      <p className="mt-4 text-body text-ink-muted">
        {membership.customer.displayName} · {year}
      </p>

      <form className="mt-5 flex flex-wrap items-end gap-3" action="/account/statement">
        <label className="text-caption text-ink-muted">
          <span className="block">Year</span>
          <select name="year" defaultValue={String(year)} className="mt-1 min-h-11 border border-line bg-surface px-3 text-body text-ink">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 border border-stainless bg-surface px-4 text-body text-ink hover:border-ink">
          Show
        </button>
      </form>

      {statement.orderCount === 0 ? (
        <p className="mt-8 max-w-reading border border-line bg-surface p-5 text-body text-ink">
          No completed orders in {year}. Cancelled and refunded orders are deliberately not counted here — this
          statement should match your own ledger.
        </p>
      ) : (
        <>
          <dl className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="border border-line bg-surface p-5">
              <dt className="text-label text-ink-muted">Spend in {year}</dt>
              <dd className="mt-1 text-h2 tabular-nums text-ink">{formatKes(statement.totalMinorUnits)}</dd>
            </div>
            <div className="border border-line bg-surface p-5">
              <dt className="text-label text-ink-muted">Orders</dt>
              <dd className="mt-1 text-h2 tabular-nums text-ink">{statement.orderCount}</dd>
            </div>
            <div className="border border-line bg-surface p-5">
              <dt className="text-label text-ink-muted">Busiest month</dt>
              <dd className="mt-1 text-h3 text-ink">{busiest.totalMinorUnits > 0n ? busiest.label : "—"}</dd>
            </div>
          </dl>

          <h2 className="mt-10 text-h3">By month</h2>
          <div className="mt-3">
            <Table caption={`Spend by month in ${year}`}>
              <THead>
                <Tr>
                  <Th>Month</Th>
                  <Th>Orders</Th>
                  <Th>Spend</Th>
                </Tr>
              </THead>
              <TBody>
                {statement.months.map((m) => (
                  <Tr key={m.month}>
                    <Td>{m.label}</Td>
                    <Td className="tabular-nums">{m.orders}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{formatKes(m.totalMinorUnits)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>

          <h2 className="mt-10 text-h3">What you bought most</h2>
          <div className="mt-3">
            <Table caption={`Most-ordered products in ${year}`}>
              <THead>
                <Tr>
                  <Th>Product</Th>
                  <Th>Packs</Th>
                  <Th>Spend</Th>
                </Tr>
              </THead>
              <TBody>
                {statement.topProducts.map((p) => (
                  <Tr key={`${p.name}-${p.packLabel}`}>
                    <Td>
                      {p.name} <span className="text-ink-muted">{p.packLabel}</span>
                    </Td>
                    <Td className="tabular-nums">{p.qty}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{formatKes(p.totalMinorUnits)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
          <p className="mt-4 max-w-reading text-caption text-ink-muted">
            Counts orders that were paid for or fulfilled. Cancelled and refunded orders are excluded, so this
            should reconcile against your own records. If it does not, tell us — we would want to know.
          </p>
        </>
      )}
    </div>
  );
}
