"use client";

import { useState } from "react";
import { Sheet } from "@safuney/ui";
import { SearchBox } from "./search-box";

/** Header search on small screens: an icon button that opens the search box in a sheet. */
export function MobileSearch() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Search products, SKUs and documents"
      trigger={
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-button text-ink hover:bg-ground-deep" aria-label="Search">
          <svg aria-hidden width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="9.5" cy="9.5" r="6" />
            <path d="M14 14l5 5" />
          </svg>
        </button>
      }
    >
      <div className="p-5">
        <SearchBox layout="inline" labelVisible autoFocus onNavigate={() => setOpen(false)} />
      </div>
    </Sheet>
  );
}
