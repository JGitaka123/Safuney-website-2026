"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@safuney/ui";
import { retryPaymentAction } from "@/lib/checkout/actions";
import { MockTestControls } from "./mock-test-controls";
import { PayAnotherWay } from "./pay-another-way";

interface MpesaPendingProps {
  orderNumber: string;
  accessToken: string;
  totalLabel: string;
  phone: string;
  /** Rendered by the server from PAYMENTS_MODE; never true in live mode. */
  mockMode?: boolean;
  cardAvailable?: boolean;
}

const PROMPT_SECONDS = 120;

/** M-Pesa waiting state (plan §4.9): calm countdown, resend, pay another way, explicit timeout and cancel copy. */
export function MpesaPending({ orderNumber, accessToken, totalLabel, phone, mockMode = false, cardAvailable = false }: MpesaPendingProps) {
  const router = useRouter();
  const [secondsRemaining, setSecondsRemaining] = useState(PROMPT_SECONDS);
  const [isPolling, setIsPolling] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isPolling) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsPolling(false);
          setErrorMessage("The M-Pesa request timed out. Nothing was charged. Send it again, or choose another way to pay.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPolling]);

  useEffect(() => {
    if (!isPolling) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${orderNumber}/status?token=${accessToken}`, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string; message?: string };
        if (!active) return;
        if (data.status === "PAID") {
          setIsPolling(false);
          setStatusMessage("Payment received. Opening your order…");
          router.push(`/orders/${orderNumber}?token=${accessToken}`);
        } else if (data.status === "PAYMENT_FAILED") {
          setIsPolling(false);
          setErrorMessage(data.message ?? "The payment was not completed. Nothing was charged. Send the request again, or choose another way to pay.");
        }
      } catch {
        // Network hiccup: try again on the next tick.
      }
    };
    void poll();
    const interval = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [orderNumber, accessToken, isPolling, router, tick]);

  const handleRetry = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await retryPaymentAction(orderNumber, accessToken);
      if (res.ok) {
        setSecondsRemaining(PROMPT_SECONDS);
        setIsPolling(true);
        setTick((t) => t + 1);
      } else {
        setIsPolling(false);
        setErrorMessage(res.message);
      }
    });
  };

  if (switching) {
    return (
      <PayAnotherWay
        orderNumber={orderNumber}
        accessToken={accessToken}
        currentMethod="MPESA"
        cardAvailable={cardAvailable}
        mpesaAvailable={false}
        onPrompt={() => {
          setSwitching(false);
          handleRetry();
        }}
        onCancel={() => setSwitching(false)}
        cancelLabel="Keep waiting for the M-Pesa prompt"
      />
    );
  }

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="border border-line bg-surface p-6 md:p-8" aria-live="polite">
      <h2 className="text-h2">Check your phone</h2>
      <p className="mt-2 text-body">
        Enter your M-Pesa PIN to pay <span className="font-semibold tabular-nums">{totalLabel}</span> to Safuney Limited.
      </p>
      <p className="mt-1 text-small text-ink-muted">
        Request sent to <span className="tabular-nums">{phone}</span> for order <span className="font-mono">{orderNumber}</span>.
      </p>

      {statusMessage ? (
        <Alert variant="success" className="mt-6">
          {statusMessage}
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert variant="error" title="Payment not completed" className="mt-6">
          {errorMessage}
        </Alert>
      ) : null}

      {!errorMessage && isPolling ? (
        <div className="mt-8 border border-line bg-ground p-4 text-body text-ink">
          Waiting for your PIN. The request expires in <span className="font-mono tabular-nums">{timeFormatted}</span>.
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {errorMessage || !isPolling ? (
          <Button variant="primary" onClick={handleRetry} busy={isPending} busyLabel="Sending request…">
            Send the request again
          </Button>
        ) : (
          <Button variant="secondary" onClick={handleRetry} busy={isPending} busyLabel="Sending request…">
            Didn&rsquo;t get it? Send it again
          </Button>
        )}
        <Button variant={errorMessage ? "secondary" : "tertiary"} onClick={() => setSwitching(true)} disabled={isPending}>
          Pay another way
        </Button>
      </div>

      {mockMode ? <MockTestControls orderNumber={orderNumber} accessToken={accessToken} onDone={() => setTick((t) => t + 1)} /> : null}
    </div>
  );
}
