import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { QuoteForm } from "./quote-form";

export const metadata: Metadata = {
  title: "Request a quote",
  description: `Request a custom B2B quote for cleaning chemicals, bulk drums, institutional tenders, and dosing equipment from ${site.legalName}.`,
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

export default async function QuotePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const product = first(params["product"]);
  const pack = first(params["pack"]);

  return (
    <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-16">
      <nav aria-label="Breadcrumb" className="text-small text-ink-muted">
        <Link href="/" className="hover:underline underline-offset-[3px]">
          Home
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Request a quote</span>
      </nav>

      <div className="mt-4 max-w-[62ch]">
        <h1 className="text-h1">Request a commercial quote</h1>
        <p className="mt-3 text-body text-ink-muted">
          For hotels, healthcare facilities, commercial laundries, schools, and contract cleaners.
          We provide cost-in-use pricing, bulk drum supply (20L, 200L, 1000L IBCs), installed dosing systems,
          and staff hygiene training.
        </p>
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-chip border border-line bg-surface p-6 sm:p-8">
            <QuoteForm initialProduct={product} initialPack={pack} />
          </div>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-chip border border-line bg-surface p-6">
            <h2 className="text-h4 font-semibold text-ink">The Safuney Advantage</h2>
            <ul className="mt-4 space-y-3 text-small text-ink">
              <li className="flex gap-2">
                <span className="text-accent font-bold">✓</span>
                <span><strong>Cost-in-use calculation</strong>: We price per ready-to-use diluted litre and per kg of linen, not just per drum.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-accent font-bold">✓</span>
                <span><strong>Free 14-day trials</strong>: On-site comparative trial with loaner dosing systems for hotels and laundries.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-accent font-bold">✓</span>
                <span><strong>KRA eTIMS & KEBS compliant</strong>: Full tax invoices and certified documentation for audit safety.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-accent font-bold">✓</span>
                <span><strong>Direct plant dispatch</strong>: Formulated and quality-controlled at our Ruai plant with dedicated delivery fleet.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-chip border border-line bg-ground p-6">
            <h3 className="text-label font-semibold text-ink">Already an approved credit customer?</h3>
            <p className="mt-2 text-small text-ink-muted">
              Logged-in organisations can place purchase orders directly on 30-day invoice terms through the online checkout.
            </p>
            <div className="mt-4">
              <Link
                href="/account/credit-application"
                className="inline-flex items-center text-small font-medium text-accent underline underline-offset-[3px]"
              >
                Apply for a corporate credit account →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
