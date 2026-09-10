import Link from "next/link";

/** Breadcrumb trail for the dark page headers. The last item is the current page. */
export function Crumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-small text-white/70">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-white hover:underline underline-offset-[3px]">
            Home
          </Link>
        </li>
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span aria-hidden>/</span>
            {item.href ? (
              <Link href={item.href} className="hover:text-white hover:underline underline-offset-[3px]">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-white">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
