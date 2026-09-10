import Link from "next/link";
import { site } from "@/config/site";

/**
 * The band directly under the hero.
 *
 * Four claims, each one checkable and each linking to the page that proves it. Trade-supply sites all
 * carry a version of this, and the reason it works is that every item answers a purchasing objection
 * rather than describing the company: will it arrive, is it documented, can I buy on account, will
 * someone tell me what to use.
 *
 * Nothing here is a slogan. If a claim cannot be linked to a page that backs it up, it does not belong.
 */
const ITEMS = [
  {
    title: site.delivery.promise,
    body: "Delivery is quoted at checkout before you pay, never estimated afterwards.",
    href: "/delivery-and-returns",
    link: "Delivery and returns",
  },
  {
    title: "Dilution and safety data on every product",
    body: "Ratios, contact times and the safety data sheet an auditor asks for.",
    href: "/resources",
    link: "Guides and safety data",
  },
  {
    title: "Buy on account, with approvals",
    body: "Agreed prices across sites, purchase orders, and a spend threshold that needs a sign-off.",
    href: "/account/credit",
    link: "Open a credit account",
  },
  {
    title: "Trained on the products we sell",
    body: "Staff training, equipment service, and managed housekeeping if you want the whole job done.",
    href: "/services",
    link: "Support services",
  },
];

export function TrustBar() {
  return (
    <section aria-labelledby="why-us" className="border-y border-line bg-surface">
      <h2 id="why-us" className="sr-only">
        Why buy from Safuney
      </h2>
      <div className="mx-auto grid max-w-page gap-px bg-line px-0 md:grid-cols-4">
        {ITEMS.map((item) => (
          <div key={item.title} className="bg-surface px-5 py-6 md:px-6">
            <p className="text-h4 text-ink">{item.title}</p>
            <p className="mt-2 text-small text-ink-muted">{item.body}</p>
            <p className="mt-3">
              <Link href={item.href} className="text-small text-accent underline underline-offset-[3px] hover:decoration-2">
                {item.link}
              </Link>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
