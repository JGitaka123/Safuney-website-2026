"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@safuney/ui";
import { reorderAction, saveOrderAsListAction } from "@/lib/b2b/list-actions";

/** One-click reorder and "save as list" for an order in the account history. */
export function ReorderButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failures, setFailures] = useState<Array<{ name: string; message: string }>>([]);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          busy={pending}
          busyLabel="Adding…"
          onClick={() =>
            start(async () => {
              const r = await reorderAction(orderId);
              setMessage(r.message ?? null);
              setFailures(r.ok ? (r.failures ?? []) : []);
              if (r.ok) {
                window.dispatchEvent(new Event("sfn:cart"));
                if ((r.failures ?? []).length === 0) router.push("/cart");
              }
            })
          }
        >
          Reorder
        </Button>
        <Button
          variant="tertiary"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveOrderAsListAction(orderId, `Order ${orderNumber}`);
              setMessage(r.message ?? null);
              if (r.ok && r.listId) router.push(`/account/lists/${r.listId}`);
            })
          }
        >
          Save as list
        </Button>
      </div>
      {message ? (
        <p role="status" className="text-small text-ink-muted">
          {message}
        </p>
      ) : null}
      {failures.length > 0 ? (
        <ul className="text-small text-ink">
          {failures.map((f) => (
            <li key={f.name}>
              {f.name}: {f.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
