"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Alert, Button, Input, TBody, THead, Table, Td, Th, Tr } from "@safuney/ui";
import { addManyToCart } from "@/lib/cart/actions";
import { announceCartChange } from "@/components/site/cart-link";

export interface OrderSheetRow {
  variantId: string;
  productName: string;
  href: string;
  packLabel: string;
  sku: string;
  /** Preformatted, e.g. "KES 1,250.00"; null when the pack is quote-only. */
  unitPrice: string | null;
  stock: { key: "in" | "low" | "mto" | "out"; label: string };
  available: number;
  madeToOrder: boolean;
}

export interface OrderSheetGroup {
  slug: string;
  name: string;
  rows: OrderSheetRow[];
}

interface Props {
  groups: OrderSheetGroup[];
  priceHeading: string;
}

const MAX_QTY = 999;

interface Added {
  lines: Array<{ label: string; qty: number }>;
  itemCount: number;
}

/**
 * The B2B order sheet: every pack size in one table per category, a quantity box on each row, and one
 * button that adds everything at once. Lines the server refuses are explained on their own rows
 * (plan §6.4: never toast-only) and stay filled in so they can be corrected.
 */
export function OrderSheet({ groups, priceHeading }: Props) {
  const uid = useId();
  const [filter, setFilter] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [added, setAdded] = useState<Added | null>(null);
  const [pending, start] = useTransition();
  const errorRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const allRows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  const lines = useMemo(
    () =>
      allRows
        .map((r) => ({ row: r, qty: Number.parseInt(qty[r.variantId] ?? "", 10) }))
        .filter((l) => Number.isInteger(l.qty) && l.qty > 0),
    [allRows, qty],
  );
  const lineCount = lines.length;
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);

  const needle = filter.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return groups;
    return groups
      .map((g) => ({ ...g, rows: g.rows.filter((r) => r.productName.toLowerCase().includes(needle) || r.sku.toLowerCase().includes(needle) || r.packLabel.toLowerCase().includes(needle)) }))
      .filter((g) => g.rows.length > 0);
  }, [groups, needle]);
  const visibleCount = visible.reduce((n, g) => n + g.rows.length, 0);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);
  useEffect(() => {
    if (added) successRef.current?.focus();
  }, [added]);

  function submit() {
    setFormError(null);
    setAdded(null);
    if (lineCount === 0) {
      setFormError("Enter a quantity next to at least one product, then add the lines to your cart.");
      return;
    }
    start(async () => {
      const res = await addManyToCart(lines.map((l) => ({ variantId: l.row.variantId, qty: l.qty })));
      // Per-line failures come back on both branches; the success type only declares them when partial.
      const reported = (res as { failures?: Array<{ variantId: string; message: string }> }).failures ?? [];
      const failures = new Map(reported.map((f) => [f.variantId, f.message]));
      setRowErrors(Object.fromEntries(failures));
      if (!res.ok) {
        setFormError(failures.size ? `${res.message} Each line that could not be added says why, next to its quantity.` : res.message);
        return;
      }
      announceCartChange();
      const ok = lines.filter((l) => !failures.has(l.row.variantId));
      setAdded({ lines: ok.map((l) => ({ label: `${l.row.productName} ${l.row.packLabel}`, qty: l.qty })), itemCount: res.itemCount });
      // Keep the refused quantities in place so they can be corrected; clear the ones that went in.
      setQty((prev) => {
        const next = { ...prev };
        for (const l of ok) delete next[l.row.variantId];
        return next;
      });
      if (failures.size) setFormError(`${failures.size} ${failures.size === 1 ? "line was" : "lines were"} not added. Each one says why, next to its quantity.`);
    });
  }

  const buttonLabel = lineCount === 0 ? "Add lines to cart" : `Add ${lineCount} ${lineCount === 1 ? "line" : "lines"} to cart`;

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-md">
        <Input
          id={`${uid}-filter`}
          type="search"
          label="Find a product or SKU on this sheet"
          helper="Filters the rows below as you type. Quantities you have entered are kept."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {added ? (
        <Alert ref={successRef} variant="success" title="Added to cart" tabIndex={-1}>
          <ul className="flex flex-col gap-0.5">
            {added.lines.map((l) => (
              <li key={l.label} className="tnum">
                {l.qty} × {l.label}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            <Link href="/cart" className="font-medium text-accent underline underline-offset-[3px]">
              View cart ({added.itemCount} {added.itemCount === 1 ? "item" : "items"})
            </Link>
          </p>
        </Alert>
      ) : null}

      {formError ? (
        <Alert ref={errorRef} variant="error" title="Not added">
          {formError}
        </Alert>
      ) : null}

      {visibleCount === 0 ? (
        <div className="border border-line bg-surface px-5 py-8">
          <p className="text-body">No products on this sheet match &apos;{filter.trim()}&apos;. Check the spelling, or clear the search to see every line.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="secondary" onClick={() => setFilter("")}>
              Clear the search
            </Button>
            <Link href={`/contact?topic=quote&q=${encodeURIComponent(filter.trim())}`} className="inline-flex min-h-11 items-center justify-center rounded-button border border-stainless bg-surface px-5 text-button text-ink">
              Request a quote
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {needle ? (
            <p role="status" className="text-small text-ink-muted">
              <span className="tnum">{visibleCount}</span> {visibleCount === 1 ? "line matches" : "lines match"} &apos;{filter.trim()}&apos;.
            </p>
          ) : null}
          {visible.map((g) => (
            <Table key={g.slug} caption={g.name} captionVisible>
              <THead>
                <Tr>
                  <Th>Product</Th>
                  <Th>Pack</Th>
                  <Th>SKU</Th>
                  <Th numeric>{priceHeading}</Th>
                  <Th>Stock</Th>
                  <Th numeric>Quantity</Th>
                </Tr>
              </THead>
              <TBody>
                {g.rows.map((r) => {
                  const inputId = `${uid}-qty-${r.variantId}`;
                  const errId = `${inputId}-error`;
                  const error = rowErrors[r.variantId];
                  const value = qty[r.variantId] ?? "";
                  return (
                    <Tr key={r.variantId} className={error ? "bg-ground" : undefined}>
                      <Td className="min-w-[14rem]">
                        <Link href={r.href} className="text-body text-ink underline decoration-1 underline-offset-[3px] hover:decoration-2">
                          {r.productName}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap">{r.packLabel}</Td>
                      <Td mono>{r.sku}</Td>
                      <Td numeric data-money>
                        {r.unitPrice ?? <span className="text-ink-muted">Quoted</span>}
                      </Td>
                      <Td className={r.stock.key === "out" ? "whitespace-nowrap text-ink" : "whitespace-nowrap text-accent"}>{r.stock.label}</Td>
                      <Td numeric>
                        <input
                          id={inputId}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={r.madeToOrder ? MAX_QTY : Math.min(MAX_QTY, Math.max(0, r.available))}
                          step={1}
                          value={value}
                          aria-label={`Quantity of ${r.productName} ${r.packLabel}`}
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error ? errId : undefined}
                          onChange={(e) => {
                            const v = e.target.value;
                            setQty((prev) => ({ ...prev, [r.variantId]: v }));
                            if (error) setRowErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== r.variantId)));
                          }}
                          className="h-11 w-20 rounded-chip border border-stainless bg-surface px-2 text-right text-body text-ink tabular-nums focus:border-accent focus:inset-ring-1 focus:inset-ring-accent aria-invalid:border-2 aria-invalid:border-ink"
                        />
                        {error ? (
                          <p id={errId} className="mt-2 max-w-[24ch] text-left text-small text-ink">
                            {error}
                          </p>
                        ) : null}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 z-20 -mx-5 border-t border-line bg-surface px-5 py-3 md:-mx-6 md:px-6">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3">
          <p className="text-body" aria-live="polite">
            <span className="tnum font-medium">{lineCount}</span> {lineCount === 1 ? "line" : "lines"}
            {itemCount > 0 ? (
              <span className="text-ink-muted">
                {" "}
                · <span className="tnum">{itemCount}</span> {itemCount === 1 ? "item" : "items"}
              </span>
            ) : null}
          </p>
          <Button type="button" onClick={submit} busy={pending} busyLabel="Adding to cart…" className="w-full sm:w-auto">
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
