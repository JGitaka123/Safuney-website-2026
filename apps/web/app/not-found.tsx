import type { Metadata } from "next";
import { ButtonLink } from "@safuney/ui";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-24">
      <div className="max-w-reading">
        <p className="text-label text-ink-muted">404</p>
        <h1 className="mt-2 text-h1">That page does not exist</h1>
        <p className="mt-4 text-body-lg text-ink-muted">
          The address may have changed, or the product may have moved. Nothing is wrong with your connection.
        </p>
        <p className="mt-4 text-body text-ink">
          If you need something now, call{" "}
          <a href={`tel:${site.contact.phone.e164}`} className="text-accent underline">
            {site.contact.phone.display}
          </a>{" "}
          and a person will find it for you.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/">Go to the home page</ButtonLink>
          <ButtonLink href="/products" variant="secondary">
            Browse products
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
