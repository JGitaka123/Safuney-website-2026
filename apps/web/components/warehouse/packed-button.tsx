"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@safuney/ui";
import type { ActionResult } from "@/lib/b2b/actions";

export function PackedButton({ orderId, action }: { orderId: string; action: (orderId: string) => Promise<ActionResult> }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <div className="border border-line bg-surface p-5">
      <p className="text-body text-ink">Everything on the pick list is in the box?</p>
      {result ? (
        <Alert variant={result.ok ? "success" : "error"} className="mt-3">
          {result.message}
        </Alert>
      ) : null}
      <Button className="mt-4" variant="primary" busy={pending} busyLabel="Saving…" onClick={() => start(async () => setResult(await action(orderId)))}>
        Mark packed
      </Button>
    </div>
  );
}
