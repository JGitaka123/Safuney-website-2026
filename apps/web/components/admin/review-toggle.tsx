"use client";

import { useState, useTransition } from "react";
import { Button } from "@safuney/ui";
import type { AdminResult } from "@/lib/admin/action";

/** The launch gate: nothing the PO has not reviewed is visible to customers. */
export function ReviewToggle({ productId, reviewed, action }: { productId: string; reviewed: boolean; action: (id: string, reviewed: boolean) => Promise<AdminResult> }) {
  const [on, setOn] = useState(reviewed);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant={on ? "secondary" : "primary"}
        size="sm"
        busy={pending}
        busyLabel="Saving…"
        onClick={() =>
          start(async () => {
            const r = await action(productId, !on);
            if (r.ok) { setOn(!on); setError(null); } else setError(r.message);
          })
        }
      >
        {on ? "Visible — hide" : "Needs review — publish"}
      </Button>
      {error ? (
        <p role="alert" className="mt-1 text-caption text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
