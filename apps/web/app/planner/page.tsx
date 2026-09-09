import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { flagEnabled } from "@/lib/flags";
import { FACILITY_TYPES } from "@/lib/planner/model";
import { PlannerForm } from "@/components/planner/planner-form";
import { estimateAction } from "@/lib/planner/actions";

export const metadata: Metadata = {
  title: "Facility hygiene planner",
  description: "Enter your facility type and size for a monthly consumption estimate, a colour-coded kit and a cleaning schedule.",
  alternates: { canonical: "/planner" },
};

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  if (!(await flagEnabled("planner.enabled"))) notFound();
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Facility hygiene planner</h1>
      <p className="mt-3 max-w-reading text-body-lg text-ink-muted">
        Tell us what you run and how big it is. We will estimate what you get through in a month, the
        colour-coded kit it needs, and a cleaning schedule you can print for the store-room wall.
      </p>
      <p className="mt-4 max-w-reading text-body text-ink">
        These are estimates, not a quotation. They assume concentrates are dosed rather than poured — which is
        the single biggest variable in what a site actually uses. Treat the figures as a starting order and
        adjust after your first month.
      </p>
      <PlannerForm facilities={FACILITY_TYPES.map((f) => ({ slug: f.slug, name: f.name, unitLabel: f.unitLabel, unitHint: f.unitHint }))} action={estimateAction} />
    </div>
  );
}
