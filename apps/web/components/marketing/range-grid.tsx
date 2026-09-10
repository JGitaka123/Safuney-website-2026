import Image from "next/image";
import Link from "next/link";
import { ZoneBand, cn } from "@safuney/ui";
import type { CategorySummary } from "@/lib/catalogue";
import { Icon } from "./icons";

/**
 * The ranges as picture tiles: one real pack on a white stage, the range name, the first product
 * names in it and a count. Names rather than a description, because a buyer scans for the product
 * they already use (the way Alliance Chemical lists "Sulfuric, Hydrochloric, Nitric" under Acids).
 */
export function RangeGrid({ categories, headingLevel = 3, className }: { categories: CategorySummary[]; headingLevel?: 2 | 3; className?: string }) {
  const Heading = `h${headingLevel}` as const;
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3", className)}>
      {categories.map((c) => (
        <li key={c.slug} id={c.slug} className="scroll-mt-32">
          <Link
            href={`/products/${c.slug}`}
            className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-stainless hover:shadow-lift motion-reduce:transform-none"
          >
            <div className="bg-stage relative grid aspect-[16/11] place-items-center overflow-hidden">
              {c.image ? (
                <Image
                  src={c.image.url}
                  alt=""
                  width={c.image.width}
                  height={c.image.height}
                  sizes="(min-width: 768px) 140px, 30vw"
                  className="h-[80%] w-auto object-contain drop-shadow-[0_10px_14px_rgba(16,32,43,0.18)] transition-transform duration-300 group-hover:scale-[1.05] motion-reduce:transform-none"
                />
              ) : (
                <Icon name="sparkles" className="size-10 text-stainless" />
              )}
              <ZoneBand zones={c.zones} className="absolute inset-x-0 bottom-0" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
              <Heading className="text-h4 text-ink">{c.name}</Heading>
              {c.topProducts.length > 0 ? <p className="line-clamp-2 hidden text-caption text-ink-muted sm:block">{c.topProducts.join(" · ")}</p> : null}
              <p className="mt-auto flex items-center justify-between gap-2 pt-2 text-small font-medium text-accent">
                <span className="tnum">
                  {c.productCount && c.productCount > 0 ? `${c.productCount} ${c.productCount === 1 ? "product" : "products"}` : "Ask us for a quote"}
                </span>
                <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-0.5" />
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
