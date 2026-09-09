"use client";

import { useState, useTransition } from "react";
import { Button } from "@safuney/ui";
import { retryPaymentAction } from "@/lib/checkout/actions";
import { MpesaPending } from "@/components/checkout/mpesa-pending";

interface OrderActionsProps {
  orderNumber: string;
  accessToken: string;
  status: string;
  paymentMethod: string;
  totalLabel: string;
  customerPhone?: string | null;
}

export function OrderActions({
  orderNumber,
  accessToken,
  status,
  paymentMethod,
  totalLabel,
  customerPhone,
}: OrderActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [showPrompt, setShowPrompt] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canRetry = (status === "PENDING_PAYMENT" || status === "PAYMENT_FAILED") && paymentMethod === "MPESA";

  const handlePrint = () => {
    window.print();
  };

  const handleRetryPayment = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await retryPaymentAction(orderNumber, accessToken);
      if (res.ok) {
        if (res.next.kind === "prompt") {
          setShowPrompt(true);
        } else if (res.next.kind === "redirect") {
          window.location.href = res.next.url;
        }
      } else {
        setErrorMessage(res.message);
      }
    });
  };

  if (showPrompt) {
    return (
      <div className="mt-6">
        <MpesaPending
          orderNumber={orderNumber}
          accessToken={accessToken}
          totalLabel={totalLabel}
          phone={customerPhone ?? ""}
          onPayAnotherWay={() => setShowPrompt(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <Button variant="secondary" onClick={handlePrint}>
        Print order invoice
      </Button>

      {canRetry ? (
        <Button variant="primary" onClick={handleRetryPayment} busy={isPending} busyLabel="Sending M-Pesa prompt…">
          Pay with M-Pesa
        </Button>
      ) : null}

      {errorMessage ? <p className="w-full text-small text-ink">{errorMessage}</p> : null}
    </div>
  );
}
