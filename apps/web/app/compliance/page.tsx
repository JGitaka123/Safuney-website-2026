import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { viewer } from "@/lib/auth/session";
import { flagEnabled } from "@/lib/flags";
import { library } from "@/lib/compliance/service";
import { setDocumentSubscriptionAction } from "@/lib/compliance/actions";
import { DocumentRow } from "@/components/compliance/document-row";

export const metadata: Metadata = {
  title: "Compliance hub",
  description: "Safety data sheets and certificates of analysis with version history, and update notifications for account customers.",
  alternates: { canonical: "/compliance" },
};

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  if (!(await flagEnabled("compliance.enabled"))) notFound();
  const who = await viewer();
  const customerId = who?.memberships[0]?.customerId ?? null;
  const documents = await library(customerId);

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Compliance hub</h1>
      <p className="mt-3 max-w-reading text-body-lg text-ink-muted">
        Safety data sheets and certificates of analysis, each with the versions that came before it.
      </p>
      <p className="mt-4 max-w-reading text-body text-ink">
        A superseded sheet in a site file looks like a record and is not one, and the person who usually
        discovers that is an auditor. Account customers can ask to be emailed whenever a sheet they rely on is
        replaced.
      </p>

      {documents.length === 0 ? (
        <div className="mt-8 max-w-reading border border-line bg-surface p-5">
          <p className="text-body text-ink">
            We have not published our safety data sheets here yet. We are not going to put up a sheet nobody has
            checked against the product in the drum.
          </p>
          <p className="mt-3 text-body">
            <Link href="/contact" className="text-accent underline">
              Ask us for the sheets you need
            </Link>{" "}
            and we will send the current versions the same working day.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {documents.map((d) => (
            <DocumentRow
              key={d.id}
              document={{
                id: d.id,
                type: d.type,
                title: d.title,
                version: d.version,
                fileUrl: d.fileUrl,
                publishedAt: d.publishedAt.toISOString().slice(0, 10),
                sizeKb: d.sizeBytes ? Math.round(d.sizeBytes / 1024) : null,
                products: d.products,
                history: d.history.map((h) => ({ id: h.id, version: h.version, publishedAt: h.publishedAt.toISOString().slice(0, 10), fileUrl: h.fileUrl })),
                subscribed: d.subscribed,
              }}
              canSubscribe={customerId !== null}
              action={setDocumentSubscriptionAction}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
