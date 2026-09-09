import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@safuney/db";
import { ButtonLink, Table, TBody, Td, Th, THead, Tr } from "@safuney/ui";
import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";
import { InlineEdit, StockEdit } from "@/components/admin/inline-edit";
import { ReviewToggle } from "@/components/admin/review-toggle";
import { adjustStock, setProductReviewed, setVariantPrice } from "@/lib/admin/actions";

export const metadata: Metadata = { title: "Catalogue" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "needs-review", label: "Needs review" },
  { key: "low-stock", label: "Low stock" },
  { key: "hidden", label: "Hidden" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default async function CataloguePage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const who = await viewer();
  if (!who || !can(who.role, "catalogue.view")) redirect("/account?denied=1");
  const params = await searchParams;
  const filter = (FILTERS.find((f) => f.key === params.filter)?.key ?? "all") as FilterKey;
  const q = (params.q ?? "").trim();
  const writable = can(who.role, "catalogue.write");

  const variants = await db().productVariant.findMany({
    where: {
      ...(filter === "needs-review" ? { product: { needsPoReview: true } } : {}),
      ...(filter === "hidden" ? { OR: [{ isActive: false }, { product: { isActive: false } }] } : {}),
      ...(q ? { OR: [{ sku: { contains: q, mode: "insensitive" as const } }, { product: { name: { contains: q, mode: "insensitive" as const } } }] } : {}),
    },
    include: { product: { select: { id: true, name: true, slug: true, needsPoReview: true, isActive: true } } },
    orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }],
    take: 300,
  });
  // Low stock compares two columns, which Prisma cannot express in `where`; the page size is capped
  // above, so filtering the page in memory is cheaper than a second raw query.
  const rows = filter === "low-stock" ? variants.filter((v) => v.stockOnHand - v.stockReserved <= v.lowStockThreshold) : variants;
  const pendingReview = await db().product.count({ where: { needsPoReview: true } });

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-h1">Catalogue</h1>
        {writable && (
          <div className="flex gap-2">
            <ButtonLink href="/api/admin/catalogue/export" variant="secondary" size="sm">
              Export CSV
            </ButtonLink>
            <ButtonLink href="/admin/catalogue/import" variant="primary" size="sm">
              Import CSV
            </ButtonLink>
          </div>
        )}
      </div>

      {pendingReview > 0 && (
        <p className="mt-3 border border-line bg-warning-wash px-4 py-3 text-body text-warning-ink">
          {pendingReview} {pendingReview === 1 ? "product is" : "products are"} hidden from customers until someone reviews the copy and price.{" "}
          <Link href="/admin/catalogue?filter=needs-review" className="underline">
            Review them
          </Link>
          .
        </p>
      )}

      <form className="mt-5 flex flex-wrap items-end gap-3" action="/admin/catalogue">
        <label className="text-caption text-ink-muted">
          <span className="block">Search</span>
          <input name="q" defaultValue={q} placeholder="Name or SKU" className="mt-1 min-h-11 border border-line bg-surface px-3 text-body text-ink" />
        </label>
        <label className="text-caption text-ink-muted">
          <span className="block">Show</span>
          <select name="filter" defaultValue={filter} className="mt-1 min-h-11 border border-line bg-surface px-3 text-body text-ink">
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 border border-stainless bg-surface px-4 text-body text-ink hover:border-ink">
          Apply
        </button>
      </form>

      <p className="mt-4 text-caption text-ink-muted">
        {rows.length} {rows.length === 1 ? "variant" : "variants"}
        {rows.length === 300 ? " (showing the first 300 — narrow the search)" : ""}
      </p>

      <div className="mt-3">
        <Table caption="Product variants with price, stock and visibility">
          <THead>
            <Tr>
              <Th>Product</Th>
              <Th>SKU</Th>
              <Th>Pack</Th>
              <Th>Price (KES)</Th>
              <Th>Stock</Th>
              <Th>Visible</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((v) => (
              <Tr key={v.id}>
                <Td>
                  <Link href={`/products/${v.product.slug}`} className="text-accent underline">
                    {v.product.name}
                  </Link>
                </Td>
                <Td className="font-mono text-caption">{v.sku}</Td>
                <Td>{v.packLabel}</Td>
                <Td>{writable ? <InlineEdit id={v.id} label={`Price for ${v.sku}`} initial={(Number(v.priceMinorUnits) / 100).toFixed(2)} action={setVariantPrice} /> : (Number(v.priceMinorUnits) / 100).toFixed(2)}</Td>
                <Td>
                  {writable ? <StockEdit id={v.id} initial={v.stockOnHand} action={adjustStock} /> : v.stockOnHand}
                  <span className="mt-1 block text-caption text-ink-muted">{v.stockReserved} reserved</span>
                </Td>
                <Td>{writable ? <ReviewToggle productId={v.product.id} reviewed={!v.product.needsPoReview} action={setProductReviewed} /> : v.product.needsPoReview ? "Needs review" : "Visible"}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
