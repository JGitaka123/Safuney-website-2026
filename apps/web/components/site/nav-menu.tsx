"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@safuney/ui";

export interface NavMenuItem {
  href: string;
  label: string;
  note?: string;
}

/**
 * A header menu with a "+" disclosure, as on Alliance Chemical's nav. Opens on hover for a mouse and on
 * press for keyboard and touch; closes on Escape, on a press outside, or when focus leaves it. The
 * panel is a plain list of links, so it needs no menu roles — it is a disclosure, not an application
 * menu.
 */
export function NavMenu({ label, items, columns = 1, footer }: { label: string; items: readonly NavMenuItem[]; columns?: 1 | 2; footer?: NavMenuItem }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        root.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-14 items-center gap-1.5 text-body font-medium text-ink hover:text-accent"
      >
        {label}
        <span aria-hidden className={cn("text-h4 leading-none text-accent transition-transform duration-150", open && "rotate-45")}>
          +
        </span>
      </button>
      <div id={panelId} hidden={!open} className="absolute left-0 top-full z-40 -mt-1 pt-1">
        <div className={cn("rounded-card border border-line bg-surface p-2 shadow-float", columns === 2 ? "grid w-[36rem] grid-cols-2 gap-0.5" : "w-72")}>
          {items.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-chip px-3 py-2.5 hover:bg-accent-wash focus-visible:bg-accent-wash">
              <span className="block text-small font-medium text-ink">{item.label}</span>
              {item.note ? <span className="mt-0.5 block text-caption text-ink-muted">{item.note}</span> : null}
            </Link>
          ))}
          {footer ? (
            <Link href={footer.href} onClick={() => setOpen(false)} className="col-span-full mt-1 block border-t border-line px-3 pb-1.5 pt-3 text-small font-medium text-accent hover:underline">
              {footer.label} →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
