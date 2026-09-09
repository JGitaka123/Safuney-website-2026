"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Alert, Button, PackSelector, QuantityStepper, Toast } from "@safuney/ui";
import { addToCart } from "@/lib/cart/actions";
import { announceCartChange } from "@/components/site/cart-link";
import { unitPrice } from "@/lib/pricing";

export interface PurchaseVariant {
  id: string;
  sku: string;
  label: string;
  packSizeValue: string;
  unit: string;
  priceHeadline: string;
  vatLine: string;
  exVatMinor: string;
  stock: { key: "in" | "low" | "mto" | "out"; label: string };
  available: number;
  madeToOrder: boolean;
  weightGrams: number | null;
}

interface Props {
  productName: string;
  variants: PurchaseVariant[];
  mode: "EX_VAT" | "INC_VAT";
  vatRateBps: number;
  shopEnabled: boolean;
}

/**
 * Variant selector, live price with VAT line, stock status, quantity and Add to cart (plan §4.7).
 * Prices shown here are for display only; the server recomputes everything from the catalogue.
 */
export function PurchasePanel({ productName, variants, mode, vatRateBps, shopEnabled }: Props) {
  const first = variants.find((v) => v.stock.key !== "out") ?? variants[0];
  const [selectedId, setSelectedId] = useState<string | null>(first?.id ?? null);
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ message: string; count?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const perUnit = selected ? unitPrice(BigInt(selected.exVatMinor), selected.packSizeValue, selected.unit, mode, vatRateBps) : null;

  function submit() {
    setError(null);
    if (!selected) {
      setError("Choose a pack size first.");
      return;
    }
    start(async () => {
      const res = await addToCart({ variantId: selected.id, qty });
      if (res.ok) {
        announceCartChange();
        setToast({ message: `Added ${qty} × ${productName} ${selected.label}`, count: res.itemCount });
      }
      else setError(res.message);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PackSelector
        legend="Pack size"
        name="variant"
        value={selectedId}
        onChange={(id) => {
          setSelectedId(id);
          setError(null);
        }}
        variants={variants.map((v) => ({ id: v.id, label: v.label, priceLabel: v.priceHeadline, available: v.stock.key !== "out", stockNote: v.stock.key === "in" ? undefined : v.stock.label }))}
      />

      {selected ? (
        <div aria-live="polite" className="flex flex-col gap-1">
          <p className="text-price-lg text-ink tabular-nums" data-money>
            {selected.priceHeadline}
            <span className="sr-only"> Kenyan shillings</span>
          </p>
          <p className="text-small text-ink-muted">{selected.vatLine}</p>
          {perUnit ? <p className="text-caption text-ink-muted">{perUnit}</p> : null}
          <p className={selected.stock.key === "out" ? "text-small text-ink" : "text-small text-accent"}>{selected.stock.label}</p>
          <p className="text-caption text-ink-muted">SKU {selected.sku}</p>
        </div>
      ) : null}

      {shopEnabled ? (
        <>
          <QuantityStepper label="Quantity" value={qty} onChange={setQty} min={1} max={selected && !selected.madeToOrder ? Math.max(1, selected.available) : 999} disabled={!selected || selected.stock.key === "out"} />
          {error ? (
            <Alert variant="error" title="Not added">
              {error}
            </Alert>
          ) : null}
          {selected?.stock.key === "out" ? (
            <div className="flex flex-col gap-3">
              <p className="text-small">This pack is out of stock. Choose another pack size, or ask us when it is back.</p>
              <Link href={`/contact?topic=quote&sku=${selected.sku}`} className="inline-flex min-h-11 items-center justify-center rounded-button border border-stainless bg-surface px-5 text-button text-ink">
                Ask about {selected.label}
              </Link>
            </div>
          ) : (
            <Button type="button" onClick={submit} busy={pending} busyLabel="Adding to cart…" fullWidth>
              Add to cart
            </Button>
          )}
          <Link href={`/quote?product=${encodeURIComponent(productName)}${selected ? `&pack=${encodeURIComponent(selected.label)}` : ""}`} className="text-small text-accent underline underline-offset-[3px]">
            Buying in bulk? Request a quote
          </Link>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <Link href={`/contact?topic=quote&sku=${selected?.sku ?? ""}`} className="inline-flex min-h-11 items-center justify-center rounded-button bg-ink px-5 text-button text-white hover:bg-accent-deep">
            Request a quote
          </Link>
          <p className="text-small text-ink-muted">Online ordering opens with the full catalogue. Until then we quote the same day.</p>
        </div>
      )}

      <Toast
        open={toast !== null}
        onClose={() => setToast(null)}
        message={toast?.message ?? ""}
        action={
          <Link href="/cart" className="font-medium underline underline-offset-[3px]">
            View cart{toast?.count ? ` (${toast.count})` : ""}
          </Link>
        }
      />
    </div>
  );
}
