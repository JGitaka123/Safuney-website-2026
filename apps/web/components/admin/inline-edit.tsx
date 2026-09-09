"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@safuney/ui";
import type { AdminResult } from "@/lib/admin/action";

/**
 * A single value edited in place on a long table row. The catalogue has hundreds of variants and the
 * PO fixes prices and counts one at a time, so a full form page per field would be the slow path.
 */
export function InlineEdit({ id, label, initial, suffix, action }: { id: string; label: string; initial: string; suffix?: string; action: (id: string, value: string) => Promise<AdminResult> }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminResult | null>(null);
  const dirty = value !== saved;
  return (
    <form
      className="flex items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await action(id, value);
          setResult(r);
          if (r.ok) setSaved(value);
        });
      }}
    >
      <div>
        <Input label={label} fieldClassName="gap-1" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className="w-28 tabular-nums" />
        {result && !result.ok ? (
          <p role="alert" className="mt-1 text-caption text-ink">
            {result.message}
          </p>
        ) : null}
        {result?.ok && !dirty ? <p className="mt-1 text-caption text-ink-muted">Saved</p> : null}
      </div>
      {suffix ? <span className="pt-2 text-caption text-ink-muted">{suffix}</span> : null}
      <Button type="submit" variant="secondary" size="sm" busy={pending} busyLabel="Saving…" disabled={!dirty}>
        Save
      </Button>
    </form>
  );
}

/** Two-value edit: a counted quantity plus why it changed, which the movement record keeps. */
export function StockEdit({ id, initial, action }: { id: string; initial: number; action: (id: string, counted: string, reason: string) => Promise<AdminResult> }) {
  const [counted, setCounted] = useState(String(initial));
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(String(initial));
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminResult | null>(null);
  const dirty = counted !== saved;
  return (
    <form
      className="flex flex-wrap items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await action(id, counted, reason);
          setResult(r);
          if (r.ok) { setSaved(counted); setReason(""); }
        });
      }}
    >
      <div>
        <Input label="Counted quantity" fieldClassName="gap-1" value={counted} onChange={(e) => setCounted(e.target.value)} inputMode="numeric" className="w-20 tabular-nums" />
        {result && !result.ok ? (
          <p role="alert" className="mt-1 text-caption text-ink">
            {result.message}
          </p>
        ) : null}
      </div>
      <Input label="Why the count changed" fieldClassName="gap-1" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-36" />
      <Button type="submit" variant="secondary" size="sm" busy={pending} busyLabel="Saving…" disabled={!dirty}>
        Save
      </Button>
    </form>
  );
}
