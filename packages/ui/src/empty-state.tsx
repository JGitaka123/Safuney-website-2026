import type { ReactNode } from "react";
import { cn } from "./cn";

export interface EmptyStateProps {
  heading: ReactNode;
  body?: ReactNode;
  /** Up to two actions; the first is the primary one. */
  actions?: readonly [ReactNode] | readonly [ReactNode, ReactNode];
  /** Extra content under the body, e.g. the four zone bands for an empty cart. */
  children?: ReactNode;
  /** Heading level so the outline stays in order (2 directly under a page h1). */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/** Empty states invite action (plan §6.5): plain copy on a hairline panel, no illustration. */
export function EmptyState({ heading, body, actions, children, headingLevel = 3, className }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={cn("border border-line bg-surface px-5 py-8", className)}>
      <Heading className="max-w-[28ch] text-h3 text-ink">{heading}</Heading>
      {body ? <p className="mt-2 max-w-[62ch] text-body text-ink-muted">{body}</p> : null}
      {children ? <div className="mt-6">{children}</div> : null}
      {actions && actions.length > 0 ? <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div> : null}
    </div>
  );
}
