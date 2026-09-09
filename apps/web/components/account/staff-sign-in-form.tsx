"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input } from "@safuney/ui";
import { staffSignInAction } from "@/lib/auth/actions";

export function StaffSignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await staffSignInAction(email, password, totp, next);
          if (r && !r.ok) setError(r.message);
        });
      }}
      className="flex flex-col gap-5"
    >
      {error ? (
        <Alert variant="error" title="Not signed in">
          {error}
        </Alert>
      ) : null}
      <Input label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
      <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      <Input label="Authenticator code" value={totp} onChange={(e) => setTotp(e.target.value)} inputMode="numeric" autoComplete="one-time-code" helper="Six digits from your authenticator app. Leave empty only if you have not set one up yet." className="max-w-[12rem] font-mono tracking-[0.3em]" />
      <div>
        <Button type="submit" variant="primary" busy={pending} busyLabel="Checking…">
          Sign in
        </Button>
      </div>
    </form>
  );
}
