import type { ReactNode } from "react";
import { cn } from "./cn";

export interface EmptyStateProps {
  heading: ReactNode;
  body?: ReactNode;
  /** Up to two actions; the first is the primary one. */
  actions?: readonly [ReactNode] | readonly [ReactNode, ReactNode];
  /** Extra content under the body, e.g. the four zone bands for an empty cart. */
  children?: ReactNode;
  className?: string;
}

/** Empty states invite action (plan §6.5): plain copy on a hairline panel, no illustration. */
export function EmptyState({ heading, body, actions, children, className }: EmptyStateProps) {
  return (
    <div className={cn("border border-line bg-surface px-5 py-8", className)}>
      <h3 className="max-w-[28ch] text-h3 text-ink">{heading}</h3>
      {body ? <p className="mt-2 max-w-[62ch] text-body text-ink-muted">{body}</p> : null}
      {children ? <div className="mt-6">{children}</div> : null}
      {actions && actions.length > 0 ? <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div> : null}
    </div>
  );
}
