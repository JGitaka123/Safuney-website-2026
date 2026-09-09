"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@safuney/ui";
import { switchPaymentAction } from "@/lib/checkout/actions";

export interface PayAnotherWayProps {
  orderNumber: string;
  accessToken: string;
  /** The method the order is on now; it is not offered again. */
  currentMethod: string;
  cardAvailable: boolean;
  mpesaAvailable: boolean;
  onPrompt: () => void;
  onCancel: () => void;
  /** Label for the way back; the pending screen says what waiting means, the tracking page just goes back. */
  cancelLabel?: string;
}

/**
 * Switches an unpaid order to a different method (plan §4.9 "Pay another way"). The order and its stock
 * reservation stay as they are; only the way it is collected changes.
 */
export function PayAnotherWay({ orderNumber, accessToken, currentMethod, cardAvailable, mpesaAvailable, onPrompt, onCancel, cancelLabel = "Back" }: PayAnotherWayProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"MPESA" | "CARD" | "COD" | null>(null);

  function choose(method: "MPESA" | "CARD" | "COD") {
    setError(null);
    setBusy(method);
    start(async () => {
      const res = await switchPaymentAction(orderNumber, accessToken, method);
      if (!res.ok) {
        setError(res.message);
        setBusy(null);
        return;
      }
      if (res.next.kind === "redirect") window.location.assign(res.next.url);
      else if (res.next.kind === "prompt") onPrompt();
      else router.push(`/orders/${orderNumber}?token=${accessToken}`);
    });
  }

  const options: Array<{ method: "MPESA" | "CARD" | "COD"; label: string; helper: string; available: boolean }> = [
    { method: "MPESA" as const, label: "M-Pesa", helper: "We send a payment request to your phone.", available: mpesaAvailable },
    { method: "CARD" as const, label: "Card (Visa, Mastercard)", helper: "You pay on a secure card page.", available: cardAvailable },
    { method: "COD" as const, label: "Cash or M-Pesa on delivery", helper: "Pay the rider when the order arrives.", available: true },
  ].filter((o) => o.method !== currentMethod && o.available);

  return (
    <div className="border border-line bg-surface p-6 md:p-8">
      <h2 className="text-h3">Pay another way</h2>
      <p className="mt-2 text-small text-ink-muted">
        Order {orderNumber} is saved and its stock is held for you. Choose how to pay it.
      </p>
      {error ? (
        <Alert variant="error" title="Not switched" className="mt-4">
          {error}
        </Alert>
      ) : null}
      <ul className="mt-5 flex flex-col gap-3">
        {options.map((o) => (
          <li key={o.method}>
            <Button type="button" variant="secondary" fullWidth busy={busy === o.method && pending} busyLabel={o.method === "MPESA" ? "Sending M-Pesa request…" : o.method === "CARD" ? "Taking you to the card page…" : "Confirming order…"} disabled={pending && busy !== o.method} onClick={() => choose(o.method)}>
              <span className="flex w-full flex-col items-start text-left">
                <span>{o.label}</span>
                <span className="text-caption font-normal text-ink-muted">{o.helper}</span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="tertiary" className="mt-4" disabled={pending} onClick={onCancel}>
        {cancelLabel}
      </Button>
    </div>
  );
}
