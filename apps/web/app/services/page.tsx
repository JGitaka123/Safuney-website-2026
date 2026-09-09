import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@safuney/ui";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Support services",
  description: "Training, equipment service and repair, and managed housekeeping from Safuney Limited, Nairobi.",
};

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-reading px-5 py-10 md:px-6 md:py-16">
      <nav aria-label="Breadcrumb" className="text-small text-ink-muted">
        <Link href="/" className="hover:underline underline-offset-[3px]">Home</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Services</span>
      </nav>
      <h1 className="mt-3 text-h1">Support services</h1>
      <p className="mt-3 max-w-[62ch] text-ink-muted">
        The chemical is half of the result. The other half is the person, the dosing equipment and the routine. Safuney
        supplies all three.
      </p>
      <div className="mt-10 grid gap-8">
        {site.services.map((svc) => (
          <section key={svc.slug} id={svc.slug} aria-labelledby={`svc-${svc.slug}`} className="border-t border-line pt-6">
            <h2 id={`svc-${svc.slug}`} className="text-h2">
              {svc.name}
            </h2>
            <p className="mt-3 max-w-[62ch]">{svc.detail}</p>
          </section>
        ))}
      </div>
      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/contact?topic=services">Ask about services</ButtonLink>
        <ButtonLink href={`tel:${site.contact.phone.e164}`} variant="secondary">
          Call {site.contact.phone.display}
        </ButtonLink>
      </div>
    </div>
  );
}
