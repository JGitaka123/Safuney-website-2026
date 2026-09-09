import type { Metadata } from "next";
import Link from "next/link";
import { db, money } from "@safuney/db";
import { Input, Select, Table, TBody, Td, Th, THead, Tr, Textarea } from "@safuney/ui";
import { requireViewer } from "@/lib/auth/session";
import { creditPosition } from "@/lib/b2b/credit";
import { applyForCreditAction } from "@/lib/b2b/actions";
import { AccountNav } from "@/components/account/account-nav";
import { ActionForm } from "@/components/account/action-form";

export const metadata: Metadata = { title: "Credit and invoices", robots: { index: false } };
export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  return d ? new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(d) : "";
}

/** Statement of account: credit position, open and paid invoices, and the credit application. */
export default async function CreditPage() {
  const who = await requireViewer("/account/credit");
  const membership = who.memberships.find((m) => m.customer.type === "ORGANISATION");
  if (!membership) {
    return (
      <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
        <h1 className="text-h1">Credit and invoices</h1>
        <AccountNav current="/account/credit" organisation={false} />
        <p className="mt-6 max-w-[40rem] text-body text-ink-muted">
          Credit accounts belong to organisations.{" "}
          <Link href="/account/organisation" className="text-accent underline underline-offset-[3px]">
            Set up your organisation
          </Link>{" "}
          first.
        </p>
      </div>
    );
  }
  const customer = await db().customer.findUniqueOrThrow({ where: { id: membership.customerId }, include: { creditApplications: { orderBy: { createdAt: "desc" }, take: 1 } } });
  const position = await creditPosition(db(), customer.id);
  const invoices = await db().invoice.findMany({ where: { customerId: customer.id }, orderBy: { issuedAt: "desc" }, take: 50, include: { order: { select: { number: true, accessToken: true } } } });
  const application = customer.creditApplications[0] ?? null;
  const overdue = invoices.filter((i) => !i.paidAt && i.dueDate && i.dueDate < new Date()).reduce((s, i) => s + i.totalMinorUnits, 0n);
  const isOwner = membership.role === "OWNER";

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Credit and invoices</h1>
      <AccountNav current="/account/credit" organisation />

      <section aria-labelledby="position-heading" className="mt-8">
        <h2 id="position-heading" className="text-h2">
          {customer.displayName}
        </h2>
        {position.approved ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-4">
            {[
              ["Credit limit", money.formatKes(position.limitMinorUnits)],
              ["Outstanding", money.formatKes(position.outstandingMinorUnits)],
              ["Available", money.formatKes(position.availableMinorUnits)],
              ["Terms", `${position.termsDays} days`],
            ].map(([k, v]) => (
              <div key={k} className="border border-line bg-surface p-4">
                <dt className="text-small text-ink-muted">{k}</dt>
                <dd className="mt-1 text-h3 tabular-nums text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 max-w-[40rem] text-body text-ink-muted">
            {customer.status === "PENDING_CREDIT_APPROVAL" ? "Your credit application is being reviewed. Orders can still be placed with M-Pesa, card or cash on delivery." : "No credit account yet. Approved organisations pay on invoice within agreed terms."}
          </p>
        )}
        {overdue > 0n ? (
          <p role="status" className="mt-4 border border-line bg-surface p-4 text-body text-ink">
            <span className="font-medium">{money.formatKes(overdue)}</span> is past its due date. Settle it to free your credit; call {`+254 796 808 822`} if a payment is already on its way.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="invoices-heading" className="mt-10">
        <h2 id="invoices-heading" className="text-h2">
          Invoices
        </h2>
        {invoices.length === 0 ? (
          <p className="mt-3 text-body text-ink-muted">Tax invoices for orders paid on invoice appear here, ready to download.</p>
        ) : (
          <div className="mt-4">
            <Table caption="Invoices">
              <THead>
                <Tr>
                  <Th>Invoice</Th>
                  <Th>Order</Th>
                  <Th>Issued</Th>
                  <Th>Due</Th>
                  <Th numeric>Total</Th>
                  <Th>Status</Th>
                </Tr>
              </THead>
              <TBody>
                {invoices.map((i) => (
                  <Tr key={i.id}>
                    <Td>
                      <a href={`/account/invoices/${i.number}.pdf`} className="font-mono text-accent underline underline-offset-[3px]">
                        {i.number}
                      </a>
                      {i.type !== "TAX" ? <span className="ml-2 text-caption text-ink-muted">{i.type === "PROFORMA" ? "pro-forma" : "credit note"}</span> : null}
                    </Td>
                    <Td>
                      <Link href={`/orders/${i.order.number}?token=${i.order.accessToken}`} className="font-mono underline-offset-[3px] hover:underline">
                        {i.order.number}
                      </Link>
                    </Td>
                    <Td className="tabular-nums">{formatDate(i.issuedAt)}</Td>
                    <Td className="tabular-nums">{formatDate(i.dueDate)}</Td>
                    <Td className="text-right tabular-nums">{money.formatKes(i.totalMinorUnits)}</Td>
                    <Td>{i.paidAt ? `Paid ${formatDate(i.paidAt)}` : i.dueDate && i.dueDate < new Date() ? "Overdue" : "Open"}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>

      {!position.approved && isOwner && customer.status !== "PENDING_CREDIT_APPROVAL" ? (
        <section aria-labelledby="apply-heading" className="mt-10 max-w-[44rem]">
          <h2 id="apply-heading" className="text-h2">
            Apply for a credit account
          </h2>
          <p className="mt-2 text-body text-ink-muted">Finance reviews applications within two working days. We may ask for a certificate of incorporation, KRA PIN certificate and a recent bank statement by email.</p>
          {application?.status === "REJECTED" ? (
            <p role="status" className="mt-4 border border-line bg-surface p-4 text-body text-ink">
              Your previous application was not approved{application.decisionNote ? `: ${application.decisionNote}` : ""}. You can apply again.
            </p>
          ) : null}
          <ActionForm action={applyForCreditAction.bind(null, customer.id)} submitLabel="Send the application" busyLabel="Sending…" className="mt-6 border border-line bg-surface p-6">
            <Input name="legalName" label="Registered company name" defaultValue={customer.legalName ?? ""} required />
            <Input name="kraPin" label="Company KRA PIN" defaultValue={customer.kraPin ?? ""} required helper="A letter, nine digits and a letter, for example P051234567X." className="font-mono uppercase" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Input name="requestedLimit" label="Credit limit requested (KES)" required inputMode="decimal" helper="Roughly a month of orders." />
              <Select name="requestedTermsDays" label="Payment terms" defaultValue="30">
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="45">45 days</option>
                <option value="60">60 days</option>
              </Select>
            </div>
            <fieldset className="flex flex-col gap-4">
              <legend className="text-body font-medium text-ink">Trade references (at least one)</legend>
              {[1, 2].map((i) => (
                <div key={i} className="grid gap-4 sm:grid-cols-3">
                  <Input name={`ref${i}Company`} label={`Reference ${i}: supplier`} optional={i > 1} required={i === 1} />
                  <Input name={`ref${i}Contact`} label="Contact person" optional />
                  <Input name={`ref${i}Phone`} label="Phone" type="tel" optional={i > 1} required={i === 1} />
                </div>
              ))}
            </fieldset>
            <Textarea name="documents" label="Document links" optional rows={2} helper="One per line as name | link (a shared drive link is fine). Uploads arrive with the admin console." />
          </ActionForm>
        </section>
      ) : null}
      {customer.status === "PENDING_CREDIT_APPROVAL" && application ? (
        <p className="mt-8 text-small text-ink-muted">
          Application sent {formatDate(application.createdAt)} for {money.formatKes(application.requestedLimitMinorUnits)} on {application.requestedTermsDays}-day terms.
        </p>
      ) : null}
    </div>
  );
}
