import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@safuney/db";
import { requireRole } from "@/lib/auth/session";
import { flagEnabled } from "@/lib/flags";
import { VisitForm } from "@/components/reps/visit-form";
import { recordVisitAction } from "@/lib/reps/actions";

export const metadata: Metadata = { title: "Rep visits", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RepsPage() {
  if (!(await flagEnabled("reps.enabled"))) notFound();
  const who = await requireRole(["SALES", "ADMIN"], "/reps");

  const [customers, visits] = await Promise.all([
    db().customer.findMany({ where: { type: "ORGANISATION" }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" }, take: 300 }),
    db().repVisit.findMany({
      where: { repId: who.id },
      select: { id: true, note: true, outcome: true, visitedAt: true, latitude: true, longitude: true, customer: { select: { displayName: true } } },
      orderBy: { visitedAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Visits</h1>
      <p className="mt-2 max-w-reading text-body text-ink-muted">
        Record what happened while you are still outside. Adding your location is optional and only happens when
        you tap for it.
      </p>

      <VisitForm customers={customers} action={recordVisitAction} />

      <h2 className="mt-10 text-h3">Your last visits</h2>
      {visits.length === 0 ? (
        <p className="mt-3 text-body text-ink-muted">Nothing recorded yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visits.map((v) => (
            <li key={v.id} className="border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-body font-medium text-ink">{v.customer.displayName}</span>
                <span className="text-caption text-ink-muted">{v.visitedAt.toISOString().replace("T", " ").slice(0, 16)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-body text-ink">{v.note}</p>
              {v.outcome ? <p className="mt-1 text-caption text-ink-muted">Outcome: {v.outcome}</p> : null}
              {v.latitude !== null && v.longitude !== null ? (
                <p className="mt-1 text-caption text-ink-muted">
                  Location recorded ({v.latitude.toFixed(4)}, {v.longitude.toFixed(4)})
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-body">
        <Link href="/sales/quotes" className="text-accent underline">
          Price a quote for one of these customers
        </Link>
      </p>
    </div>
  );
}
