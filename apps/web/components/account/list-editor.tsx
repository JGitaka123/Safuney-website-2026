"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, QuantityStepper } from "@safuney/ui";
import { addListToCartAction, deleteListAction, setListItemAction } from "@/lib/b2b/list-actions";

export interface ListLine {
  variantId: string;
  name: string;
  packLabel: string;
  qty: number;
  href: string;
  priceLabel: string | null;
  available: boolean;
  stock: number | null;
}

export function ListEditor({ listId, lines }: { listId: string; lines: ListLine[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div>
      {result ? (
        <Alert variant={result.ok ? "success" : "error"} className="mb-4">
          {result.message}
        </Alert>
      ) : null}
      {lines.length === 0 ? (
        <p className="text-body text-ink-muted">
          This list is empty. Add packs from any product page with &ldquo;Save to list&rdquo;, or from the{" "}
          <Link href="/order-sheet" className="text-accent underline underline-offset-[3px]">
            order sheet
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {lines.map((l) => (
            <li key={l.variantId} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
              <div className="min-w-0">
                <Link href={l.href} className="font-medium text-ink underline-offset-[3px] hover:underline">
                  {l.name}
                </Link>
                <p className="text-small text-ink-muted">
                  {l.packLabel}
                  {l.priceLabel ? ` · ${l.priceLabel}` : ""}
                  {!l.available ? " · not available right now" : l.stock !== null && l.stock <= 0 ? " · out of stock" : ""}
                </p>
                {failures[l.variantId] ? (
                  <p role="alert" className="text-small text-ink">
                    {failures[l.variantId]}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <QuantityStepper label={`Quantity of ${l.name} ${l.packLabel}`} value={l.qty} min={0} max={999} onChange={(qty) => start(async () => { const r = await setListItemAction(listId, l.variantId, qty); if (!r.ok) setResult(r); else router.refresh(); })} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          variant="primary"
          busy={pending}
          busyLabel="Adding…"
          disabled={lines.length === 0}
          onClick={() =>
            start(async () => {
              const r = await addListToCartAction(listId);
              setResult(r);
              setFailures(Object.fromEntries((r.ok ? (r.failures ?? []) : []).map((f) => [f.variantId, f.message])));
              if (r.ok) window.dispatchEvent(new Event("sfn:cart"));
              if (r.ok && (r.failures ?? []).length === 0) router.push("/cart");
            })
          }
        >
          Add all to cart
        </Button>
        {confirmDelete ? (
          <>
            <Button variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await deleteListAction(listId); if (r && !r.ok) setResult(r); })}>
              Yes, delete the list
            </Button>
            <Button variant="tertiary" disabled={pending} onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button variant="tertiary" disabled={pending} onClick={() => setConfirmDelete(true)}>
            Delete list
          </Button>
        )}
      </div>
    </div>
  );
}
