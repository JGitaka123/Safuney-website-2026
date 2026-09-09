import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./cn";

/*
 * Tables (plan §6.7): real <table> with <th scope>, header row on ground-deep, 1 px line rules, tabular
 * numerals right-aligned, mono for ratios. On mobile the table scrolls inside its own container and never
 * breaks the page width. The scroll region is focusable so keyboard users can scroll it.
 */

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Accessible name; rendered as <caption> (visually hidden unless `captionVisible`). */
  caption: string;
  captionVisible?: boolean;
  /** Class for the scroll container. */
  wrapperClassName?: string;
}

export function Table({ caption, captionVisible, wrapperClassName, className, children, ...rest }: TableProps) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className={cn("w-full overflow-x-auto", wrapperClassName)}>
      <table className={cn("w-full border-collapse border border-line bg-surface text-small text-ink tabular-nums", className)} {...rest}>
        <caption className={captionVisible ? "px-4 py-3 text-left text-body font-medium" : "sr-only"}>{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-ground-deep", className)} {...rest} />;
}

export function TBody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...rest} />;
}

export function Tr({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-t border-line", className)} {...rest} />;
}

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export function Th({ className, numeric, scope = "col", ...rest }: ThProps) {
  return (
    <th
      scope={scope}
      className={cn("whitespace-nowrap px-4 py-3 text-left align-bottom font-semibold", numeric && "text-right", className)}
      {...rest}
    />
  );
}

export interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  mono?: boolean;
}

export function Td({ className, numeric, mono, ...rest }: TdProps) {
  return (
    <td
      className={cn("px-4 py-3 align-top", numeric && "whitespace-nowrap text-right", mono && "whitespace-nowrap font-mono text-mono", className)}
      {...rest}
    />
  );
}
