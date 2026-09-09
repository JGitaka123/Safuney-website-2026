"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@safuney/ui";

export interface SerializedCartLine {
  id: string;
  name: string;
  packLabel: string;
  qty: number;
  unitPriceLabel: string;
  lineTotalLabel: string;
}

export interface OrderSummaryProps {
  lines: SerializedCartLine[];
  subtotalLabel: string;
  vatLabel: string;
  deliveryLabel: string | null;
  deliveryMethod: "PICKUP" | "DELIVERY";
  deliveryCounty?: string;
  totalLabel: string;
  weightGrams: number;
}

export function OrderSummaryPanel({
  lines,
  subtotalLabel,
  vatLabel,
  deliveryLabel,
  deliveryMethod,
  deliveryCounty,
  totalLabel,
  weightGrams,
}: OrderSummaryProps) {
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  const weightKg = (weightGrams / 1000).toFixed(1);
  const deliveryDisplay =
    deliveryMethod === "PICKUP"
      ? "Collection (Mombasa Rd): Free"
      : deliveryLabel
        ? deliveryLabel
        : deliveryCounty
          ? "Calculating…"
          : "Quoted on county selection";

  const summaryContent = (
    <div>
      <ul className="divide-y divide-line">
        {lines.map((item) => (
          <li key={item.id} className="flex items-start justify-between py-3 text-small">
            <div className="pr-3">
              <p className="font-medium text-ink">{item.name}</p>
              <p className="text-ink-muted">
                {item.packLabel} × <span className="tabular-nums">{item.qty}</span>
              </p>
            </div>
            <div className="shrink-0 text-right font-medium tabular-nums text-ink">{item.lineTotalLabel}</div>
          </li>
        ))}
      </ul>

      <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-small text-ink">
        <div className="flex justify-between">
          <dt className="text-ink-muted">Subtotal (ex VAT)</dt>
          <dd className="tabular-nums font-medium">{subtotalLabel}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">VAT (16%)</dt>
          <dd className="tabular-nums font-medium">{vatLabel}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">Delivery</dt>
          <dd className="tabular-nums font-medium">{deliveryDisplay}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-3 text-body font-semibold text-ink">
          <dt>Order total</dt>
          <dd className="text-price tabular-nums">{totalLabel}</dd>
        </div>
      </dl>

      <p className="mt-3 text-caption text-ink-muted">
        Total shipment weight: <span className="tabular-nums">{weightKg} kg</span>
      </p>
    </div>
  );

  return (
    <div className="w-full">
      {/* Mobile collapsible summary strip (plan §4.9) */}
      <div className="border border-line bg-ground-deep p-4 lg:hidden">
        <button
          type="button"
          onClick={() => setIsOpenMobile((o) => !o)}
          aria-expanded={isOpenMobile}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="flex items-center gap-2 text-body font-medium text-ink">
            <span>Order total</span>
            <span className="text-price font-semibold tabular-nums">{totalLabel}</span>
          </span>
          <span className="flex items-center gap-1 text-small text-accent">
            <span>{isOpenMobile ? "Hide details" : "Show details"}</span>
            <ChevronDownIcon className={`size-4 transition-transform duration-120 ${isOpenMobile ? "rotate-180" : ""}`} />
          </span>
        </button>
        {isOpenMobile ? <div className="mt-4 border-t border-line pt-3">{summaryContent}</div> : null}
      </div>

      {/* Desktop sticky summary sidebar (plan §4.10) */}
      <div className="hidden border border-line bg-surface p-5 lg:block">
        <h2 className="text-h3 font-semibold text-ink">Order summary</h2>
        <div className="mt-4">{summaryContent}</div>
      </div>
    </div>
  );
}
