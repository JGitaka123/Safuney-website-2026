"use client";

import { useState, useTransition } from "react";
import { Button } from "@safuney/ui";
import { setScheduleStatusAction, skipNextDeliveryAction } from "@/lib/b2b/subscription-actions";

export interface ScheduleView {
  id: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  intervalLabel: string;
  nextRunLabel: string;
  paymentMethod: string;
  destination: string;
  items: string[];
  runs: Array<{ id: string; status: string; when: string; orderNumber: string | null; href: string | null; error: string | null }>;
}

const METHOD: Record<string, string> = { MPESA: "M-Pesa on the day", CARD: "Card on the day", COD: "Cash or M-Pesa on delivery", INVOICE: "Invoice" };

export function ScheduleCard({ schedule }: { schedule: ScheduleView }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => setMessage((await fn()).message ?? null));
  return (
    <article className="border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-h4">{schedule.intervalLabel}</h3>
        <p className="text-small text-ink-muted">{schedule.status === "ACTIVE" ? `Next: ${schedule.nextRunLabel}` : schedule.status === "PAUSED" ? "Paused" : "Cancelled"}</p>
      </div>
      <ul className="mt-2 text-small text-ink">
        {schedule.items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <p className="mt-2 text-small text-ink-muted">
        {schedule.destination} · {METHOD[schedule.paymentMethod] ?? schedule.paymentMethod}
      </p>
      {schedule.runs.length > 0 ? (
        <ul className="mt-3 border-t border-line pt-3 text-small">
          {schedule.runs.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-x-4">
              <span className="tabular-nums text-ink-muted">{r.when}</span>
              {r.href ? (
                <a href={r.href} className="font-mono text-accent underline underline-offset-[3px]">
                  {r.orderNumber}
                </a>
              ) : (
                <span className="text-ink">{r.error ?? r.status.toLowerCase()}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-small text-ink">
          {message}
        </p>
      ) : null}
      {schedule.status !== "CANCELLED" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {schedule.status === "ACTIVE" ? (
            <>
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => skipNextDeliveryAction(schedule.id))}>
                Skip the next one
              </Button>
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setScheduleStatusAction(schedule.id, "PAUSED"))}>
                Pause
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setScheduleStatusAction(schedule.id, "ACTIVE"))}>
              Resume
            </Button>
          )}
          <Button variant="tertiary" size="sm" disabled={pending} onClick={() => run(() => setScheduleStatusAction(schedule.id, "CANCELLED"))}>
            Cancel schedule
          </Button>
        </div>
      ) : null}
    </article>
  );
}
