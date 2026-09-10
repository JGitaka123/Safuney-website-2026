import Image from "next/image";
import Link from "next/link";
import { PackShot, ProductCard, type HazardClass, type ZoneKey } from "@safuney/ui";
import type { ProductCardData } from "@/lib/catalogue/queries";
import { fromPrice, type PriceDisplayMode } from "@/lib/pricing";

/** Server wrapper that turns a catalogue row into the design-system ProductCard. */
export function ProductGridCard({ product, mode, categorySlug, headingLevel = 3 }: { product: ProductCardData; mode: PriceDisplayMode; categorySlug: string; headingLevel?: 2 | 3 | 4 }) {
  const price = fromPrice(product.variants, mode);
  const href = `/products/${categorySlug}/${product.slug}`;
  const image = product.images[0];
  // The smallest pack decides the drawing, because that is the one a first-time buyer pictures.
  const lead = product.variants[0];
  return (
    <ProductCard
      name={product.name}
      href={href}
      headingLevel={headingLevel}
      zones={product.zone === "NONE" ? [] : [product.zone as ZoneKey]}
      packs={product.variants.map((v) => v.packLabel)}
      priceLabel={price ? price.label.replace(/^From /, "") : undefined}
      hazard={product.hazardClass as HazardClass}
      image={
        image ? (
          <Image src={image.url} alt={image.alt} width={image.width ?? 600} height={image.height ?? 600} className="h-full w-full object-cover" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" />
        ) : lead ? (
          // No photograph yet: draw the pack from what the variant actually is (see PackShot).
          <PackShot
            packLabel={lead.packLabel}
            unit={lead.unit as "L" | "ML" | "KG" | "G" | "PCS"}
            size={Number(lead.packSizeValue)}
            zones={product.zone === "NONE" ? [] : [product.zone as ZoneKey]}
          />
        ) : undefined
      }
      action={
        <Link href={href} className="inline-flex min-h-11 w-full items-center justify-center rounded-button border border-stainless bg-surface px-4 text-button text-ink hover:bg-ground-deep">
          Choose pack size
        </Link>
      }
    />
  );
}
