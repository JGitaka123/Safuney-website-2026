"use client";

import { useState, useTransition } from "react";
import { Button } from "@safuney/ui";
import { deleteAddressAction, setDefaultAddressAction } from "@/lib/account/address-actions";

export interface AddressView {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  lines: string[];
  isDefault: boolean;
}

export function AddressCard({ address, editHref }: { address: AddressView; editHref: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <article className="border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-h4">{address.label ?? address.recipientName}</h3>
        {address.isDefault ? <span className="text-small text-ink-muted">Default</span> : null}
      </div>
      <p className="mt-2 text-body text-ink">
        {address.recipientName} · <span className="tabular-nums">{address.phone}</span>
      </p>
      <p className="text-small text-ink-muted">{address.lines.join(", ")}</p>
      {message ? (
        <p role="alert" className="mt-2 text-small text-ink">
          {message}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={editHref} className="inline-flex min-h-11 items-center rounded-button border border-stainless bg-surface px-4 text-button text-ink hover:bg-ground-deep">
          Edit
        </a>
        {!address.isDefault ? (
          <Button variant="tertiary" size="sm" disabled={pending} onClick={() => start(async () => { const r = await setDefaultAddressAction(address.id); if (!r.ok) setMessage(r.message); })}>
            Make default
          </Button>
        ) : null}
        {confirm ? (
          <>
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(async () => { const r = await deleteAddressAction(address.id); if (!r.ok) setMessage(r.message); })}>
              Yes, remove it
            </Button>
            <Button variant="tertiary" size="sm" disabled={pending} onClick={() => setConfirm(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button variant="tertiary" size="sm" disabled={pending} onClick={() => setConfirm(true)}>
            Remove
          </Button>
        )}
      </div>
    </article>
  );
}
