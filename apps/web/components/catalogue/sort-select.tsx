"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SORTS, type SortKey } from "@/lib/catalogue/filters";

export function SortSelect({ base, value, query }: { base: string; value: SortKey; query: Record<string, string> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-small">
      <span>Sort by</span>
      <select
        value={value}
        aria-busy={pending || undefined}
        onChange={(e) => {
          const sp = new URLSearchParams(query);
          if (e.target.value === "relevance") sp.delete("sort");
          else sp.set("sort", e.target.value);
          sp.delete("page");
          const qs = sp.toString();
          start(() => router.push(qs ? `${base}?${qs}` : base));
        }}
        className="min-h-11 rounded-chip border border-stainless bg-surface px-3 text-body"
      >
        {Object.entries(SORTS).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>
    </label>
  );
}
