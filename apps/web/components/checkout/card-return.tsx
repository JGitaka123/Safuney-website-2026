"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@safuney/ui";
import { MockTestControls } from "./mock-test-controls";

interface CardReturnProps {
  orderNumber: string | null;
  accessToken: string | null;
  mockMode: boolean;
}

/** Landing page after the card provider redirects back: confirm via the status endpoint, then move on (plan §4.9). */
export function CardReturn({ orderNumber, accessToken, mockMode }: CardReturnProps) {
  const router = useRouter();
  const missing = !orderNumber || !accessToken;
  const [state, setState] = useState<"checking" | "paid" | "failed" | "pending">(missing ? "failed" : "checking");
  const [message, setMessage] = useState<string | null>(missing ? "The return link is missing the order reference. Use the tracking link in your order email to see the order." : null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (missing) return;
    let active = true;
    let attempts = 0;
    const maxAttempts = 10;
    const check = async () => {
      try {
        const res = await fetch(`/api/orders/${orderNumber}/status?token=${accessToken}`, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!res.ok) throw new Error("status");
        const data = (await res.json()) as { status?: string; message?: string };
        if (!active) return;
        if (data.status === "PAID" || data.status === "CONFIRMED") {
          setState("paid");
          router.push(`/orders/${orderNumber}?token=${accessToken}`);
          return;
        }
        if (data.status === "PAYMENT_FAILED") {
          setState("failed");
          setMessage(data.message ?? "Your bank did not complete the card payment. Nothing was charged. Try another card or pay with M-Pesa.");
          return;
        }
      } catch {
        // fall through to retry
      }
      if (!active) return;
      attempts++;
      if (attempts >= maxAttempts) setState("pending");
      else setTimeout(check, 2000);
    };
    void check();
    return () => {
      active = false;
    };
  }, [orderNumber, accessToken, router, missing, tick]);

  const trackingHref = orderNumber && accessToken ? `/orders/${orderNumber}?token=${accessToken}` : "/";

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="border border-line bg-surface p-6 md:p-8" aria-live="polite">
        <h1 className="text-h2">Confirming your card payment</h1>

        {state === "checking" ? <p className="mt-6 border border-line bg-ground p-4 text-body text-ink">Checking with the card provider. This usually takes a few seconds.</p> : null}

        {state === "paid" ? (
          <Alert variant="success" className="mt-6">
            Payment received. Opening your order…
          </Alert>
        ) : null}

        {state === "failed" ? (
          <div className="mt-6">
            <Alert variant="error" title="Card payment not completed">
              {message}
            </Alert>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href={trackingHref} className="inline-flex min-h-12 items-center justify-center rounded-button bg-ink px-5 text-button text-white hover:bg-accent-deep">
                {orderNumber ? "Pay another way or try again" : "Go to the home page"}
              </Link>
            </div>
          </div>
        ) : null}

        {state === "pending" ? (
          <div className="mt-6">
            <p className="text-body text-ink">Your order is saved and we are still waiting for the card provider to confirm. You do not need to pay again.</p>
            <p className="mt-2 text-small text-ink-muted">The order page updates itself as soon as the confirmation arrives, and we email you too.</p>
            <div className="mt-6">
              <Link href={trackingHref} className="inline-flex min-h-12 items-center justify-center rounded-button bg-ink px-5 text-button text-white hover:bg-accent-deep">
                Open the order
              </Link>
            </div>
          </div>
        ) : null}

        {mockMode && orderNumber && accessToken ? <MockTestControls orderNumber={orderNumber} accessToken={accessToken} onDone={() => { setState("checking"); setTick((t) => t + 1); }} /> : null}
      </div>
    </div>
  );
}
