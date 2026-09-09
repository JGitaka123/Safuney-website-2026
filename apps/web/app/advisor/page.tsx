import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { flagEnabled } from "@/lib/flags";
import { advisorConfigured } from "@/lib/advisor/service";
import { askAdvisorAction } from "@/lib/advisor/actions";
import { AdvisorForm } from "@/components/advisor/advisor-form";

export const metadata: Metadata = {
  title: "What should I use?",
  description: "Describe a cleaning problem and we will tell you which of our products fits, at what dilution.",
  alternates: { canonical: "/advisor" },
};

export const dynamic = "force-dynamic";

export default async function AdvisorPage() {
  // A flag that is off means unreachable, not merely unlinked.
  if (!(await flagEnabled("advisor.enabled"))) notFound();
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">What should I use?</h1>
      <p className="mt-3 max-w-reading text-body-lg text-ink-muted">
        Describe what you are cleaning — the surface, the soil, how often — and we will tell you which of our
        products fits and at what dilution.
      </p>
      <p className="mt-4 max-w-reading text-body text-ink">
        It only ever recommends products we actually stock. If nothing we sell is right for the job, it says so
        and passes the question to our team rather than guessing.
      </p>
      {!advisorConfigured() ? (
        <p className="mt-6 max-w-reading border border-line bg-warning-wash px-4 py-3 text-body text-warning-ink">
          The advisor is switched on but not yet connected. Your description will still reach our team.
        </p>
      ) : null}
      <AdvisorForm action={askAdvisorAction} />
    </div>
  );
}
