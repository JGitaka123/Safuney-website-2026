"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert, Button, HazardBadge, Input, Textarea, type HazardClass } from "@safuney/ui";
import type { AdvisorResult } from "@/lib/advisor/service";

const EXAMPLES = [
  "Greasy extractor hood in a commercial kitchen, cleaned weekly by two staff.",
  "Hospital isolation ward floors, need something for daily disinfection.",
  "Hotel washrooms — limescale on taps and a smell we cannot shift.",
];

export function AdvisorForm({ action }: { action: (question: string, contact: { name?: string; email?: string; phone?: string }) => Promise<AdvisorResult> }) {
  const [question, setQuestion] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-8">
      <form
        className="max-w-reading space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setResult(await action(question, { email })));
        }}
      >
        <Textarea
          label="What are you cleaning?"
          id="advisor-question"
          rows={4}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          helper="The surface, the soil and the setting. The more specific, the better the answer."
          maxLength={600}
        />
        <Input
          label="Email"
          id="advisor-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          optional
          helper="Only used if we cannot answer here and a person needs to come back to you."
        />
        <Button type="submit" variant="primary" busy={pending} busyLabel="Looking…" disabled={question.trim().length < 10}>
          Ask
        </Button>
      </form>

      {!result && !pending ? (
        <div className="mt-8 max-w-reading">
          <p className="text-label text-ink-muted">For example</p>
          <ul className="mt-2 space-y-2">
            {EXAMPLES.map((e) => (
              <li key={e}>
                <button type="button" className="text-left text-body text-accent underline" onClick={() => setQuestion(e)}>
                  {e}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result?.kind === "unavailable" || result?.kind === "none" ? (
        <Alert variant={result.kind === "none" ? "warning" : "error"} className="mt-6 max-w-reading">
          {result.message}
        </Alert>
      ) : null}

      {result?.kind === "ok" ? (
        <div className="mt-8">
          <h2 className="text-h3">What we would use</h2>
          {result.note ? (
            <p className="mt-2 max-w-reading border-l-2 border-accent pl-3 text-body text-ink">{result.note}</p>
          ) : null}
          <ul className="mt-5 space-y-5">
            {result.recommendations.map((r) => (
              <li key={r.slug} className="border border-line bg-surface p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-h4">
                    <Link href={r.href} className="text-accent underline">
                      {r.name}
                    </Link>
                  </h3>
                  {r.hazardClass !== "NONE" ? <HazardBadge hazard={r.hazardClass as HazardClass} /> : null}
                </div>
                <p className="mt-3 text-body text-ink">{r.why}</p>
                <dl className="mt-4 space-y-1 text-caption text-ink-muted">
                  {r.zoneLabel ? (
                    <div>
                      <dt className="inline font-medium">Zone: </dt>
                      <dd className="inline">{r.zoneLabel}</dd>
                    </div>
                  ) : null}
                  {r.packLabels.length > 0 ? (
                    <div>
                      <dt className="inline font-medium">Packs: </dt>
                      <dd className="inline">{r.packLabels.join(", ")}</dd>
                    </div>
                  ) : null}
                  {r.dilution ? (
                    <div>
                      <dt className="inline font-medium">Dilution: </dt>
                      <dd className="inline">{r.dilution}</dd>
                    </div>
                  ) : null}
                </dl>
                {r.sdsHref ? (
                  <p className="mt-3 text-caption">
                    <a href={r.sdsHref} className="text-accent underline" target="_blank" rel="noopener noreferrer">
                      Safety data sheet
                    </a>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-reading text-caption text-ink-muted">
            Prices are on each product page. If none of these is right, tell us — the answer is only as good as
            what we stock, and knowing what we are missing is useful to us.
          </p>
        </div>
      ) : null}
    </div>
  );
}
