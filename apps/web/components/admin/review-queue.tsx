"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@safuney/ui";
import type { AdminResult } from "@/lib/admin/action";

interface QueuedReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  product: string;
  who: string;
  verified: boolean;
  when: string;
}

export function ReviewQueue({ reviews, approve, remove }: { reviews: QueuedReview[]; approve: (id: string, approve: boolean) => Promise<AdminResult>; remove: (id: string) => Promise<AdminResult> }) {
  const [handled, setHandled] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const waiting = reviews.filter((r) => !handled[r.id]);

  if (reviews.length === 0) return <p className="mt-4 text-body text-ink-muted">Nothing waiting.</p>;

  return (
    <div className="mt-4">
      {error ? (
        <Alert variant="error" className="mb-3">
          {error}
        </Alert>
      ) : null}
      {waiting.length === 0 ? <p className="text-body text-ink-muted">Nothing left waiting.</p> : null}
      <ul className="space-y-3">
        {reviews.map((r) => (
          <li key={r.id} className="border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-body font-medium text-ink">
                {r.product} · {r.rating}/5
              </span>
              <span className="text-caption text-ink-muted">
                {r.who} · {r.when}
                {r.verified ? " · verified buyer" : ""}
              </span>
            </div>
            {r.title ? <p className="mt-2 text-body font-medium text-ink">{r.title}</p> : null}
            <p className="mt-1 whitespace-pre-line text-body text-ink">{r.body}</p>
            {handled[r.id] ? (
              <p className="mt-3 text-caption text-ink-muted">{handled[r.id]}</p>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  busy={pending}
                  busyLabel="Saving…"
                  onClick={() =>
                    start(async () => {
                      const res = await approve(r.id, true);
                      if (res.ok) setHandled((h) => ({ ...h, [r.id]: "Published." }));
                      else setError(res.message);
                    })
                  }
                >
                  Publish
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  busy={pending}
                  busyLabel="Saving…"
                  onClick={() =>
                    start(async () => {
                      const res = await remove(r.id);
                      if (res.ok) setHandled((h) => ({ ...h, [r.id]: "Removed." }));
                      else setError(res.message);
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
