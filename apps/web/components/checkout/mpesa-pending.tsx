"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@safuney/ui";
import { retryPaymentAction } from "@/lib/checkout/actions";

interface MpesaPendingProps {
  orderNumber: string;
  accessToken: string;
  totalLabel: string;
  phone: string;
  onPayAnotherWay: () => void;
}

export function MpesaPending({ orderNumber, accessToken, totalLabel, phone, onPayAnotherWay }: MpesaPendingProps) {
  const router = useRouter();
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const [isPolling, setIsPolling] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsPolling(false);
          setErrorMessage(
            "The M-Pesa request timed out. Nothing was charged. Send it again, or choose another way to pay.",
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isPolling) return;

    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${orderNumber}/status?token=${accessToken}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;

        if (data.status === "PAID") {
          setIsPolling(false);
          setStatusMessage("Payment received. Redirecting to your order confirmation…");
          router.push(`/orders/${orderNumber}?token=${accessToken}`);
        } else if (data.status === "PAYMENT_FAILED") {
          setIsPolling(false);
          setErrorMessage("The payment was cancelled on your phone. Nothing was charged. Try again when you are ready.");
        }
      } catch {
        // Network error during poll; continue next tick
      }
    };

    const interval = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [orderNumber, accessToken, isPolling, router]);

  const handleRetry = () => {
    setErrorMessage(null);
    setSecondsRemaining(120);
    startTransition(async () => {
      const res = await retryPaymentAction(orderNumber, accessToken);
      if (res.ok) {
        setIsPolling(true);
      } else {
        setIsPolling(false);
        setErrorMessage(res.message);
      }
    });
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="border border-line bg-surface p-6 md:p-8">
      <h2 className="text-h2">Check your phone</h2>
      <p className="mt-2 text-body">
        Enter your M-Pesa PIN to pay <span className="font-semibold">{totalLabel}</span> to <span className="font-medium">Safuney Limited</span>.
      </p>
      <p className="mt-1 text-small text-ink-muted">Prompt sent to {phone}</p>

      {statusMessage ? (
        <Alert variant="success" className="mt-6">
          {statusMessage}
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert variant="error" className="mt-6">
          {errorMessage}
        </Alert>
      ) : null}

      {!errorMessage && isPolling ? (
        <div className="mt-8 flex items-center gap-3 border border-line bg-ground p-4">
          <span
            aria-hidden
            className="inline-block size-5 animate-spin rounded-full border-2 border-accent border-r-transparent motion-reduce:animate-none"
          />
          <div className="text-body font-medium text-ink">
            Waiting for PIN — <span className="font-mono">{timeFormatted}</span> remaining
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {errorMessage || !isPolling ? (
          <Button variant="primary" onClick={handleRetry} busy={isPending} busyLabel="Sending request…">
            Send the request again
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onPayAnotherWay} disabled={isPending}>
          Pay another way
        </Button>
      </div>
    </div>
  );
}
