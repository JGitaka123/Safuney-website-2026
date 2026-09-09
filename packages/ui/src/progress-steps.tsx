import { cn } from "./cn";
import { TickIcon } from "./icons";

export interface ProgressStepsProps {
  steps: readonly string[];
  /** Zero-based index of the current step. */
  current: number;
  /** Accessible name of the navigation landmark. */
  label?: string;
  className?: string;
}

/**
 * Checkout stepper (plan §4.9): "1 Contact 2 Delivery 3 Payment 4 Review" over a teal progress rule that
 * fills up to and including the current step. Completed steps show a tick; the current step carries
 * aria-current="step".
 */
export function ProgressSteps({ steps, current, label = "Checkout progress", className }: ProgressStepsProps) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="grid auto-cols-fr grid-flow-col">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-1.5 border-b-4 pb-2 pr-2 text-label",
                done || active ? "border-accent" : "border-line",
                active ? "text-ink" : done ? "text-accent" : "text-ink-muted",
              )}
            >
              <span className="sr-only">
                Step {i + 1}
                {done ? ", completed" : ""}:
              </span>
              {done ? (
                <TickIcon size={16} />
              ) : (
                <span aria-hidden className="tabular-nums">
                  {i + 1}
                </span>
              )}
              <span className="truncate">{step}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
