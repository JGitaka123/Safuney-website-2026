import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";
import { AlertMarkIcon, ChevronDownIcon } from "./icons";

/*
 * Form fields (plan §6.3, §6.4, §7.4).
 * Label above the field, always visible. Helper text before the mistake. Errors say what went wrong and how
 * to fix it, wired through aria-describedby and aria-invalid. 48 px tall, surface fill, 1 px stainless border,
 * 2 px radius. Focus: 2 px accent border (1 px border + 1 px inset ring) under the global 3 px outline.
 * Error: 2 px ink border. The border changes instantly; only the message fades in (plan §5).
 */

export interface FieldProps {
  label: ReactNode;
  /** id of the control the label points at. */
  htmlFor: string;
  helper?: ReactNode;
  helperId?: string;
  error?: ReactNode;
  errorId?: string;
  /** Adds "(optional)" after the label; required is the default for a B2B order form. */
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

/** Layout wrapper: label, helper, control, error. Controls below use it; custom controls can too. */
export function Field({ label, htmlFor, helper, helperId, error, errorId, optional, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-body font-medium text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-muted"> (optional)</span> : null}
      </label>
      {helper ? (
        <p id={helperId} className="-mt-1 text-small text-ink-muted">
          {helper}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} className="flex items-start gap-2 text-small text-ink motion-safe:animate-[fade-in_120ms_ease-out]">
          <AlertMarkIcon size={18} className="mt-0.5" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export const controlClass =
  "w-full min-h-12 rounded-chip border border-stainless bg-surface px-4 py-3 text-body text-ink " +
  "inset-ring-1 inset-ring-transparent placeholder:text-ink-muted " +
  "focus:border-accent focus:inset-ring-accent " +
  "aria-invalid:border-ink aria-invalid:inset-ring-ink aria-invalid:focus:border-accent aria-invalid:focus:inset-ring-accent " +
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-ground-deep disabled:text-stainless";

interface ControlChrome {
  label: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  /** Class for the outer field wrapper; `className` goes on the control itself. */
  fieldClassName?: string;
}

function useFieldIds(explicitId: string | undefined, describedBy: string | undefined, helper: ReactNode, error: ReactNode) {
  const generated = useId();
  const id = explicitId ?? `field-${generated}`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const described = [describedBy, helper ? helperId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return { id, helperId, errorId, described };
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id">, ControlChrome {
  id?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, optional, fieldClassName, className, id: explicitId, "aria-describedby": describedBy, ...rest },
  ref,
) {
  const { id, helperId, errorId, described } = useFieldIds(explicitId, describedBy, helper, error);
  return (
    <Field label={label} htmlFor={id} helper={helper} helperId={helperId} error={error} errorId={errorId} optional={optional} className={fieldClassName}>
      <input
        ref={ref}
        id={id}
        aria-describedby={described}
        aria-invalid={error ? true : undefined}
        className={cn(controlClass, className)}
        {...rest}
      />
    </Field>
  );
});

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">, ControlChrome {
  id?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helper, error, optional, fieldClassName, className, id: explicitId, rows = 4, "aria-describedby": describedBy, ...rest },
  ref,
) {
  const { id, helperId, errorId, described } = useFieldIds(explicitId, describedBy, helper, error);
  return (
    <Field label={label} htmlFor={id} helper={helper} helperId={helperId} error={error} errorId={errorId} optional={optional} className={fieldClassName}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-describedby={described}
        aria-invalid={error ? true : undefined}
        className={cn(controlClass, "min-h-30 resize-y", className)}
        {...rest}
      />
    </Field>
  );
});

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">, ControlChrome {
  id?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helper, error, optional, fieldClassName, className, id: explicitId, children, "aria-describedby": describedBy, ...rest },
  ref,
) {
  const { id, helperId, errorId, described } = useFieldIds(explicitId, describedBy, helper, error);
  return (
    <Field label={label} htmlFor={id} helper={helper} helperId={helperId} error={error} errorId={errorId} optional={optional} className={fieldClassName}>
      <span className="relative block">
        <select
          ref={ref}
          id={id}
          aria-describedby={described}
          aria-invalid={error ? true : undefined}
          className={cn(controlClass, "appearance-none pr-10", className)}
          {...rest}
        >
          {children}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink" />
      </span>
    </Field>
  );
});

export interface PhoneInputProps extends Omit<InputProps, "type" | "inputMode"> {
  /** Static country prefix shown before the number; Kenya is implied (plan §6.3). */
  prefix?: string;
}

/** Kenyan mobile number: static "+254" prefix, `inputmode="tel"`, national format 07xx xxx xxx. */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { label, helper, error, optional, fieldClassName, className, id: explicitId, prefix = "+254", "aria-describedby": describedBy, ...rest },
  ref,
) {
  const { id, helperId, errorId, described } = useFieldIds(explicitId, describedBy, helper, error);
  return (
    <Field label={label} htmlFor={id} helper={helper} helperId={helperId} error={error} errorId={errorId} optional={optional} className={fieldClassName}>
      <span className="relative block">
        <input
          ref={ref}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-describedby={described}
          aria-invalid={error ? true : undefined}
          className={cn(controlClass, "tabular-nums pl-20", className)}
          {...rest}
        />
        <span className="pointer-events-none absolute inset-y-px left-px flex w-16 items-center justify-center rounded-l-chip border-r border-line bg-ground-deep text-body text-ink tabular-nums">
          {prefix}
        </span>
      </span>
    </Field>
  );
});
