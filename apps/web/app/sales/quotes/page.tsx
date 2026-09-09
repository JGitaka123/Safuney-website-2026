import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@safuney/db";
import { Table, TBody, Td, Th, THead, Tr } from "@safuney/ui";
import { requireRole } from "@/lib/auth/session";
import { orderService } from "@/lib/orders/context";
import { QuoteService } from "@/lib/b2b/quotes";

export const metadata: Metadata = { title: "Quotes", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { REQUESTED: "To price", PRICED: "Sent", ACCEPTED: "Accepted", CONVERTED: "Ordered", DECLINED: "Declined", EXPIRED: "Expired" };

export default async function SalesQuotesPage() {
  const who = await requireRole(["SALES", "ADMIN"], "/sales/quotes");
  const quotes = await new QuoteService(db(), orderService()).listForSales(who.id);
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <p className="text-small text-ink-muted">
        <Link href="/sales" className="hover:underline underline-offset-[3px]">
          Sales desk
        </Link>
      </p>
      <h1 className="mt-1 text-h1">Quotes</h1>
      <div className="mt-6">
        <Table caption="Quote requests">
          <THead>
            <Tr>
              <Th>Quote</Th>
              <Th>Customer</Th>
              <Th numeric>Lines</Th>
              <Th>Status</Th>
              <Th>Requested</Th>
            </Tr>
          </THead>
          <TBody>
            {quotes.map((q) => (
              <Tr key={q.id}>
                <Td>
                  <Link href={`/sales/quotes/${q.id}`} className="font-mono text-accent underline underline-offset-[3px]">
                    {q.number}
                  </Link>
                </Td>
                <Td>
                  {q.customer?.displayName ?? q.contactName}
                  <span className="block text-small text-ink-muted">{q.contactEmail}</span>
                </Td>
                <Td className="text-right tabular-nums">{q.items.length}</Td>
                <Td>{STATUS[q.status] ?? q.status}</Td>
                <Td className="tabular-nums">{new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(q.createdAt)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
