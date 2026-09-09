"use client";

import { useState, useTransition } from "react";
import { Button } from "@safuney/ui";

export interface MockTestControlsProps {
  orderNumber: string;
  accessToken: string;
  /** Called once the simulated callback has been accepted so the page can poll straight away. */
  onDone?: () => void;
}

/**
 * Mock payments only (PAYMENTS_MODE=mock on previews and in CI): feeds a signed provider callback in
 * through the test endpoint so a payment can finish without a phone or a card. The server decides whether
 * to render this; it never appears in live mode.
 */
export function MockTestControls({ orderNumber, accessToken, onDone }: MockTestControlsProps) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function simulate(status: "SUCCEEDED" | "CANCELLED") {
    setResult(null);
    start(async () => {
      try {
        const res = await fetch("/api/payments/mock/callback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderNumber, accessToken, status }),
        });
        const body = (await res.json().catch(() => null)) as { outcome?: string; detail?: string; error?: string } | null;
        setResult(res.ok ? `Callback ${body?.outcome?.toLowerCase() ?? "sent"}${body?.detail ? ` (${body.detail})` : ""}.` : `The test endpoint answered ${res.status}${body?.error ? `: ${body.error}` : ""}.`);
        onDone?.();
      } catch {
        setResult("The test endpoint could not be reached.");
      }
    });
  }

  return (
    <section aria-labelledby="test-controls-heading" className="mt-8 border border-dashed border-stainless bg-ground-deep p-4">
      <h2 id="test-controls-heading" className="text-label text-ink-muted">
        Test controls
      </h2>
      <p className="mt-1 text-small text-ink-muted">Mock payments mode. These buttons stand in for the provider callback and never appear in live mode.</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="secondary" size="sm" busy={pending} busyLabel="Sending callback…" onClick={() => simulate("SUCCEEDED")}>
          Simulate payment success
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => simulate("CANCELLED")}>
          Simulate cancellation
        </Button>
      </div>
      {result ? (
        <p role="status" className="mt-3 font-mono text-mono text-ink-muted">
          {result}
        </p>
      ) : null}
    </section>
  );
}
