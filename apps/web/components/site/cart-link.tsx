"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

export const CART_COUNT_COOKIE = "sfn_cart_count";

function readCount(): number {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${CART_COUNT_COOKIE}=(\\d+)`));
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("sfn:cart", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener("sfn:cart", onChange);
    window.removeEventListener("focus", onChange);
  };
}

/**
 * Header cart link. The count comes from a plain (non-httpOnly) cookie that the cart actions maintain,
 * read after mount, so the header and every page that includes it can stay statically rendered.
 * `tone="dark"` for the blue masthead.
 */
export function CartLink({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  // Server snapshot is 0 so the static HTML never depends on the cookie; the client reads it on hydration.
  const count = useSyncExternalStore(subscribe, readCount, () => 0);
  const colours = tone === "dark" ? "text-white hover:bg-white/10" : "text-ink hover:bg-ground-deep";
  const badge = tone === "dark" ? "bg-cta text-ink" : "bg-ink text-white";
  return (
    <Link href="/cart" className={`relative inline-flex min-h-11 items-center gap-2 rounded-button px-3 text-body ${colours} ${className}`} aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}>
      <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.5L21.5 8H6.2" />
        <circle cx="10" cy="20" r="1.2" />
        <circle cx="17" cy="20" r="1.2" />
      </svg>
      <span className="hidden sm:inline">Cart</span>
      {count > 0 ? <span className={`tnum rounded-full px-2 py-0.5 text-caption font-medium ${badge}`}>{count}</span> : null}
    </Link>
  );
}

/** Call after a cart mutation so the header count updates without a reload. */
export function announceCartChange() {
  window.dispatchEvent(new Event("sfn:cart"));
}
