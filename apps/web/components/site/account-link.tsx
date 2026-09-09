"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const COOKIE = "sfn_signed_in";

function read(): boolean {
  try {
    return new RegExp(`(?:^|; )${COOKIE}=1`).test(document.cookie);
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("focus", onChange);
  return () => window.removeEventListener("focus", onChange);
}

/** "Sign in" or "Account" from a plain cookie set at sign-in, so the header stays static. */
export function AccountLink({ className = "" }: { className?: string }) {
  const signedIn = useSyncExternalStore(subscribe, read, () => false);
  return (
    <Link href={signedIn ? "/account" : "/sign-in"} className={`inline-flex min-h-11 items-center gap-2 rounded-button px-3 text-body text-ink hover:bg-ground-deep ${className}`}>
      <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
      <span className="hidden sm:inline">{signedIn ? "Account" : "Sign in"}</span>
      <span className="sr-only sm:hidden">{signedIn ? "Account" : "Sign in"}</span>
    </Link>
  );
}
