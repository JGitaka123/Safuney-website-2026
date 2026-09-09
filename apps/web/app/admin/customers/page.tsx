import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@safuney/db";
import { formatKes } from "@safuney/db/money";
import { Table, TBody, Td, Th, THead, Tr } from "@safuney/ui";
import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";

export const metadata: Metadata = { title: "Customers" };

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const who = await viewer();
  if (!who || !can(who.role, "customers.view")) redirect("/account?denied=1");
  const q = ((await searchParams).q ?? "").trim();

  const customers = await db().customer.findMany({
    where: {
      type: "ORGANISATION",
      ...(q ? { OR: [{ displayName: { contains: q, mode: "insensitive" as const } }, { legalName: { contains: q, mode: "insensitive" as const } }, { kraPin: { contains: q, mode: "insensitive" as const } }] } : {}),
    },
    select: {
      id: true,
      displayName: true,
      status: true,
      creditLimitMinorUnits: true,
      creditTermsDays: true,
      priceList: { select: { name: true } },
      _count: { select: { members: true, orders: true } },
    },
    orderBy: { displayName: "asc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-h1">Customers</h1>
      <p className="mt-2 text-body text-ink-muted">Organisations. Individual customers appear on their orders.</p>
      <form className="mt-5 flex flex-wrap items-end gap-3" action="/admin/customers">
        <label className="text-caption text-ink-muted">
          <span className="block">Search</span>
          <input name="q" defaultValue={q} placeholder="Name or KRA PIN" className="mt-1 min-h-11 border border-line bg-surface px-3 text-body text-ink" />
        </label>
        <button type="submit" className="min-h-11 border border-stainless bg-surface px-4 text-body text-ink hover:border-ink">
          Search
        </button>
      </form>

      <div className="mt-5">
        <Table caption="Organisation accounts with credit terms">
          <THead>
            <Tr>
              <Th>Organisation</Th>
              <Th>Status</Th>
              <Th>Credit limit</Th>
              <Th>Terms</Th>
              <Th>Price list</Th>
              <Th>People</Th>
              <Th>Orders</Th>
            </Tr>
          </THead>
          <TBody>
            {customers.map((c) => (
              <Tr key={c.id}>
                <Td>{c.displayName}</Td>
                <Td>{c.status.replace(/_/g, " ").toLowerCase()}</Td>
                <Td className="whitespace-nowrap tabular-nums">{c.creditLimitMinorUnits > 0n ? formatKes(c.creditLimitMinorUnits) : "—"}</Td>
                <Td className="tabular-nums">{c.creditTermsDays > 0 ? `${c.creditTermsDays} days` : "—"}</Td>
                <Td>{c.priceList?.name ?? "Standard"}</Td>
                <Td className="tabular-nums">{c._count.members}</Td>
                <Td className="tabular-nums">{c._count.orders}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
      {customers.length === 0 ? <p className="mt-4 text-body text-ink-muted">No organisations match that.</p> : null}
      {can(who.role, "credit.decide") ? (
        <p className="mt-4 text-body text-ink-muted">
          Credit applications are decided at{" "}
          <Link href="/sales/credit" className="text-accent underline">
            /sales/credit
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
