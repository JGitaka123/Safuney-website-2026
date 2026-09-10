import Image from "next/image";
import Link from "next/link";
import { PackShot, ProductCard, type HazardClass, type ZoneKey } from "@safuney/ui";
import type { ProductCardData } from "@/lib/catalogue/queries";
import { quoteHref } from "@/lib/contact";
import { fromPrice, type PriceDisplayMode } from "@/lib/pricing";

const actionClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-button border border-stainless bg-surface px-4 text-button text-ink hover:border-ink hover:bg-ground";

/**
 * Server wrapper that turns a catalogue row into the design-system ProductCard. In a grid the card is
 * picture, name, packs and price — no description, the way the benchmark shops do it; the product
 * page carries the words.
 */
export function ProductGridCard({
  product,
  mode,
  categorySlug,
  headingLevel = 3,
  showCategory = false,
  showDescription = false,
}: {
  product: ProductCardData;
  mode: PriceDisplayMode;
  categorySlug: string;
  headingLevel?: 2 | 3 | 4;
  /** Name the range above the product, for grids that mix ranges. */
  showCategory?: boolean;
  /** One line of use under the name. Off in grids. */
  showDescription?: boolean;
}) {
  const price = fromPrice(product.variants, mode);
  const href = `/products/${categorySlug}/${product.slug}`;
  const image = product.images[0];
  // The smallest pack decides the drawing, because that is the one a first-time buyer pictures.
  const lead = product.variants[0];
  const zones = product.zone === "NONE" ? [] : [product.zone as ZoneKey];
  return (
    <ProductCard
      name={product.name}
      href={href}
      headingLevel={headingLevel}
      eyebrow={showCategory ? product.category.name : undefined}
      description={showDescription ? product.shortDescription : undefined}
      zones={zones}
      // "each" and "Pack size on request" describe the absence of a size; they are not chips.
      packs={product.variants.map((v) => v.packLabel).filter((label) => /\d/.test(label))}
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
            className="object-contain p-5 pb-6 drop-shadow-[0_10px_14px_rgba(16,32,43,0.16)] transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transform-none"
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
            {product.variants.length > 1 ? "Choose pack size" : "View product"}
          </Link>
        ) : (
          <Link href={quoteHref({ product: product.name })} className={actionClass} aria-label={`Get a price for ${product.name}`}>
            Get a price
          </Link>
        )
      }
    />
  );
}
