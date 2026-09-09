"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Alert, QuantityStepper } from "@safuney/ui";
import { setCartQty } from "@/lib/cart/actions";
import { announceCartChange } from "@/components/site/cart-link";

interface Props {
  variantId: string;
  name: string;
  packLabel: string;
  href: string;
  qty: number;
  unitPrice: string;
  lineTotal: string;
  available: number;
  madeToOrder: boolean;
  unavailable: boolean;
}

export function CartLine(p: Props) {
  const [qty, setQty] = useState(p.qty);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(next: number) {
    setQty(next);
    setError(null);
    start(async () => {
      const res = await setCartQty({ variantId: p.variantId, qty: next });
      if (!res.ok) {
        setError(res.message);
        setQty(p.qty);
      } else announceCartChange();
    });
  }

  return (
    <li className="flex flex-col gap-3 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={p.href} className="text-h4 hover:underline underline-offset-[3px]">
            {p.name}
          </Link>
          <p className="text-small text-ink-muted">
            {p.packLabel} · {p.unitPrice} each
          </p>
          {p.unavailable ? <p className="mt-1 text-small text-ink">This product is no longer available to order online. Remove it, or ask us for an alternative.</p> : null}
        </div>
        <p className="tnum shrink-0 text-price" data-money>
          {p.lineTotal}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <QuantityStepper label={`Quantity of ${p.name} ${p.packLabel}`} value={qty} onChange={update} min={1} max={p.madeToOrder ? 999 : Math.max(1, p.available)} disabled={pending || p.unavailable} />
        <button type="button" onClick={() => update(0)} disabled={pending} className="min-h-11 rounded-button border border-stainless bg-surface px-4 text-button text-ink hover:bg-ground-deep disabled:text-stainless">
          Remove {p.name} {p.packLabel}
        </button>
      </div>
      {error ? (
        <Alert variant="error" title="Quantity not changed">
          {error}
        </Alert>
      ) : null}
    </li>
  );
}
