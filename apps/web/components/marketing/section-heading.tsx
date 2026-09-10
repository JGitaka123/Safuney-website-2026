import type { ReactNode } from "react";
import { cn } from "@safuney/ui";

interface SectionHeadingProps {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  /** Link or button set beside the heading on wide screens. */
  action?: ReactNode;
  tone?: "light" | "dark";
  align?: "left" | "center";
}

/** The heading block every storefront section opens with: a short label, one line of headline, one line of lead. */
export function SectionHeading({ id, eyebrow, title, lead, action, tone = "light", align = "left" }: SectionHeadingProps) {
  const dark = tone === "dark";
  return (
    <div className={cn("flex flex-col gap-4", align === "center" && "items-center text-center", action && "md:flex-row md:items-end md:justify-between")}>
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow ? <p className={cn("text-eyebrow uppercase", dark ? "text-brand-lime" : "text-accent")}>{eyebrow}</p> : null}
        <h2 id={id} className={cn("mt-2 text-h1", dark ? "text-white" : "text-ink")}>
          {title}
        </h2>
        {lead ? <p className={cn("mt-3 text-body-lg", dark ? "text-white/75" : "text-ink-muted")}>{lead}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
