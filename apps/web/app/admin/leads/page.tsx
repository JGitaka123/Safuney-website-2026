import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@safuney/db";
import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";
import { HandledToggle } from "@/components/admin/handled-toggle";
import { markLeadHandled } from "@/lib/admin/lead-actions";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const who = await viewer();
  if (!who || !can(who.role, "leads.view")) redirect("/account?denied=1");
  const showAll = (await searchParams).show === "all";
  const leads = await db().lead.findMany({
    where: showAll ? {} : { handledAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-h1">Leads</h1>
        <a href={showAll ? "/admin/leads" : "/admin/leads?show=all"} className="text-body text-accent underline">
          {showAll ? "Show only open" : "Show all"}
        </a>
      </div>
      {leads.length === 0 ? (
        <p className="mt-4 text-body text-ink-muted">{showAll ? "No leads yet." : "Nothing waiting."}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {leads.map((l) => (
            <li key={l.id} className="border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-body font-medium text-ink">
                  {l.name}
                  {l.organisation ? <span className="font-normal text-ink-muted"> · {l.organisation}</span> : null}
                </span>
                <span className="text-caption text-ink-muted">
                  {l.kind.replace(/_/g, " ").toLowerCase()} · {l.createdAt.toISOString().slice(0, 10)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-body text-ink">{l.message}</p>
              <p className="mt-2 text-caption text-ink-muted">
                {[l.email, l.phone, l.source].filter(Boolean).join(" · ")}
              </p>
              <HandledToggle id={l.id} handled={l.handledAt !== null} action={markLeadHandled} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
