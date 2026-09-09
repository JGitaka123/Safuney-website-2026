"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Textarea } from "@safuney/ui";
import { approveOrderAction, rejectOrderAction } from "@/lib/b2b/actions";

export interface ApprovalOrder {
  id: string;
  number: string;
  placedBy: string;
  placedAt: string;
  totalLabel: string;
  paymentMethod: string;
  poNumber: string | null;
  lines: Array<{ name: string; packLabel: string; qty: number; lineLabel: string }>;
  trackingHref: string;
}

const METHOD: Record<string, string> = { MPESA: "M-Pesa", CARD: "Card", COD: "Cash on delivery", INVOICE: "Invoice" };

export function ApprovalCard({ order }: { order: ApprovalOrder }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const decided = result?.ok === true;

  return (
    <article aria-labelledby={`approval-${order.id}`} className="border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 id={`approval-${order.id}`} className="font-mono text-body font-semibold text-ink">
          {order.number}
        </h3>
        <p className="text-body font-semibold tabular-nums text-ink">{order.totalLabel}</p>
      </div>
      <p className="mt-1 text-small text-ink-muted">
        Placed by {order.placedBy} on <span className="tabular-nums">{order.placedAt}</span> · {METHOD[order.paymentMethod] ?? order.paymentMethod}
        {order.poNumber ? ` · PO ${order.poNumber}` : ""}
      </p>
      <ul className="mt-3 divide-y divide-line border-y border-line text-small">
        {order.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-4 py-2">
            <span className="min-w-0 text-ink">
              {l.name} <span className="text-ink-muted">{l.packLabel} × {l.qty}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ink">{l.lineLabel}</span>
          </li>
        ))}
      </ul>
      {result ? (
        <Alert variant={result.ok ? "success" : "error"} className="mt-4">
          {result.message}
        </Alert>
      ) : null}
      {!decided ? (
        <div className="mt-4 flex flex-col gap-3">
          {rejecting ? (
            <Textarea label="Reason for the buyer" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required />
          ) : null}
          <div className="flex flex-wrap gap-3">
            {!rejecting ? (
              <Button variant="primary" busy={pending} busyLabel="Approving…" onClick={() => start(async () => setResult(await approveOrderAction(order.id)))}>
                Approve
              </Button>
            ) : (
              <Button variant="primary" busy={pending} busyLabel="Sending…" onClick={() => start(async () => setResult(await rejectOrderAction(order.id, reason)))}>
                Send the decision
              </Button>
            )}
            <Button variant="secondary" disabled={pending} onClick={() => setRejecting((r) => !r)}>
              {rejecting ? "Back" : "Do not approve"}
            </Button>
            <a href={order.trackingHref} className="inline-flex min-h-11 items-center px-2 text-body text-accent underline underline-offset-[3px]">
              Open the order
            </a>
          </div>
        </div>
      ) : null}
    </article>
  );
}
