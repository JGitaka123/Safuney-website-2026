import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@safuney/db";
import { formatKes } from "@safuney/db/money";
import { Table, TBody, Td, Th, THead, Tr } from "@safuney/ui";
import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";
import { methodLabel, paymentStatusLabel, statusLabel } from "@/lib/orders/labels";
import { FinancePanel } from "@/components/admin/finance-panel";
import { issueCreditNote, markInvoicePaid, recordManualPayment } from "@/lib/admin/finance-actions";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const who = await viewer();
  if (!who || !can(who.role, "orders.view")) redirect("/account?denied=1");
  const { number } = await params;
  const order = await db().order.findUnique({
    where: { number },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { issuedAt: "desc" } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true, email: true } } } },
      customer: { select: { id: true, displayName: true } },
    },
  });
  if (!order) notFound();

  const address = (order.shippingAddress ?? {}) as { name?: string; line1?: string; town?: string; county?: string; phone?: string };
  const finance = can(who.role, "payments.write") || can(who.role, "invoices.write");

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-mono text-h1">{order.number}</h1>
        <Link href="/admin/orders" className="text-body text-accent underline">
          All orders
        </Link>
      </div>
      <p className="mt-2 text-body text-ink-muted">
        {statusLabel(order.status)} · {methodLabel(order.paymentMethod)} · {formatKes(order.totalMinorUnits)}
        {order.poNumber ? ` · PO ${order.poNumber}` : ""}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-h3">Items</h2>
          <div className="mt-2">
            <Table caption="Items on this order">
              <THead>
                <Tr>
                  <Th>Item</Th>
                  <Th>Qty</Th>
                  <Th>Line total</Th>
                </Tr>
              </THead>
              <TBody>
                {order.items.map((i) => (
                  <Tr key={i.id}>
                    <Td>
                      {i.name} <span className="text-ink-muted">{i.packLabel}</span>
                      <span className="mt-1 block font-mono text-caption text-ink-muted">{i.sku}</span>
                    </Td>
                    <Td className="tabular-nums">{i.qty}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{formatKes(i.lineTotalMinorUnits)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
          <dl className="mt-3 space-y-1 text-body">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Subtotal</dt>
              <dd className="tabular-nums">{formatKes(order.subtotalMinorUnits)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">VAT</dt>
              <dd className="tabular-nums">{formatKes(order.vatMinorUnits)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Delivery</dt>
              <dd className="tabular-nums">{formatKes(order.deliveryMinorUnits)}</dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatKes(order.totalMinorUnits)}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="text-h3">Delivery</h2>
          <p className="mt-2 text-body text-ink">
            {address.name ?? "—"}
            {address.line1 ? <><br />{address.line1}</> : null}
            {address.town ? <><br />{address.town}{address.county ? `, ${address.county}` : ""}</> : null}
            {address.phone ? <><br />{address.phone}</> : null}
          </p>

          <h2 className="mt-6 text-h3">Payments</h2>
          {order.payments.length === 0 ? (
            <p className="mt-2 text-body text-ink-muted">Nothing recorded yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {order.payments.map((p) => (
                <li key={p.id} className="border border-line bg-surface p-3 text-body">
                  <span className="tabular-nums text-ink">{formatKes(p.amountMinorUnits)}</span>{" "}
                  <span className="text-ink-muted">
                    {p.provider.replace(/_/g, " ").toLowerCase()} · {paymentStatusLabel(p.status)}
                  </span>
                  {p.providerRef ? <span className="mt-1 block font-mono text-caption text-ink-muted">{p.providerRef}</span> : null}
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-6 text-h3">Invoices</h2>
          {order.invoices.length === 0 ? (
            <p className="mt-2 text-body text-ink-muted">None issued.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {order.invoices.map((i) => (
                <li key={i.id} className="border border-line bg-surface p-3 text-body">
                  <span className="font-mono text-ink">{i.number}</span>{" "}
                  <span className="text-ink-muted">
                    {i.type === "CREDIT_NOTE" ? "credit note" : i.type.toLowerCase()} · {formatKes(i.totalMinorUnits)}
                    {i.paidAt ? ` · settled ${i.paidAt.toISOString().slice(0, 10)}` : i.dueDate ? ` · due ${i.dueDate.toISOString().slice(0, 10)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {finance && (
        <FinancePanel
          orderNumber={order.number}
          openInvoices={order.invoices.filter((i) => i.type === "TAX" && !i.paidAt).map((i) => ({ id: i.id, number: i.number, total: formatKes(i.totalMinorUnits) }))}
          canRecordPayment={can(who.role, "payments.write")}
          canIssueCredit={can(who.role, "invoices.write")}
          markPaid={markInvoicePaid}
          recordPayment={recordManualPayment}
          creditNote={issueCreditNote}
        />
      )}

      <h2 className="mt-8 text-h3">History</h2>
      <ol className="mt-2 space-y-2">
        {order.events.map((e) => (
          <li key={e.id} className="border-l-2 border-line pl-3 text-body">
            <span className="text-ink">{e.type.replace(/_/g, " ")}</span>{" "}
            <span className="text-caption text-ink-muted">
              {e.createdAt.toISOString().replace("T", " ").slice(0, 16)}
              {e.actor ? ` · ${e.actor.name ?? e.actor.email}` : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
