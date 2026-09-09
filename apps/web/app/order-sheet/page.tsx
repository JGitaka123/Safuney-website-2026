import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@safuney/ui";
import { site } from "@/config/site";
import { listOrderSheet, stockStatus } from "@/lib/catalogue/queries";
import { displayPrice } from "@/lib/pricing";
import { getPriceDisplayMode, isFeatureEnabled } from "@/lib/settings";
import { OrderSheet, type OrderSheetGroup } from "@/components/order-sheet/order-sheet";
import { Breadcrumbs } from "@/components/site/breadcrumbs";

/* Indexing opens with the shop (interim site is noindex anyway, ADR 0002). */
export const metadata: Metadata = { title: "Order sheet", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderSheetPage() {
  const shop = await isFeatureEnabled("shop.enabled");

  if (!shop) {
    return (
      <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
        <Breadcrumbs items={[{ label: "Order sheet" }]} />
        <h1 className="mt-3 text-h1">Order sheet</h1>
        <div className="mt-8 max-w-2xl">
          <EmptyState
            headingLevel={2}
            heading="The order sheet opens with online ordering"
            body="When the shop launches this page lists every pack size with its price and a quantity box, so a whole order goes in the cart from one screen. Until then we quote the same day."
            actions={[
              <Link key="quote" href="/contact?topic=quote" className="inline-flex min-h-11 items-center rounded-button bg-ink px-5 text-button text-white hover:bg-accent-deep">
                Request a quote
              </Link>,
              <a key="call" href={`tel:${site.contact.phone.e164}`} className="inline-flex min-h-11 items-center rounded-button border border-stainless bg-surface px-5 text-button text-ink">
                Call {site.contact.phone.display}
              </a>,
            ]}
          />
        </div>
      </div>
    );
  }

  const [products, mode] = await Promise.all([listOrderSheet(), getPriceDisplayMode()]);

  const groups: OrderSheetGroup[] = [];
  for (const p of products) {
    const key = p.category.slug;
    let group = groups.find((g) => g.slug === key);
    if (!group) {
      group = { slug: key, name: p.category.name, rows: [] };
      groups.push(group);
    }
    const href = `/products/${p.category.slug}/${p.slug}`;
    for (const v of p.variants) {
      const price = v.priceMinorUnits > 0n ? displayPrice(v.priceMinorUnits, v.vatRateBps, mode) : null;
      const stock = stockStatus(v);
      group.rows.push({
        variantId: v.id,
        productName: p.name,
        href,
        packLabel: v.packLabel,
        sku: v.sku,
        unitPrice: price?.headline ?? null,
        stock,
        available: Math.max(0, v.stockOnHand - v.stockReserved),
        madeToOrder: v.isMadeToOrder,
      });
    }
  }
  const lineCount = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <Breadcrumbs items={[{ href: "/products", label: "Products" }, { label: "Order sheet" }]} />
      <header className="mt-3 max-w-[62ch]">
        <h1 className="text-h1">Order sheet</h1>
        <p className="mt-3 text-ink-muted">
          Every pack size on one page: <span className="tnum">{lineCount}</span> lines across {groups.length} {groups.length === 1 ? "category" : "categories"}. Enter quantities next to what you need and add them all to the cart in one go.
        </p>
      </header>
      <div className="mt-8">
        <OrderSheet groups={groups} priceHeading={mode === "INC_VAT" ? "Unit price (incl. VAT)" : "Unit price (ex VAT)"} />
      </div>
    </div>
  );
}
