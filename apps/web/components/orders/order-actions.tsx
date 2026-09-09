"use client";

import { useState, useTransition } from "react";
import { Button } from "@safuney/ui";
import { retryPaymentAction } from "@/lib/checkout/actions";
import { MpesaPending } from "@/components/checkout/mpesa-pending";
import { PayAnotherWay } from "@/components/checkout/pay-another-way";
import { MockTestControls } from "@/components/checkout/mock-test-controls";

interface OrderActionsProps {
  orderNumber: string;
  accessToken: string;
  status: string;
  paymentMethod: string;
  totalLabel: string;
  customerPhone?: string | null;
  mockMode?: boolean;
  cardAvailable?: boolean;
  mpesaAvailable?: boolean;
}

/** Actions on the tracking page: retry an unpaid order, switch method, print. */
export function OrderActions({ orderNumber, accessToken, status, paymentMethod, totalLabel, customerPhone, mockMode = false, cardAvailable = false, mpesaAvailable = false }: OrderActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<"actions" | "prompt" | "switch">("actions");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const unpaid = status === "PENDING_PAYMENT" || status === "PAYMENT_FAILED";

  const handleRetryPayment = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await retryPaymentAction(orderNumber, accessToken);
      if (res.ok) {
        if (res.next.kind === "prompt") setView("prompt");
        else if (res.next.kind === "redirect") window.location.assign(res.next.url);
      } else {
        setErrorMessage(res.message);
      }
    });
  };

  if (view === "prompt") {
    return (
      <div className="mt-6 w-full">
        <MpesaPending orderNumber={orderNumber} accessToken={accessToken} totalLabel={totalLabel} phone={customerPhone ?? ""} mockMode={mockMode} cardAvailable={cardAvailable} />
      </div>
    );
  }

  if (view === "switch") {
    return (
      <div className="mt-6 w-full">
        <PayAnotherWay orderNumber={orderNumber} accessToken={accessToken} currentMethod={paymentMethod} cardAvailable={cardAvailable} mpesaAvailable={mpesaAvailable} onPrompt={() => setView("prompt")} onCancel={() => setView("actions")} />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        {unpaid && (paymentMethod === "MPESA" || paymentMethod === "CARD") ? (
          <Button variant="primary" onClick={handleRetryPayment} busy={isPending} busyLabel={paymentMethod === "MPESA" ? "Sending M-Pesa request…" : "Taking you to the card page…"}>
            {paymentMethod === "MPESA" ? `Pay ${totalLabel} with M-Pesa` : `Pay ${totalLabel} by card`}
          </Button>
        ) : null}
        {unpaid ? (
          <Button variant="secondary" onClick={() => setView("switch")} disabled={isPending}>
            Pay another way
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => window.print()}>
          Print this order
        </Button>
      </div>
      {errorMessage ? (
        <p role="alert" className="text-small text-ink">
          {errorMessage}
        </p>
      ) : null}
      {mockMode && unpaid && (paymentMethod === "MPESA" || paymentMethod === "CARD") ? <MockTestControls orderNumber={orderNumber} accessToken={accessToken} onDone={() => window.location.reload()} /> : null}
    </div>
  );
}
