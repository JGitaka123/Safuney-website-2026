import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ZONES } from "@safuney/ui";
import { money } from "@safuney/db";
import { readCart } from "@/lib/cart/cookies";
import { getCheckoutContext } from "@/lib/checkout/actions";
import { services } from "@/lib/env";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { CheckoutWizard } from "@/components/checkout/checkout-wizard";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  if (!services.database()) {
    return (
      <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
        <Breadcrumbs items={[{ label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
        <h1 className="mt-3 text-h1 font-semibold text-ink">Checkout</h1>
        <div className="mt-8 max-w-2xl">
          <EmptyState
            headingLevel={2}
            heading="Online checkout requires database connectivity"
            body="Our online checkout connects directly to inventory and payment providers. To place an order now, please call our sales team or request a direct quotation."
          >
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <a
                href="tel:+254796808822"
                className="inline-flex min-h-12 items-center justify-center rounded-button bg-ink px-5 text-button text-white hover:bg-accent-deep"
              >
                Call +254 796 808 822
              </a>
              <Link
                href="/contact"
                className="inline-flex min-h-12 items-center justify-center rounded-button border border-stainless bg-surface px-5 text-button text-ink hover:bg-ground-deep"
              >
                Request a quote
              </Link>
            </div>
          </EmptyState>
        </div>
      </div>
    );
  }

  const [cart, context] = await Promise.all([readCart(), getCheckoutContext()]);
  const lines = cart?.lines ?? [];

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
        <Breadcrumbs items={[{ label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
        <h1 className="mt-3 text-h1 font-semibold text-ink">Checkout</h1>
        <div className="mt-8 max-w-2xl">
          <EmptyState headingLevel={2} heading="Your cart is empty" body="Start with the zone you clean most.">
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {ZONES.map((z) => (
                <li key={z.key}>
                  <Link
                    href={`/products?zone=${z.slug}`}
                    className="flex min-h-12 items-center gap-3 border border-line bg-surface px-4 hover:border-stainless"
                  >
                    <span aria-hidden className={`h-6 w-2 ${z.swatch}`} />
                    {z.label}
                  </Link>
                </li>
              ))}
            </ul>
          </EmptyState>
        </div>
      </div>
    );
  }

  const totalQuantity = cart!.lines.reduce((s, l) => s + l.qty, 0);
  const serializedCart = {
    itemCount: cart!.itemCount,
    totalQuantity,
    subtotalMinorUnits: cart!.subtotalMinorUnits.toString(),
    subtotalLabel: money.formatKes(cart!.subtotalMinorUnits),
    vatMinorUnits: cart!.vatMinorUnits.toString(),
    vatLabel: money.formatKes(cart!.vatMinorUnits),
    totalMinorUnits: cart!.totalMinorUnits.toString(),
    totalLabel: money.formatKes(cart!.totalMinorUnits),
    weightGrams: cart!.weightGrams,
    lines: cart!.lines.map((l) => ({
      id: l.id,
      name: l.name,
      packLabel: l.packLabel,
      qty: l.qty,
      unitPriceLabel: money.formatKes(l.unitPriceMinorUnits),
      lineTotalLabel: money.formatKes(l.lineExVat + l.lineVat),
    })),
  };

  return <CheckoutWizard cart={serializedCart} context={context} />;
}
