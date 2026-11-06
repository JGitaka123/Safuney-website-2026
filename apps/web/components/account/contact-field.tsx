"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, PhoneInput } from "@safuney/ui";
import { confirmContactAction, removeContactAction, requestContactCodeAction } from "@/lib/account/profile-actions";

interface ContactFieldProps {
  kind: "email" | "phone";
  /** As shown to the customer (07… for phones), or null when the account has none. */
  current: string | null;
  canRemove: boolean;
  /** Staff email is their sign-in; changed by an admin, not here. */
  locked?: boolean;
}

/** An email or phone on the account. A new one is added only after a code sent to it is entered. */
export function ContactField({ kind, current, canRemove, locked }: ContactFieldProps) {
  const router = useRouter();
  const [stage, setStage] = useState<"view" | "edit" | "code">("view");
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const label = kind === "email" ? "Email address" : "Mobile number";
  const noun = kind === "email" ? "email address" : "number";

  function send() {
    setError(null);
    start(async () => {
      const r = await requestContactCodeAction(kind, value);
      if (!r.ok) return setError(r.message);
      setMockCode(r.mockCode ?? null);
      setCode("");
      setStage("code");
    });
  }

  function confirm() {
    setError(null);
    start(async () => {
      const r = await confirmContactAction(kind, value, code);
      if (!r.ok) return setError(r.message);
      setNotice(r.message ?? null);
      setStage("view");
      setValue("");
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    start(async () => {
      const r = await removeContactAction(kind);
      if (!r.ok) return setError(r.message);
      setNotice(r.message ?? null);
      router.refresh();
    });
  }

  const errorBox = error ? (
    <Alert variant="error" title="Not changed">
      {error}
    </Alert>
  ) : null;

  if (stage === "code") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirm();
        }}
        className="flex flex-col gap-4"
        aria-label={`Confirm ${noun}`}
      >
        <p className="text-body text-ink">
          Enter the six-digit code we sent to <span className="font-medium tabular-nums">{value}</span>.
        </p>
        {mockCode ? (
          <Alert variant="warning" title="Test mode">
            Nothing is sent on previews. Your code is <span className="font-mono text-mono">{mockCode}</span>.
          </Alert>
        ) : null}
        {errorBox}
        <Input label={`Code sent to your ${noun}`} value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="max-w-[12rem] font-mono tracking-[0.3em]" />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" busy={pending} busyLabel="Checking…">
            Confirm
          </Button>
          <Button type="button" variant="tertiary" onClick={send} disabled={pending}>
            Send a new code
          </Button>
          <Button type="button" variant="tertiary" onClick={() => setStage("edit")} disabled={pending}>
            Back
          </Button>
        </div>
      </form>
    );
  }

  if (stage === "edit") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex flex-col gap-4"
      >
        {errorBox}
        {kind === "email" ? (
          <Input label={`New ${noun}`} type="email" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="email" required autoFocus helper="We email a code to check it is yours." />
        ) : (
          <PhoneInput label={`New ${noun}`} value={value} onChange={(e) => setValue(e.target.value)} required autoFocus helper="We text a code to check it is yours." />
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" busy={pending} busyLabel="Sending…">
            Send the code
          </Button>
          <Button type="button" variant="tertiary" onClick={() => setStage("view")} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {notice ? <Alert variant="success">{notice}</Alert> : null}
      {errorBox}
      <div>
        <p className="text-small text-ink-muted">{label}</p>
        <p className="text-body text-ink tabular-nums">{current ?? "Not added"}</p>
      </div>
      {locked ? null : (
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={() => { setNotice(null); setStage("edit"); }}>
            {current ? `Change ${noun}` : `Add ${noun}`}
          </Button>
          {current && canRemove ? (
            <Button type="button" variant="tertiary" onClick={remove} busy={pending} busyLabel="Removing…">
              Remove
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
