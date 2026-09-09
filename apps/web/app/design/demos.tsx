"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, PackSelector, QuantityStepper, Sheet, Toast, ZoneBadge, ZONES, type PackVariant } from "@safuney/ui";

const qacVariants: readonly PackVariant[] = [
  { id: "5l", label: "5 L", priceLabel: "KES 1,250.00", available: true },
  { id: "20l", label: "20 L", priceLabel: "KES 4,400.00", available: true },
];

const chlorineVariants: readonly PackVariant[] = [
  { id: "5l", label: "5 L", priceLabel: "KES 890.00", available: true },
  { id: "20l", label: "20 L", priceLabel: "KES 3,200.00", available: false, stockNote: "Sold out. Choose 5 L, or ask us when 20 L is back." },
  { id: "25l", label: "25 L", priceLabel: "KES 3,900.00", available: true },
];

export function PackSelectorDemo({ variant }: { variant: "qac" | "chlorine" }) {
  const variants = variant === "qac" ? qacVariants : chlorineVariants;
  const [value, setValue] = useState<string | null>(variants[0]?.id ?? null);
  const selected = variants.find((v) => v.id === value);
  return (
    <div className="max-w-md">
      <PackSelector variants={variants} value={value} onChange={setValue} />
      <p className="mt-3 text-small text-ink-muted tabular-nums" aria-live="polite">
        {selected ? `Selected: ${selected.label}, ${selected.priceLabel}.` : "Choose a pack size first."}
      </p>
    </div>
  );
}

export function QuantityDemo({ initial = 1, min = 1, max = 99, disabled }: { initial?: number; min?: number; max?: number; disabled?: boolean }) {
  const [value, setValue] = useState(initial);
  return <QuantityStepper value={value} onChange={setValue} min={min} max={max} disabled={disabled} unitLabel="QAC-based sanitiser, 5 L" />;
}

export function ToastDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add 5 L to cart
      </Button>
      <Toast
        open={open}
        onClose={() => setOpen(false)}
        message="Added to cart: QAC-based sanitiser, 5 L."
        action={
          <Link href="/products" className="shrink-0 text-accent underline underline-offset-[3px] hover:decoration-2">
            View cart
          </Link>
        }
      />
    </>
  );
}

export function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Filters"
      description="Narrow the product list by zone."
      side="bottom"
      trigger={<Button variant="secondary">Filters (2)</Button>}
    >
      <div className="px-5 py-4">
        <p className="text-body font-medium">Where will you use it?</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {ZONES.map((z) => (
            <li key={z.key}>
              <ZoneBadge zone={z.key} />
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => setOpen(false)}>Show 14 products</Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Clear filters
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
