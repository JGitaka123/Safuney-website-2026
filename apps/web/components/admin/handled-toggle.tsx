"use client";

import { useState, useTransition } from "react";
import { Button } from "@safuney/ui";
import type { AdminResult } from "@/lib/admin/action";

export function HandledToggle({ id, handled, action }: { id: string; handled: boolean; action: (id: string, handled: boolean) => Promise<AdminResult> }) {
  const [on, setOn] = useState(handled);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-3">
      <Button
        variant="secondary"
        size="sm"
        busy={pending}
        busyLabel="Saving…"
        onClick={() =>
          start(async () => {
            const r = await action(id, !on);
            if (r.ok) { setOn(!on); setError(null); } else setError(r.message);
          })
        }
      >
        {on ? "Handled — reopen" : "Mark handled"}
      </Button>
      {error ? (
        <p role="alert" className="mt-1 text-caption text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
