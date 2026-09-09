"use client";

import { useActionState } from "react";
import { Alert, Button } from "@safuney/ui";
import type { ActionResult } from "@/lib/b2b/actions";

interface ActionFormProps {
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  busyLabel?: string;
  children: React.ReactNode;
  className?: string;
}

/** A form bound to a server action that reports success or a recoverable error inline. */
export function ActionForm({ action, submitLabel, busyLabel = "Saving…", children, className = "" }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(async (_prev: ActionResult | null, formData: FormData) => action(formData), null);
  return (
    <form action={formAction} className={`flex flex-col gap-5 ${className}`}>
      {state && !state.ok ? (
        <Alert variant="error" title="Not saved">
          {state.message}
        </Alert>
      ) : null}
      {state && state.ok && state.message ? <Alert variant="success">{state.message}</Alert> : null}
      {children}
      <div>
        <Button type="submit" variant="primary" busy={pending} busyLabel={busyLabel}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
