"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@safuney/ui";

interface ReturnPageProps {
  searchParams: Promise<{ order?: string; token?: string }>;
}

export default function CheckoutReturnPage({ searchParams }: ReturnPageProps) {
  const router = useRouter();
  const { order: orderNumber, token } = use(searchParams);

  const isMissingParams = !orderNumber || !token;
  const [state, setState] = useState<"checking" | "paid" | "failed" | "pending">(
    isMissingParams ? "failed" : "checking",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    isMissingParams ? "Missing order details in return URL. Please check your email for the order link." : null,
  );

  useEffect(() => {
    if (isMissingParams) {
      return;
    }

    let active = true;
    let attempts = 0;
    const maxAttempts = 10;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${orderNumber}/status?token=${token}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("Could not fetch status");
        const data = await res.json();
        if (!active) return;

        if (data.status === "PAID" || data.status === "CONFIRMED") {
          setState("paid");
          router.push(`/orders/${orderNumber}?token=${token}`);
        } else if (data.status === "PAYMENT_FAILED") {
          setState("failed");
          setErrorMessage("Your card payment was not completed by the bank. Nothing was charged.");
        } else {
          attempts++;
          if (attempts >= maxAttempts) {
            setState("pending");
          } else {
            setTimeout(checkStatus, 2000);
          }
        }
      } catch {
        if (!active) return;
        attempts++;
        if (attempts >= maxAttempts) {
          setState("pending");
        } else {
          setTimeout(checkStatus, 2000);
        }
      }
    };

    void checkStatus();

    return () => {
      active = false;
    };
  }, [orderNumber, token, router, isMissingParams]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="border border-line bg-surface p-6 md:p-8">
        <h1 className="text-h2 font-semibold text-ink">Verifying payment</h1>

        {state === "checking" && (
          <div className="mt-6 flex items-center gap-3 border border-line bg-ground p-4">
            <span
              aria-hidden
              className="inline-block size-5 animate-spin rounded-full border-2 border-accent border-r-transparent motion-reduce:animate-none"
            />
            <p className="text-body font-medium text-ink">Confirming transaction with card provider…</p>
          </div>
        )}

        {state === "paid" && (
          <Alert variant="success" className="mt-6">
            Payment confirmed! Redirecting to your order summary…
          </Alert>
        )}

        {state === "failed" && (
          <div className="mt-6">
            <Alert variant="error" title="Card transaction unsuccessful">
              {errorMessage || "The transaction could not be verified."}
            </Alert>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/checkout"
                className="inline-flex min-h-12 items-center justify-center rounded-button bg-ink px-5 text-button text-white hover:bg-accent-deep"
              >
                Return to checkout
              </Link>
              {orderNumber && token && (
                <Link
                  href={`/orders/${orderNumber}?token=${token}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-button border border-stainless bg-surface px-5 text-button text-ink hover:bg-ground-deep"
                >
                  View order details
                </Link>
              )}
            </div>
          </div>
        )}

        {state === "pending" && (
          <div className="mt-6">
            <p className="text-body text-ink">
              Your order has been recorded. We are awaiting the final confirmation webhook from your card provider.
            </p>
            <p className="mt-2 text-small text-ink-muted">
              You can check the live status of your order anytime using your unique tracking link.
            </p>
            <div className="mt-6">
              <Link
                href={`/orders/${orderNumber}?token=${token}`}
                className="inline-flex min-h-12 items-center justify-center rounded-button bg-ink px-5 text-button text-white hover:bg-accent-deep"
              >
                Go to order tracking
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
