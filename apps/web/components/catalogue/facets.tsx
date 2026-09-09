import Link from "next/link";
import { ZONES, cn } from "@safuney/ui";
import { activeFilterCount, toggleFacet, withFilter, type CatalogueFilters } from "@/lib/catalogue/filters";
import type { CategoryPage } from "@/lib/catalogue/queries";

interface FacetsProps {
  base: string;
  filters: CatalogueFilters;
  facets: CategoryPage["facets"];
  idPrefix?: string;
}

function href(base: string, qs: string) {
  return qs ? `${base}?${qs}` : base;
}

/** Server-rendered facet list: every option is a link, so filters work without JavaScript and are URL-synced. */
export function Facets({ base, filters, facets, idPrefix = "facet" }: FacetsProps) {
  const count = activeFilterCount(filters);
  return (
    <div className="flex flex-col gap-6">
      {count > 0 ? (
        <Link href={href(base, withFilter(filters, { zone: undefined, brands: [], packs: [], applications: [], priceMin: undefined, priceMax: undefined, inStock: false }))} className="self-start text-small text-accent underline underline-offset-[3px]">
          Clear {count} filter{count === 1 ? "" : "s"}
        </Link>
      ) : null}

      {facets.zones.length > 0 ? (
        <FacetGroup id={`${idPrefix}-zone`} title="Where will you use it?">
          {ZONES.filter((z) => facets.zones.some((f) => f.value === z.key)).map((z) => {
            const selected = filters.zone === z.key;
            const n = facets.zones.find((f) => f.value === z.key)?.count ?? 0;
            return (
              <FacetLink key={z.key} selected={selected} href={href(base, withFilter(filters, { zone: selected ? undefined : z.key }))} count={n}>
                <span aria-hidden className={cn("size-2 shrink-0", z.swatch)} />
                {z.label}
              </FacetLink>
            );
          })}
        </FacetGroup>
      ) : null}

      {facets.brands.length > 1 ? (
        <FacetGroup id={`${idPrefix}-brand`} title="Brand">
          {facets.brands.map((b) => (
            <FacetLink key={b.value} selected={filters.brands.includes(b.value)} href={href(base, toggleFacet(filters, "brands", b.value))} count={b.count}>
              {b.value}
            </FacetLink>
          ))}
        </FacetGroup>
      ) : null}

      {facets.applications.length > 0 ? (
        <FacetGroup id={`${idPrefix}-application`} title="Application">
          {facets.applications.map((a) => (
            <FacetLink key={a.value} selected={filters.applications.includes(a.value)} href={href(base, toggleFacet(filters, "applications", a.value))} count={a.count}>
              {a.value.replace(/-/g, " ")}
            </FacetLink>
          ))}
        </FacetGroup>
      ) : null}

      {facets.packs.length > 1 ? (
        <FacetGroup id={`${idPrefix}-pack`} title="Pack size">
          {facets.packs.map((p) => (
            <FacetLink key={p.value} selected={filters.packs.includes(p.value)} href={href(base, toggleFacet(filters, "packs", p.value))} count={p.count}>
              {p.value}
            </FacetLink>
          ))}
        </FacetGroup>
      ) : null}

      <FacetGroup id={`${idPrefix}-stock`} title="Availability">
        <FacetLink selected={filters.inStock} href={href(base, withFilter(filters, { inStock: !filters.inStock }))}>
          In stock now
        </FacetLink>
      </FacetGroup>

      {facets.priceRange ? (
        <FacetGroup id={`${idPrefix}-price`} title="Price" list={false}>
          <form action={base} method="get" className="flex flex-col gap-3">
            {/* Keep the other filters when the price form submits. */}
            {[...withFilter(filters, { priceMin: undefined, priceMax: undefined }).split("&")]
              .filter(Boolean)
              .map((pair) => {
                const [k, v] = pair.split("=");
                return <input key={k} type="hidden" name={decodeURIComponent(k!)} value={decodeURIComponent(v ?? "")} />;
              })}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-small">
                From (KES)
                <input type="number" name="min" min={0} inputMode="numeric" defaultValue={filters.priceMin ?? ""} placeholder={String(facets.priceRange.min)} className="min-h-11 rounded-chip border border-stainless bg-surface px-3 tabular-nums" />
              </label>
              <label className="flex flex-col gap-1 text-small">
                To (KES)
                <input type="number" name="max" min={0} inputMode="numeric" defaultValue={filters.priceMax ?? ""} placeholder={String(facets.priceRange.max)} className="min-h-11 rounded-chip border border-stainless bg-surface px-3 tabular-nums" />
              </label>
            </div>
            <button type="submit" className="min-h-11 rounded-button border border-stainless bg-surface px-4 text-button text-ink hover:bg-ground-deep">
              Apply price
            </button>
          </form>
        </FacetGroup>
      ) : null}
    </div>
  );
}

function FacetGroup({ id, title, children, list = true }: { id: string; title: string; children: React.ReactNode; list?: boolean }) {
  return (
    <fieldset aria-labelledby={id} className="min-w-0">
      <p id={id} className="text-label text-ink">
        {title}
      </p>
      {list ? <ul className="mt-2 flex flex-col">{children}</ul> : <div className="mt-2">{children}</div>}
    </fieldset>
  );
}

function FacetLink({ href, selected, count, children }: { href: string; selected: boolean; count?: number; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-chip border px-2 text-small",
          selected ? "border-2 border-accent bg-accent-wash text-ink" : "border-transparent text-ink hover:bg-ground-deep",
        )}
      >
        {selected ? (
          <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 7l3.5 3.5L12 4" />
          </svg>
        ) : null}
        <span className="flex-1">{children}</span>
        {typeof count === "number" ? <span className="tnum text-caption text-ink-muted">{count}</span> : null}
      </Link>
    </li>
  );
}
