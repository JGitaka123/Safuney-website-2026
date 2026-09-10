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
      priceNote={price ? undefined : "Price on request"}
      hazard={product.hazardClass as HazardClass}
      image={
        image ? (
          // Centred and never scaled past its own pixels (ADR 0016).
          <div className="grid h-full w-full place-items-center p-4">
            <Image
              src={image.url}
              alt={image.alt}
              width={image.width ?? 480}
              height={image.height ?? 480}
              className="object-contain"
              style={{ width: "100%", height: "auto", maxWidth: `${image.width ?? 480}px`, maxHeight: "100%" }}
              sizes="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 45vw"
            />
          </div>
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
          {product.variants.length > 1 ? "Choose pack size" : price ? "View product" : "Request a quote"}
        </Link>
      }
    />
  );
}
