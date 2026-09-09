import type { Metadata } from "next";
import { db, money } from "@safuney/db";
import { Input, Select, Table, TBody, Td, Th, THead, Tr, Textarea } from "@safuney/ui";
import { viewer } from "@/lib/auth/session";
import { orderService, paymentRegistry } from "@/lib/orders/context";
import { organisationFor } from "@/lib/checkout/actions";
import { QuoteError, QuoteService } from "@/lib/b2b/quotes";
import { acceptQuoteAction, declineQuoteAction } from "@/lib/b2b/quote-actions";
import { ActionForm } from "@/components/account/action-form";

export const metadata: Metadata = { title: "Your quote", robots: { index: false } };
export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  return d ? new Intl.DateTimeFormat("en-KE", { dateStyle: "long", timeZone: "Africa/Nairobi" }).format(d) : "";
}

export default async function QuotePage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ token?: string }> }) {
  const { number } = await params;
  const { token } = await searchParams;
  let quote;
  try {
    quote = await new QuoteService(db(), orderService()).open(number, token ?? "");
  } catch (e) {
    if (!(e instanceof QuoteError)) throw e;
    return (
      <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-16">
        <h1 className="text-h1">Quote not found</h1>
        <p className="mt-3 text-body text-ink-muted">Use the link from your email. If it has expired, call +254 796 808 822 and quote the number.</p>
      </div>
    );
  }
  const who = await viewer();
  const org = who ? await organisationFor(who) : null;
  const registry = paymentRegistry();
  const priced = quote.items.every((i) => i.unitPriceMinorUnits !== null);
  const subtotal = priced ? quote.items.reduce((s, i) => s + money.times(i.unitPriceMinorUnits!, i.qty), 0n) : 0n;
  const vat = priced ? quote.items.reduce((s, i) => s + money.vatOn(money.times(i.unitPriceMinorUnits!, i.qty), i.vatRateBps), 0n) : 0n;
  const headline =
    quote.status === "REQUESTED" ? "We are pricing this" : quote.status === "PRICED" ? "Your quote is ready" : quote.status === "ACCEPTED" || quote.status === "CONVERTED" ? "Quote accepted" : quote.status === "DECLINED" ? "Quote declined" : "Quote expired";

  return (
    <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-16">
      <p className="text-small font-medium text-accent">{headline}</p>
      <h1 className="mt-1 font-mono text-h1">{quote.number}</h1>
      <p className="mt-1 text-small text-ink-muted">
        For {quote.contactName}
        {quote.validUntil && quote.status === "PRICED" ? ` · valid until ${formatDate(quote.validUntil)}` : ""}
      </p>
      {quote.salesNote && quote.status === "PRICED" ? <p className="mt-6 max-w-[44rem] border border-line bg-surface p-4 text-body text-ink">{quote.salesNote}</p> : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-8">
          <Table caption="Quoted lines">
            <THead>
              <Tr>
                <Th>Item</Th>
                <Th numeric>Qty</Th>
                <Th numeric>Unit (ex VAT)</Th>
                <Th numeric>Line (ex VAT)</Th>
              </Tr>
            </THead>
            <TBody>
              {quote.items.map((i) => (
                <Tr key={i.id}>
                  <Td>{i.variant ? `${i.variant.product.name} ${i.variant.packLabel}` : i.description}</Td>
                  <Td className="text-right tabular-nums">{i.qty}</Td>
                  <Td className="text-right tabular-nums">{i.unitPriceMinorUnits !== null ? money.formatKes(i.unitPriceMinorUnits) : "—"}</Td>
                  <Td className="text-right tabular-nums">{i.unitPriceMinorUnits !== null ? money.formatKes(money.times(i.unitPriceMinorUnits, i.qty)) : "—"}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          {priced ? (
            <dl className="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-y-1 text-body">
              <dt className="text-ink-muted">Subtotal (ex VAT)</dt>
              <dd className="text-right tabular-nums">{money.formatKes(subtotal)}</dd>
              <dt className="text-ink-muted">VAT</dt>
              <dd className="text-right tabular-nums">{money.formatKes(vat)}</dd>
              <dt className="font-semibold">Total</dt>
              <dd className="text-right font-semibold tabular-nums">{money.formatKes(subtotal + vat)}</dd>
            </dl>
          ) : null}
          <p className="mt-3 text-small text-ink-muted">Collection from Mombasa Road, Nairobi. Ask us for delivery when you accept and we add the zone fee to the order.</p>
        </section>

        <aside className="min-w-0 lg:col-span-4">
          {quote.status === "PRICED" ? (
            <>
              <ActionForm action={acceptQuoteAction.bind(null, quote.number, token ?? "")} submitLabel="Accept and place the order" busyLabel="Placing order…" className="border border-line bg-surface p-5">
                <Select name="paymentMethod" label="Pay by" defaultValue="COD">
                  {registry.MPESA.isConfigured() ? <option value="MPESA">M-Pesa</option> : null}
                  {registry.CARD.isConfigured() ? <option value="CARD">Card</option> : null}
                  <option value="COD">Cash or M-Pesa on collection</option>
                  {org?.credit.approved ? <option value="INVOICE">Invoice ({org.name})</option> : null}
                </Select>
                <Input name="poNumber" label="Purchase order number" optional />
              </ActionForm>
              <ActionForm action={declineQuoteAction.bind(null, quote.number, token ?? "")} submitLabel="Decline" busyLabel="Sending…" className="mt-4 p-5">
                <Textarea name="reason" label="Tell us why (optional)" optional rows={2} />
              </ActionForm>
            </>
          ) : quote.order ? (
            <a href={`/orders/${quote.order.number}?token=${quote.order.accessToken}`} className="inline-flex min-h-12 items-center rounded-button bg-ink px-5 text-button text-white hover:bg-accent-deep">
              Open order {quote.order.number}
            </a>
          ) : quote.status === "REQUESTED" ? (
            <p className="text-body text-ink-muted">We price quotes within one working day and email you when it is ready.</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
