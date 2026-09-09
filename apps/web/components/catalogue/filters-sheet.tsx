"use client";

import { useState, type ReactNode } from "react";
import { Sheet } from "@safuney/ui";

/** Mobile: the same facet links inside a bottom sheet (plan §4.5). */
export function FiltersSheet({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Filter products"
      description="Narrow the list by zone, brand, application, pack size, availability and price"
      side="bottom"
      trigger={
        <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-button border border-stainless bg-surface px-4 text-button text-ink hover:bg-ground-deep lg:hidden">
          Filters{count > 0 ? <span className="tnum rounded-full bg-ink px-2 py-0.5 text-caption text-white">{count}</span> : null}
        </button>
      }
    >
      <div className="p-5" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
        {children}
      </div>
    </Sheet>
  );
}
