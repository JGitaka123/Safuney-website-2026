import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ZONES } from "@safuney/ui";
import { money } from "@safuney/db";
import { readCart } from "@/lib/cart/cookies";
import { getPriceDisplayMode } from "@/lib/settings";
import { CartLine } from "@/components/cart/cart-line";
import { Breadcrumbs } from "@/components/site/breadcrumbs";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [cart, mode] = await Promise.all([readCart(), getPriceDisplayMode()]);
  const lines = cart?.lines ?? [];

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
        <Breadcrumbs items={[{ label: "Cart" }]} />
        <h1 className="mt-3 text-h1">Your cart</h1>
        <div className="mt-8 max-w-2xl">
          <EmptyState heading="Your cart is empty" body="Start with the zone you clean most.">
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {ZONES.map((z) => (
                <li key={z.key}>
                  <Link href={`/products?zone=${z.slug}`} className="flex min-h-12 items-center gap-3 border border-line bg-surface px-4 hover:border-stainless">
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

  const fmt = (m: bigint) => money.formatKes(m);
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <Breadcrumbs items={[{ label: "Cart" }]} />
      <h1 className="mt-3 text-h1">Your cart</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        <ul className="min-w-0 divide-y divide-line border-y border-line lg:col-span-8">
          {lines.map((l) => (
            <CartLine
              key={l.id}
              variantId={l.variantId}
              name={l.name}
              packLabel={l.packLabel}
              href={`/products/${l.categorySlug}/${l.productSlug}`}
              qty={l.qty}
              unitPrice={fmt(mode === "INC_VAT" ? l.unitPriceMinorUnits + money.vatOn(l.unitPriceMinorUnits, l.vatRateBps) : l.unitPriceMinorUnits)}
              lineTotal={fmt(mode === "INC_VAT" ? l.lineExVat + l.lineVat : l.lineExVat)}
              available={l.available}
              madeToOrder={l.madeToOrder}
              unavailable={l.unavailable}
            />
          ))}
        </ul>
        <aside className="lg:col-span-4">
          <div className="border border-line bg-surface p-5">
            <h2 className="text-h4">Summary</h2>
            <dl className="mt-4 flex flex-col gap-2 text-body">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tnum" data-money>
                  {fmt(cart!.subtotalMinorUnits)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>VAT</dt>
                <dd className="tnum" data-money>
                  {fmt(cart!.vatMinorUnits)}
                </dd>
              </div>
              <div className="flex justify-between text-small text-ink-muted">
                <dt>Delivery</dt>
                <dd>Quoted at checkout by zone</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-price">
                <dt>Total</dt>
                <dd className="tnum" data-money>
                  {fmt(cart!.totalMinorUnits)}
                </dd>
              </div>
            </dl>
            <Link href="/checkout" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-button bg-ink px-5 text-button text-white hover:bg-accent-deep">
              Go to checkout
            </Link>
            <Link href="/products" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-button border border-stainless bg-surface px-5 text-button text-ink hover:bg-ground-deep">
              Continue shopping
            </Link>
            <p className="mt-4 text-caption text-ink-muted">Prices are recalculated from the catalogue when you check out. Nothing is reserved until you place the order.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
