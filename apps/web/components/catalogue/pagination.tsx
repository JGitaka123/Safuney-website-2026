import Link from "next/link";
import { cn } from "@safuney/ui";

export function Pagination({ base, query, page, pageCount }: { base: string; query: Record<string, string>; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams(query);
    if (p <= 1) sp.delete("page");
    else sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1);
  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className="inline-flex min-h-11 items-center rounded-button border border-stainless bg-surface px-4 text-button">
          Previous
        </Link>
      ) : null}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && pages[i - 1] !== p - 1 ? <span aria-hidden>…</span> : null}
          <Link
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn("tnum inline-flex min-h-11 min-w-11 items-center justify-center rounded-button border px-3 text-button", p === page ? "border-ink bg-ink text-white" : "border-stainless bg-surface")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className="inline-flex min-h-11 items-center rounded-button border border-stainless bg-surface px-4 text-button">
          Next
        </Link>
      ) : null}
    </nav>
  );
}
