import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { viewer } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/admin/permissions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Safuney admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Navigation is filtered by permission, so a warehouse hand never sees a link they cannot open. */
const NAV: Array<{ href: string; label: string; permission: Permission }> = [
  { href: "/admin", label: "Overview", permission: "dashboard.view" },
  { href: "/admin/catalogue", label: "Catalogue", permission: "catalogue.view" },
  { href: "/admin/orders", label: "Orders", permission: "orders.view" },
  { href: "/admin/customers", label: "Customers", permission: "customers.view" },
  { href: "/admin/content", label: "Content", permission: "content.write" },
  { href: "/admin/leads", label: "Leads", permission: "leads.view" },
  { href: "/admin/audit", label: "Audit log", permission: "audit.view" },
  { href: "/admin/settings", label: "Settings", permission: "content.write" },
  { href: "/admin/staff", label: "Staff", permission: "staff.write" },
  { href: "/admin/flags", label: "Features", permission: "staff.write" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const who = await viewer();
  if (!who) redirect("/sign-in?next=/admin");
  const links = NAV.filter((n) => can(who.role, n.permission));
  if (links.length === 0) redirect("/account?denied=1");
  return (
    <div className="min-h-screen bg-ground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-page px-5 py-3 md:px-6">
          <div className="flex items-baseline justify-between gap-4">
            <Link href="/admin" className="text-h3 text-ink">
              Safuney admin
            </Link>
            <span className="text-caption text-ink-muted">
              {who.name ?? who.email} · {who.role.toLowerCase()}
            </span>
          </div>
          <nav aria-label="Admin sections" className="-mx-5 mt-3 overflow-x-auto px-5 md:mx-0 md:px-0">
            <ul className="flex gap-4 whitespace-nowrap">
              {links.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="inline-block border-b-2 border-transparent py-2 text-body text-ink-muted hover:border-accent hover:text-ink">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-page px-5 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
