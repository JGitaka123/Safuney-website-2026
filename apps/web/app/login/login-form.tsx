"use client";

import { useActionState } from "react";
import { Button } from "@safuney/ui";
import { submitLoginAction, loginDemoAction, type LoginState } from "./actions";

const control =
  "block w-full rounded-chip border border-stainless bg-surface px-3 text-body text-ink " +
  "focus:border-accent focus:shadow-[inset_0_0_0_1px_var(--color-accent)]";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(submitLoginAction, {});

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        {state.error ? (
          <div className="rounded-chip border border-warning-ink bg-warning-wash p-3 text-small text-warning-ink">
            {state.error}
          </div>
        ) : null}

        <div>
          <label htmlFor="email" className="block text-label">
            Corporate email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="e.g. purchasing@sarova.co.ke"
            className={`${control} mt-1 h-12`}
          />
        </div>

        <Button type="submit" busy={pending} busyLabel="Signing in…" className="w-full">
          Sign in with email
        </Button>
      </form>

      <div className="relative border-t border-line pt-4">
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-surface px-2 text-caption text-ink-muted">
          Development test accounts
        </span>
        <p className="text-caption text-ink-muted text-center mb-3">
          Quick-switch to preconfigured B2B roles (Sarova Hotels Procurement):
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => loginDemoAction("buyer")}
            className="rounded-chip border border-line bg-ground px-3 py-2 text-small font-medium text-ink hover:border-accent hover:bg-accent-wash"
          >
            Sign in as Buyer (Purchasing)
          </button>
          <button
            type="button"
            onClick={() => loginDemoAction("approver")}
            className="rounded-chip border border-line bg-ground px-3 py-2 text-small font-medium text-ink hover:border-accent hover:bg-accent-wash"
          >
            Sign in as Approver (Finance)
          </button>
        </div>
      </div>
    </div>
  );
}
