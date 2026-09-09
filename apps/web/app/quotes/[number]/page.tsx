import type { Metadata } from "next";
import Link from "next/link";
import { isDatabaseConfigured } from "@safuney/db";
import { quoteService } from "@/lib/quotes";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Quote details",
};

interface QuotePageProps {
  params: Promise<{ number: string }>;
}

export default async function QuoteDetailsPage({ params }: QuotePageProps) {
  const { number } = await params;

  let quote = null;
  if (isDatabaseConfigured()) {
    try {
      quote = await quoteService().getQuoteByNumber(number);
    } catch {
      quote = null;
    }
  }

  // Demo fallback if quote doesn't exist in DB yet
  const displayQuote = quote ?? {
    number,
    status: "REQUESTED",
    contactName: "Procurement Officer",
    contactEmail: "purchasing@client.co.ke",
    contactPhone: "+254700000000",
    createdAt: new Date(),
    notes: "Delivery to site. 14-day trial requested.",
    items: [
      { id: "1", description: "Commercial Kitchen Hygiene Concentrates", qty: 5, unitPriceMinorUnits: null, vatRateBps: 1600 },
      { id: "2", description: "Food-contact QAC Sanitiser 20L", qty: 10, unitPriceMinorUnits: null, vatRateBps: 1600 },
    ],
  };

  const statusBadge = (st: string) => {
    switch (st) {
      case "REQUESTED":
        return <span className="inline-flex rounded-chip border border-line bg-ground px-3 py-1 text-label font-medium text-ink">Awaiting pricing</span>;
      case "PRICED":
        return <span className="inline-flex rounded-chip border border-accent bg-accent-wash px-3 py-1 text-label font-medium text-accent">Priced & ready</span>;
      case "ACCEPTED":
        return <span className="inline-flex rounded-chip border border-green-600 bg-green-50 px-3 py-1 text-label font-medium text-green-700">Accepted</span>;
      case "DECLINED":
        return <span className="inline-flex rounded-chip border border-line bg-ground px-3 py-1 text-label font-medium text-ink-muted">Declined</span>;
      default:
        return <span className="inline-flex rounded-chip border border-line bg-ground px-3 py-1 text-label font-medium text-ink">{st}</span>;
    }
  };

  return (
    <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-16">
      <nav aria-label="Breadcrumb" className="text-small text-ink-muted">
        <Link href="/" className="hover:underline underline-offset-[3px]">
          Home
        </Link>
        <span aria-hidden> / </span>
        <Link href="/quote" className="hover:underline underline-offset-[3px]">
          Quotes
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page" className="font-mono">{number}</span>
      </nav>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <span className="text-small text-ink-muted">Commercial quotation</span>
          <h1 className="mt-1 font-mono text-h2 font-semibold text-ink">{number}</h1>
        </div>
        <div>{statusBadge(displayQuote.status)}</div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="rounded-chip border border-line bg-surface p-6">
            <h2 className="text-h4 font-semibold text-ink">Requested line items</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-small">
                <thead>
                  <tr className="border-b border-line text-ink-muted">
                    <th className="pb-3 font-medium">Item & specification</th>
                    <th className="pb-3 text-right font-medium">Quantity</th>
                    <th className="pb-3 text-right font-medium">Unit price (KES)</th>
                    <th className="pb-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {displayQuote.items.map((item) => {
                    const price = item.unitPriceMinorUnits ? Number(item.unitPriceMinorUnits) / 100 : null;
                    const lineTotal = price ? price * item.qty : null;
                    return (
                      <tr key={item.id}>
                        <td className="py-3 font-medium text-ink">{item.description}</td>
                        <td className="py-3 text-right font-mono">{item.qty}</td>
                        <td className="py-3 text-right font-mono">
                          {price !== null ? price.toLocaleString("en-KE", { minimumFractionDigits: 2 }) : "Pending quote"}
                        </td>
                        <td className="py-3 text-right font-mono font-medium">
                          {lineTotal !== null ? `KES ${lineTotal.toLocaleString("en-KE", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {displayQuote.notes ? (
              <div className="mt-6 border-t border-line pt-4">
                <p className="text-label text-ink-muted">Requirements & site notes</p>
                <p className="mt-1 whitespace-pre-line text-small text-ink">{displayQuote.notes}</p>
              </div>
            ) : null}
          </div>

          {displayQuote.status === "PRICED" ? (
            <div className="rounded-chip border border-accent bg-accent-wash p-6">
              <h3 className="text-h4 font-semibold text-ink">Quote is ready for review</h3>
              <p className="mt-2 text-small text-ink">
                Our sales team has priced this request with corporate volume discounts. You can accept this quote to schedule dispatch and invoice creation.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-button bg-ink px-6 text-button text-white hover:bg-accent-deep"
                >
                  Accept quote & confirm order
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-chip border border-line bg-surface p-6">
            <h3 className="text-label font-semibold text-ink">Contact on quote</h3>
            <dl className="mt-3 space-y-2 text-small">
              <div>
                <dt className="text-ink-muted">Contact person</dt>
                <dd className="font-medium text-ink">{displayQuote.contactName}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Email</dt>
                <dd className="font-medium text-ink">{displayQuote.contactEmail}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Phone</dt>
                <dd className="font-medium text-ink">{displayQuote.contactPhone}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-chip border border-line bg-ground p-6">
            <h3 className="text-label font-semibold text-ink">Need changes?</h3>
            <p className="mt-2 text-small text-ink-muted">
              Call our commercial desk to adjust quantities, request product alternatives, or schedule a technician site survey.
            </p>
            <p className="mt-3 text-small font-medium text-ink">
              Tel: <a href={`tel:${site.contact.phone.e164}`} className="text-accent underline">{site.contact.phone.display}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
