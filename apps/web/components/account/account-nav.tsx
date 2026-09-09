import Link from "next/link";

const items = [
  { href: "/account", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/lists", label: "Saved lists" },
  { href: "/account/deliveries", label: "Scheduled deliveries" },
  { href: "/account/organisation", label: "Organisation" },
  { href: "/account/approvals", label: "Approvals" },
  { href: "/account/credit", label: "Credit and invoices" },
  { href: "/account/statement", label: "Annual statement" },
  { href: "/account/profile", label: "Profile" },
] as const;

/**
 * Account section navigation. Organisation items only make sense for members, so they are hidden
 * otherwise, and the annual statement is both organisation-only and behind a flag — the page itself
 * refuses in both cases, because a hidden link is not access control.
 */
export function AccountNav({ current, organisation, statement = false }: { current: (typeof items)[number]["href"]; organisation: boolean; statement?: boolean }) {
  return (
    <nav aria-label="Account" className="mt-6 border-b border-line">
      <ul className="-mb-px flex flex-wrap gap-x-6">
        {items
          .filter((i) => (i.href === "/account/statement" ? organisation && statement : organisation || !["/account/approvals", "/account/credit"].includes(i.href)))
          .map((i) => (
            <li key={i.href}>
              <Link href={i.href} aria-current={i.href === current ? "page" : undefined} className={`inline-flex min-h-11 items-center border-b-2 py-2 text-body ${i.href === current ? "border-ink font-medium text-ink" : "border-transparent text-ink-muted hover:border-stainless hover:text-ink"}`}>
                {i.label}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}
