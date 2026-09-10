"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn, controlClass } from "@safuney/ui";
import type { SearchApiResponse } from "./types";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;
const MAX_CHARS = 100;

/** Where a query with nothing matching sends people (plan §6.5 suggests the closest category). */
const FALLBACK_CATEGORY = { href: "/products/warewashing", name: "Warewashing and kitchen hygiene" };

type Item =
  | { kind: "product"; id: string; href: string; name: string; meta: string; price: string | null }
  | { kind: "category"; id: string; href: string; name: string; meta: string }
  | { kind: "document"; id: string; href: string; name: string; meta: string }
  | { kind: "all"; id: string; href: string; name: string; meta: string };

type Status = { state: "idle" } | { state: "loading" } | { state: "done"; results: SearchApiResponse } | { state: "error"; message: string };

export interface SearchBoxProps {
  /** "popover": results float under the field (header). "inline": results flow in the page (sheet). */
  layout?: "popover" | "inline";
  /** Show the label above the field; otherwise it is visually hidden and the field carries a search icon. */
  labelVisible?: boolean;
  autoFocus?: boolean;
  /** Called after a result or the results page has been opened, e.g. to close a sheet. */
  onNavigate?: () => void;
  /** Accessible name of the search landmark; keep it unique per page. */
  landmarkLabel?: string;
  className?: string;
}

function resultsHref(q: string): string {
  return `/search?q=${encodeURIComponent(q)}`;
}

function toItems(r: SearchApiResponse): Item[] {
  const items: Item[] = [];
  for (const p of r.products) {
    const meta = [p.categoryName, p.packs.join(", ")].filter(Boolean).join(" · ");
    items.push({ kind: "product", id: p.id, href: p.href, name: p.name, meta, price: p.priceLabel });
  }
  for (const c of r.categories) items.push({ kind: "category", id: c.id, href: c.href, name: c.name, meta: `${c.productCount} ${c.productCount === 1 ? "product" : "products"}` });
  for (const d of r.documents) items.push({ kind: "document", id: d.id, href: d.href, name: d.title, meta: d.typeLabel });
  return items;
}

/**
 * Header search: an ARIA combobox with instant, debounced results grouped by type. Arrow keys move,
 * Enter opens the highlighted result or, with nothing highlighted, the full results page; Escape closes.
 * Stale responses are aborted so the list never shows results for an earlier query.
 */
