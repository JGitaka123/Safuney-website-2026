import Image from "next/image";
import Link from "next/link";
import { PackShot, ProductCard, zoneMeta, type HazardClass, type ZoneKey } from "@safuney/ui";
import type { ProductCardData } from "@/lib/catalogue/queries";
import { quoteHref } from "@/lib/contact";
import { fromPrice, type PriceDisplayMode } from "@/lib/pricing";

/** Alliance Chemical's "Select options" button: full width, blue outline, capitals, a cart mark. */
const actionClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-button border-2 border-accent bg-surface px-4 text-small font-semibold uppercase tracking-wide text-accent hover:bg-accent-wash";

function CartMark() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.5L21.5 8H6.2" />
      <circle cx="10" cy="20" r="1.2" />
      <circle cx="17" cy="20" r="1.2" />
    </svg>
  );
}

/** "Available sizes: 5 L–20 L", "Available size: 4 kg", or nothing when the catalogue gives no size. */
export function sizesLine(labels: readonly string[]): string | undefined {
  const sized = labels.filter((l) => /\d/.test(l));
  if (sized.length === 0) return "Pack size on request";
  if (sized.length === 1) return `Available size: ${sized[0]}`;
  return `Available sizes: ${sized[0]}–${sized[sized.length - 1]}`;
}

/** Server wrapper that turns a catalogue row into the design-system ProductCard. */
export function ProductGridCard({
  product,
  mode,
  categorySlug,
  headingLevel = 3,
  showCategory = false,
  showDescription = false,
  priority = false,
}: {
  product: ProductCardData;
  mode: PriceDisplayMode;
  categorySlug: string;
  headingLevel?: 2 | 3 | 4;
  /** Name the range above the product, for grids that mix ranges. */
  showCategory?: boolean;
  /** One line of use under the name. Off in grids. */
  showDescription?: boolean;
  /** Load the picture eagerly: only for the first row of a listing, where it is the largest thing on screen. */
  priority?: boolean;
}) {
  const price = fromPrice(product.variants, mode);
  const href = `/products/${categorySlug}/${product.slug}`;
  const image = product.images[0];
  // The smallest pack decides the drawing, because that is the one a first-time buyer pictures.
  const lead = product.variants[0];
  const zones = product.zone === "NONE" ? [] : [product.zone as ZoneKey];
  const attribute = zoneMeta(product.zone)?.label ?? product.category.name;
  return (
    <ProductCard
      name={product.name}
      href={href}
      headingLevel={headingLevel}
      eyebrow={showCategory ? product.category.name : undefined}
      description={showDescription ? product.shortDescription : undefined}
      zones={zones}
      attribute={attribute}
      sizes={sizesLine(product.variants.map((v) => v.packLabel))}
      priceLabel={price ? price.label.replace(/^From /, "") : undefined}
      priceNote={price ? undefined : "Price on request"}
      hazard={product.hazardClass as HazardClass}
      image={
        image ? (
          // Contained inside the square with padding, so the whole pack shows at any card width. The
          // cut-outs are about 480 px tall (ADR 0016), which covers a card at 2x.
          <Image
            src={image.url}
            alt={image.alt}
            fill
            priority={priority}
            className="object-contain p-5 pb-6 transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none"
            sizes="(min-width: 1280px) 240px, (min-width: 768px) 30vw, 45vw"
          />
        ) : lead ? (
          // No photograph yet: draw the pack from what the variant actually is (see PackShot).
          <PackShot packLabel={lead.packLabel} unit={lead.unit as "L" | "ML" | "KG" | "G" | "PCS"} size={Number(lead.packSizeValue)} zones={zones} />
        ) : undefined
      }
      action={
        price ? (
          <Link href={href} className={actionClass}>
            <CartMark />
            {product.variants.length > 1 ? "Select options" : "View product"}
          </Link>
        ) : (
          <Link href={quoteHref({ product: product.name })} className={actionClass} aria-label={`Get a price for ${product.name}`}>
            <CartMark />
            Get a price
          </Link>
        )
      }
    />
  );
}
