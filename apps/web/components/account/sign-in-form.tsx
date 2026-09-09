"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input, PhoneInput } from "@safuney/ui";
import { requestCodeAction, requestLinkAction, verifyCodeAction } from "@/lib/auth/actions";

interface SignInFormProps {
  next: string;
  /** Server-rendered from PAYMENTS_MODE: the code is shown on the page so previews and tests can finish the flow. */
  mockMode: boolean;
  smsAvailable: boolean;
  emailAvailable: boolean;
  expired?: boolean;
}

type Method = "phone" | "email";

/** Sign in with a code by SMS (default in Kenya) or an emailed link. No passwords for customers. */
export function SignInForm({ next, mockMode, smsAvailable, emailAvailable, expired }: SignInFormProps) {
  const [method, setMethod] = useState<Method>(smsAvailable || mockMode ? "phone" : "email");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"start" | "code" | "link-sent">("start");
  const [error, setError] = useState<string | null>(expired ? "That sign-in link has expired or was already used. Ask for a new one." : null);
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const target = method === "phone" ? phone : email;

  function sendCode() {
    setError(null);
    start(async () => {
      const r = await requestCodeAction(target);
      if (!r.ok) return setError(r.message);
      setMockCode(r.mockCode ?? null);
      setStage("code");
    });
  }

  function sendLink() {
    setError(null);
    start(async () => {
      const r = await requestLinkAction(email, next);
      if (!r.ok) return setError(r.message);
      setStage("link-sent");
    });
  }

  function verify() {
    setError(null);
    start(async () => {
      const r = await verifyCodeAction(target, code, next);
      if (r && !r.ok) setError(r.message);
    });
  }

  if (stage === "link-sent") {
    return (
      <Alert variant="success" title="Check your email">
        We sent a sign-in link to <span className="font-medium">{email}</span>. It works once and expires in 15 minutes.
      </Alert>
    );
  }

  if (stage === "code") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
        className="flex flex-col gap-5"
      >
        <p className="text-body text-ink">
          Enter the six-digit code we sent to <span className="font-medium tabular-nums">{target}</span>.
        </p>
        {mockCode ? (
          <Alert variant="warning" title="Test mode">
            No SMS is sent on previews. Your code is <span className="font-mono text-mono">{mockCode}</span>.
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="error" title="Not signed in">
            {error}
          </Alert>
        ) : null}
        <Input label="Sign-in code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="max-w-[12rem] font-mono tracking-[0.3em]" />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" busy={pending} busyLabel="Checking…">
            Sign in
          </Button>
          <Button type="button" variant="tertiary" onClick={sendCode} disabled={pending}>
            Send a new code
          </Button>
          <Button type="button" variant="tertiary" onClick={() => setStage("start")} disabled={pending}>
            Use a different number
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (method === "phone" || !emailAvailable) sendCode();
        else sendLink();
      }}
      className="flex flex-col gap-5"
    >
      <div role="radiogroup" aria-label="How to sign in" className="flex flex-wrap gap-2">
        {(["phone", "email"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={method === m}
            onClick={() => setMethod(m)}
            className={`inline-flex min-h-11 items-center rounded-button border px-4 text-button ${method === m ? "border-ink bg-ink text-white" : "border-stainless bg-surface text-ink hover:bg-ground-deep"}`}
          >
            {m === "phone" ? "Code by SMS" : "Email"}
          </button>
        ))}
      </div>
      {error ? (
        <Alert variant="error" title="Not signed in">
          {error}
        </Alert>
      ) : null}
      {method === "phone" ? (
        <PhoneInput label="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} helper="We text a six-digit code to this number." required autoFocus />
      ) : (
        <Input label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} helper={emailAvailable ? "We email a link that signs you in with one tap." : "We email a six-digit code."} autoComplete="email" required autoFocus />
      )}
      <div>
        <Button type="submit" variant="primary" busy={pending} busyLabel="Sending…">
          {method === "phone" ? "Send the code" : emailAvailable ? "Email me a link" : "Email me a code"}
        </Button>
      </div>
      <p className="text-small text-ink-muted">No password to remember. Your first sign-in creates your account.</p>
    </form>
  );
}
