"use client";

import { useEffect } from "react";

/**
 * The last resort: the root layout itself failed, so there is no header, no footer and no stylesheet
 * from the app. This file must therefore carry its own `<html>`, `<body>` and styles, and must not
 * import anything from the design system — importing the thing that may have just failed is how a
 * fallback becomes a second failure.
 *
 * Hand-written CSS, in the site's own colours, so even this page looks like Safuney.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("global error", error);
  }, [error]);

  return (
    <html lang="en-KE">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f4f7f9",
          color: "#10202b",
          font: '16px/1.5 "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <main style={{ maxWidth: "34rem" }}>
          <div style={{ height: 6, width: 72, background: "#0e50a8", marginBottom: 24 }} />
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#4a5c68" }}>Safuney</p>
          <h1 style={{ margin: "8px 0 0", fontSize: "1.75rem", lineHeight: 1.15, fontWeight: 600 }}>The site is having a problem</h1>
          <p style={{ color: "#4a5c68" }}>
            This is our fault, not yours. Nothing you were doing has been lost — an order is only placed when
            you press the button that says so.
          </p>
          <p style={{ color: "#4a5c68" }}>
            Try again in a moment, or call <a href="tel:+254796808822" style={{ color: "#0e50a8" }}>+254 796 808 822</a> and
            a person will take your order.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              minHeight: 44,
              padding: "12px 20px",
              background: "#10202b",
              color: "#ffffff",
              border: "none",
              borderRadius: 2,
              font: "inherit",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: 32, fontSize: "0.8125rem", color: "#4a5c68" }}>
              If you call us, quote this: <span style={{ fontFamily: "ui-monospace, monospace" }}>{error.digest}</span>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
