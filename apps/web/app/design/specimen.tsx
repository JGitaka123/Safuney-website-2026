import type { ReactNode } from "react";
import { cn } from "@safuney/ui";

/** A titled block of the design system page. */
export function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-20 border-t border-line py-12 md:py-16">
      <h2 id={`${id}-heading`} className="text-h2">
        {title}
      </h2>
      {intro ? <p className="mt-3 max-w-[62ch] text-body text-ink-muted">{intro}</p> : null}
      <div className="mt-8 flex flex-col gap-10">{children}</div>
    </section>
  );
}

/** One state of one primitive, with an optional note for states that cannot be forced (hover). */
export function Specimen({ title, note, children, className }: { title: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <h3 className="text-small font-medium text-ink-muted">{title}</h3>
      <div className="mt-3 min-w-0">{children}</div>
      {note ? <p className="mt-3 max-w-[62ch] text-caption text-ink-muted">{note}</p> : null}
    </div>
  );
}

/** Colour swatch with the values from plan §2. Background classes are static so Tailwind can see them. */
export function Swatch({ name, hex, swatchClass, role, contrast }: { name: string; hex: string; swatchClass: string; role: string; contrast: string }) {
  return (
    <div className="flex gap-4 border border-line bg-surface p-3">
      <span aria-hidden className={cn("size-16 shrink-0 border border-line", swatchClass)} />
      <div className="min-w-0 text-small">
        <p className="font-medium text-ink">{name}</p>
        <p className="font-mono text-mono text-ink">{hex}</p>
        <p className="mt-1 text-ink-muted">{role}</p>
        <p className="mt-1 text-caption text-ink-muted tabular-nums">{contrast}</p>
      </div>
    </div>
  );
}
