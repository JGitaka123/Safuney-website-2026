import Link from "next/link";
import type { UserRole } from "@safuney/db";
import { desksFor } from "@/lib/auth/desks";

/** Links to the desks this staff member can open; renders nothing for customers. */
export function StaffDesks({ role, current, className = "" }: { role: UserRole; current?: string; className?: string }) {
  const desks = desksFor(role);
  if (desks.length === 0) return null;
  return (
    <nav aria-label="Staff desks" className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-small ${className}`}>
      <span className="text-ink-muted">Staff desks:</span>
      {desks.map((d) => (
        <Link key={d.href} href={d.href} aria-current={d.href === current ? "page" : undefined} className={d.href === current ? "font-medium text-ink" : "text-accent underline-offset-[3px] hover:underline"}>
          {d.label}
        </Link>
      ))}
    </nav>
  );
}
