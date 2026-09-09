"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@safuney/ui";

/**
 * Something failed while rendering a page.
 *
 * Deliberately says nothing about *what* failed. An error message from the server is a gift to anyone
 * probing the site, and it means nothing to the customer standing in a kitchen trying to order bleach.
 * The digest is shown because it is the one thing that lets our own staff find the error in the logs,
 * and it identifies nothing on its own.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("page error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-page px-5 py-16 md:px-6 md:py-24">
      <div className="max-w-reading">
        <p className="text-label text-ink-muted">Something went wrong</p>
        <h1 className="mt-2 text-h1">We could not load that</h1>
        <p className="mt-4 text-body-lg text-ink-muted">
          This is our fault, not yours. Nothing you were doing has been lost — an order is only placed when
          you press the button that says so.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="secondary">
            Go to the home page
          </ButtonLink>
        </div>
        {error.digest ? (
          <p className="mt-8 text-caption text-ink-muted">
            If you call us, quote this: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
