"use client";

import { useRef, type ReactNode } from "react";

/**
 * A horizontal product carousel with previous/next buttons (Alliance Chemical's "reorder most" row).
 * The list is an ordinary scrollable list of server-rendered cards, so it works without JavaScript and
 * with a keyboard (Tab moves through the cards and the browser scrolls them in); the buttons are an
 * extra for a mouse. Children must be <li> elements.
 */
export function ProductRail({ label, children }: { label: string; children: ReactNode }) {
  const list = useRef<HTMLUListElement>(null);
  const step = (direction: 1 | -1) => {
    const el = list.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  };
  return (
    <div className="relative">
      <ul ref={list} aria-label={label} className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-3 [scrollbar-width:thin]">
        {children}
      </ul>
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Previous products"
        className="absolute -left-5 top-[38%] hidden size-11 place-items-center rounded-full border border-line bg-surface text-ink shadow-float hover:text-accent md:grid"
      >
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="Next products"
        className="absolute -right-5 top-[38%] hidden size-11 place-items-center rounded-full border border-line bg-surface text-ink shadow-float hover:text-accent md:grid"
      >
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
