"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Alert, Button, PackSelector, QuantityStepper, Toast } from "@safuney/ui";
import { addToCart } from "@/lib/cart/actions";
import { productEnquiry, quoteHref, whatsappHref } from "@/lib/contact";
import { announceCartChange } from "@/components/site/cart-link";
import { btn } from "@/components/marketing/buttons";
import { Icon } from "@/components/marketing/icons";
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
  /** True when this pack has no list price: quoted, not sold online (see lib/cart/service.ts). */
  poa: boolean;
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
  const first = variants.find((v) => v.poa || v.stock.key !== "out") ?? variants[0];
  const [selectedId, setSelectedId] = useState<string | null>(first?.id ?? null);
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ message: string; count?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = variants.find((v) => v.id === selectedId) ?? null;
  // A pack with no list price is quoted, not sold online (see lib/cart/service.ts). The server would
  // refuse it anyway; showing Add to cart and then refusing would just waste the buyer's time.
  const poa = selected?.poa ?? false;
  // "Pack size on request" and "each" are not sizes, so they never go into a button label.
  const sizedPack = selected && /\d/.test(selected.label) ? selected.label : undefined;
  const perUnit = selected && !poa ? unitPrice(BigInt(selected.exVatMinor), selected.packSizeValue, selected.unit, mode, vatRateBps) : null;

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
        // A quoted pack is not an unavailable one: striking it through and captioning it "Out of
        // stock" would report a stock level nobody has entered for a pack nobody has priced.
        variants={variants.map((v) => ({
          id: v.id,
          label: v.label,
          priceLabel: v.priceHeadline,
          available: v.poa || v.stock.key !== "out",
          stockNote: v.poa || v.stock.key === "in" ? undefined : v.stock.label,
        }))}
      />

      {selected ? (
        <div aria-live="polite" className="flex flex-col gap-1">
          <p className="text-price-lg text-ink tabular-nums" data-money>
            {selected.priceHeadline}
            <span className="sr-only"> Kenyan shillings</span>
          </p>
          {selected.vatLine ? <p className="text-small text-ink-muted">{selected.vatLine}</p> : null}
          {perUnit ? <p className="text-caption text-ink-muted">{perUnit}</p> : null}
          {poa ? null : <p className={selected.stock.key === "out" ? "text-small text-ink" : "text-small text-accent"}>{selected.stock.label}</p>}
          <p className="text-caption text-ink-muted">SKU {selected.sku}</p>
        </div>
      ) : null}

      {poa ? (
        <div className="flex flex-col gap-3">
          <Link href={quoteHref({ product: productName, pack: sizedPack })} className={btn.cta}>
            {sizedPack ? `Get a price for ${sizedPack}` : "Get a price"}
            <Icon name="arrowRight" className="size-5" />
          </Link>
          <a href={whatsappHref(productEnquiry(productName, sizedPack))} target="_blank" rel="noopener noreferrer" className={btn.whatsapp}>
            <Icon name="whatsapp" className="size-5" />
            Ask for a price on WhatsApp
          </a>
          <p className="text-small text-ink-muted">This pack is quoted rather than priced online. Tell us the quantity and we come back with a price within one working day.</p>
        </div>
      ) : shopEnabled ? (
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
              <Link href={`/quote?sku=${selected.sku}`} className={btn.secondary}>
                Ask about {selected.label}
              </Link>
            </div>
          ) : (
            <Button type="button" onClick={submit} busy={pending} busyLabel="Adding to cart…" fullWidth>
              Add to cart
            </Button>
          )}
          <Link href={quoteHref({ product: productName, pack: sizedPack })} className="text-small text-accent underline underline-offset-[3px]">
            Buying in bulk? Request a quote
          </Link>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <Link href={`/quote?sku=${selected?.sku ?? ""}`} className={btn.cta}>
            Get a price
            <Icon name="arrowRight" className="size-5" />
          </Link>
          <p className="text-small text-ink-muted">Online ordering is not open yet. We quote within one working day.</p>
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
