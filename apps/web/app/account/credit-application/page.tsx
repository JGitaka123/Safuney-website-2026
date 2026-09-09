import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { CreditAppForm } from "./credit-app-form";

export const metadata: Metadata = {
  title: "Corporate credit application",
  description: `Apply for 30-day or 45-day corporate credit terms and eTIMS tax invoicing with ${site.legalName}.`,
};

export default function CreditApplicationPage() {
  return (
    <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-16">
      <nav aria-label="Breadcrumb" className="text-small text-ink-muted">
        <Link href="/" className="hover:underline underline-offset-[3px]">
          Home
        </Link>
        <span aria-hidden> / </span>
        <Link href="/account" className="hover:underline underline-offset-[3px]">
          Account
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Credit application</span>
      </nav>

      <div className="mt-4 max-w-[62ch]">
        <h1 className="text-h1">Corporate credit application</h1>
        <p className="mt-3 text-body text-ink-muted">
          Safuney offers 30-day standard credit terms (and 45-day terms for annual Total Hygiene Programme accounts)
          to registered businesses, hotels, healthcare facilities, schools, and institutional buyers in Kenya.
        </p>
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="rounded-chip border border-line bg-surface p-6 sm:p-8">
            <CreditAppForm />
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-chip border border-line bg-surface p-6">
            <h2 className="text-h4 font-semibold text-ink">Safuney Credit Policy</h2>
            <ul className="mt-4 space-y-3 text-small text-ink">
              <li className="flex gap-2">
                <span className="text-accent font-bold">•</span>
                <span><strong>Standard terms</strong>: 30 days net from tax invoice date.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-accent font-bold">•</span>
                <span><strong>Early payment discount</strong>: 2% discount for payments settled within 7 days.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-accent font-bold">•</span>
                <span><strong>Stop-supply rule</strong>: Strictly enforced at 15 days overdue past agreed terms to maintain healthy cash flow.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-accent font-bold">•</span>
                <span><strong>eTIMS compliance</strong>: Every delivery receives an itemised, KRA-deductible tax invoice with QR code.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-chip border border-line bg-ground p-6">
            <h3 className="text-label font-semibold text-ink">Need assistance?</h3>
            <p className="mt-2 text-small text-ink-muted">
              Our finance desk can walk you through requirements or arrange proforma invoices for initial trial orders.
            </p>
            <p className="mt-3 text-small font-medium text-ink">
              Direct line: <a href={`tel:${site.contact.phone.e164}`} className="text-accent underline">{site.contact.phone.display}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
