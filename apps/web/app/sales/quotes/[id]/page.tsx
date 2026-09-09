import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, money } from "@safuney/db";
import { Input, Select, Textarea } from "@safuney/ui";
import { requireRole } from "@/lib/auth/session";
import { orderService } from "@/lib/orders/context";
import { QuoteError, QuoteService } from "@/lib/b2b/quotes";
import { priceQuoteAction } from "@/lib/b2b/quote-actions";
import { ActionForm } from "@/components/account/action-form";

export const metadata: Metadata = { title: "Price a quote", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SalesQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireRole(["SALES", "ADMIN"], `/sales/quotes/${id}`);
  let quote;
  try {
    quote = await new QuoteService(db(), orderService()).getForSales(who.id, id);
  } catch (e) {
    if (e instanceof QuoteError) notFound();
    throw e;
  }
  const editable = ["REQUESTED", "PRICED", "EXPIRED"].includes(quote.status);
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <p className="text-small text-ink-muted">
        <Link href="/sales/quotes" className="hover:underline underline-offset-[3px]">
          Quotes
        </Link>
      </p>
      <h1 className="mt-1 font-mono text-h1">{quote.number}</h1>
      <p className="mt-1 text-body text-ink">
        {quote.contactName}
        {quote.customer ? ` · ${quote.customer.displayName}` : ""} · {quote.contactEmail} · <span className="tabular-nums">{quote.contactPhone}</span>
      </p>
      {quote.notes ? <p className="mt-3 max-w-[44rem] whitespace-pre-line border border-line bg-surface p-4 text-body text-ink">{quote.notes}</p> : null}
      {quote.order ? (
        <p className="mt-4 text-body text-ink">
          Converted to order <span className="font-mono">{quote.order.number}</span>.
        </p>
      ) : null}

      <div className="mt-8 max-w-[52rem]">
        {editable ? (
          <ActionForm action={priceQuoteAction.bind(null, quote.id)} submitLabel={quote.status === "PRICED" ? "Re-send the quote" : "Send the quote"} busyLabel="Sending…" className="border border-line bg-surface p-6">
            <p className="text-small text-ink-muted">Attach every line to a catalogue pack by SKU so acceptance becomes an order, then price each line ex VAT.</p>
            {quote.items.map((i, n) => (
              <fieldset key={i.id} className="grid gap-4 border-t border-line pt-4 sm:grid-cols-[1fr_12rem_6rem_10rem]">
                <legend className="text-body font-medium text-ink">
                  Line {n + 1}: {i.description}
                </legend>
                <p className="text-small text-ink-muted sm:col-span-4">
                  Asked for {i.qty}
                  {i.variant ? ` · currently ${i.variant.product.name} ${i.variant.packLabel} (list ${money.formatKes(i.variant.priceMinorUnits)})` : ""}
                </p>
                <Input name={`sku:${i.id}`} label="SKU" defaultValue={i.variant?.sku ?? ""} required className="font-mono uppercase" />
                <Input name={`price:${i.id}`} label="Unit price ex VAT (KES)" defaultValue={i.unitPriceMinorUnits !== null ? money.formatKes(i.unitPriceMinorUnits).replace(/^KES\s/, "") : i.variant ? money.formatKes(i.variant.priceMinorUnits).replace(/^KES\s/, "") : ""} required inputMode="decimal" />
                <Input name={`qty:${i.id}`} label="Qty" type="number" min={1} defaultValue={i.qty} required inputMode="numeric" />
              </fieldset>
            ))}
            <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <Select name="validDays" label="Valid for" defaultValue="14">
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </Select>
            </div>
            <Textarea name="salesNote" label="Note to the customer" optional rows={3} defaultValue={quote.salesNote ?? ""} helper="Shown at the top of the quote and in the email." />
          </ActionForm>
        ) : (
          <p className="text-body text-ink-muted">This quote is {quote.status.toLowerCase()} and can no longer be changed.</p>
        )}
      </div>
    </div>
  );
}