export function SearchBox({ layout = "popover", labelVisible = false, autoFocus, onNavigate, landmarkLabel = "Site search", className }: SearchBoxProps) {
  const router = useRouter();
  const uid = useId();
  const inputId = `search-${uid}`;
  const listId = `${inputId}-list`;
  const optionId = (i: number) => `${inputId}-opt-${i}`;

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const trimmed = q.trim();
  const searchable = trimmed.length >= MIN_CHARS;

  function onChange(value: string) {
    setQ(value);
    setOpen(true);
    if (value.trim().length < MIN_CHARS) {
      setStatus({ state: "idle" });
      setActive(-1);
    } else {
      // Keep the last results on screen while the next request is in flight.
      setStatus((s) => (s.state === "done" ? s : { state: "loading" }));
    }
  }

  useEffect(() => {
    abortRef.current?.abort();
    if (!searchable) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal, headers: { accept: "application/json" } });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Search is not available right now. Press Enter to see the results page instead.");
        }
        const results = (await res.json()) as SearchApiResponse;
        if (controller.signal.aborted) return;
        setStatus({ state: "done", results });
        setActive(-1);
        setOpen(true);
      } catch (e) {
        if (controller.signal.aborted) return;
        setStatus({ state: "error", message: e instanceof Error && e.message ? e.message : "Search is not available right now. Press Enter to see the results page instead." });
        setOpen(true);
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, searchable]);

  const results = status.state === "done" ? status.results : null;
  const items = useMemo<Item[]>(() => {
    if (!results) return [];
    const list = toItems(results);
    if (list.length > 0) list.push({ kind: "all", id: "all", href: resultsHref(results.q), name: `See all results for '${results.q}'`, meta: "" });
    return list;
  }, [results]);
  const nothingFound = results !== null && items.length === 0;

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setActive(-1);
      onNavigate?.();
      router.push(href);
    },
    [onNavigate, router],
  );

  function submit() {
    if (!searchable) return;
    navigate(active >= 0 && items[active] ? items[active].href : resultsHref(trimmed));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) setOpen(true);
        if (items.length) setActive((a) => (a + 1) % items.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) setOpen(true);
        if (items.length) setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
        break;
      case "Home":
        if (open && items.length) {
          e.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open && items.length) {
          e.preventDefault();
          setActive(items.length - 1);
        }
        break;
      case "Enter":
        e.preventDefault();
        submit();
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
          setActive(-1);
        }
        break;
      default:
    }
  }

  useEffect(() => {
    if (active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(active))}`)?.scrollIntoView({ block: "nearest" });
    // optionId is stable for a given uid; only the index matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const showPanel = open && searchable && status.state !== "idle";
  const liveMessage =
    status.state === "loading" ? "Searching…" : status.state === "done" ? (items.length ? `${items.length - 1} ${items.length === 2 ? "result" : "results"} for '${status.results.q}'` : `No products found for '${status.results.q}'`) : status.state === "error" ? status.message : "";

  const groups: Array<{ kind: Item["kind"]; label: string }> = [
    { kind: "product", label: "Products" },
    { kind: "category", label: "Categories" },
    { kind: "document", label: "Documents" },
  ];

  const renderOption = (item: Item) => {
    const i = items.indexOf(item);
    const selected = i === active;
    return (
      <div
        key={`${item.kind}-${item.id}`}
        id={optionId(i)}
        role="option"
        aria-selected={selected}
        onMouseDown={(e) => e.preventDefault()}
        onMouseMove={() => {
          if (active !== i) setActive(i);
        }}
        onClick={() => navigate(item.href)}
        className={cn("flex min-h-11 cursor-pointer items-baseline justify-between gap-3 px-4 py-2", selected ? "bg-accent-wash" : "hover:bg-ground-deep", item.kind === "all" && "border-t border-line text-accent underline underline-offset-[3px]")}
      >
        <span className="min-w-0">
          <span className="block text-body text-ink [overflow-wrap:anywhere]">{item.name}</span>
          {item.meta ? <span className="block text-caption text-ink-muted">{item.meta}</span> : null}
        </span>
        {item.kind === "product" && item.price ? <span className="tnum shrink-0 text-small text-ink" data-money>{item.price}</span> : null}
      </div>
    );
  };

  return (
    <form
      role="search"
      aria-label={landmarkLabel}
      action="/search"
      method="get"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label htmlFor={inputId} className={labelVisible ? "mb-2 block text-body font-medium text-ink" : "sr-only"}>
        Search products, SKUs and documents
      </label>
      <div className="relative">
        <svg aria-hidden width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M13 13l4.5 4.5" />
        </svg>
        <input
          id={inputId}
          name="q"
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={showPanel && items.length > 0 ? listId : undefined}
          aria-activedescendant={showPanel && active >= 0 ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-describedby={`${inputId}-hint`}
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_CHARS}
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (searchable) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search"
          className={cn(controlClass, "min-h-11 py-2 pl-10 pr-4 [&::-webkit-search-cancel-button]:appearance-none", layout === "popover" && "text-small")}
        />
        <span id={`${inputId}-hint`} className="sr-only">
          Type at least two characters. Results appear as you type; use the arrow keys to move through them and Enter to open one, or Enter with nothing selected to see every result.
        </span>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <div
        hidden={!showPanel}
        className={cn(
          "max-h-[min(70vh,32rem)] overflow-y-auto border border-line bg-surface text-ink",
          layout === "popover" ? "absolute left-0 right-0 top-full z-40 mt-1 min-w-[20rem] rounded-sheet shadow-float" : "mt-3",
        )}
      >
        {status.state === "loading" ? <p className="px-4 py-3 text-small text-ink-muted">Searching…</p> : null}
        {status.state === "error" ? <p className="px-4 py-3 text-small text-ink">{status.message}</p> : null}
        {nothingFound ? (
          <p className="px-4 py-3 text-small text-ink">
            No products found for &apos;{results?.q}&apos;. Check the spelling, or browse{" "}
            <Link href={FALLBACK_CATEGORY.href} onClick={() => navigate(FALLBACK_CATEGORY.href)} className="text-accent underline underline-offset-[3px]">
              {FALLBACK_CATEGORY.name}
            </Link>
            .
          </p>
        ) : null}
        {items.length > 0 ? (
          <div ref={listRef} id={listId} role="listbox" aria-label="Search results">
            {groups.map((g) => {
              const inGroup = items.filter((it) => it.kind === g.kind);
              if (inGroup.length === 0) return null;
              return (
                <div key={g.kind} role="group" aria-labelledby={`${listId}-${g.kind}`}>
                  <div id={`${listId}-${g.kind}`} role="presentation" className="bg-ground-deep px-4 py-1.5 text-label text-ink-muted">
                    {g.label}
                  </div>
                  {inGroup.map(renderOption)}
                </div>
              );
            })}
            {items.filter((it) => it.kind === "all").map(renderOption)}
          </div>
        ) : null}
      </div>
    </form>
  );
}
