"use client";

import { useState, useTransition } from "react";
import { Button } from "@safuney/ui";
import type { AdminResult } from "@/lib/admin/action";

export function FlagToggle({ flag, enabled, action }: { flag: string; enabled: boolean; action: (key: string, enabled: boolean) => Promise<AdminResult> }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button
        variant={on ? "secondary" : "primary"}
        size="sm"
        busy={pending}
        busyLabel="Saving…"
        onClick={() =>
          start(async () => {
            const r = await action(flag, !on);
            if (r.ok) { setOn(!on); setError(null); } else setError(r.message);
          })
        }
      >
        {on ? "On — switch off" : "Off — switch on"}
      </Button>
      <span className="text-caption text-ink-muted">{on ? "Live for every customer" : "Not visible to customers"}</span>
      {error ? (
        <p role="alert" className="text-caption text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
