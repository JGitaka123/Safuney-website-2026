import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";
import { AlertMarkIcon, TickIcon } from "./icons";
import { HazardPictogram } from "./hazard-badge";

export type AlertVariant = "error" | "success" | "warning";

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
}

const styles: Record<AlertVariant, string> = {
  error: "border-2 border-ink bg-surface text-ink",
  success: "border border-line bg-surface text-accent",
  warning: "bg-warning-wash text-warning-ink",
};

/**
 * Status messages (plan §2.3, §6.4). Error and success never borrow the zone red/green. Error is role="alert"
 * and focusable so a form can move focus to its summary; success is role="status"; warning is static
 * content in the yellow-zone ink register, used for hazard notices.
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert({ variant, title, children, className, ...rest }, ref) {
  const role = variant === "error" ? "alert" : variant === "success" ? "status" : undefined;
  return (
    <div
      ref={ref}
      role={role}
      tabIndex={variant === "error" ? -1 : undefined}
      className={cn("flex items-start gap-3 px-4 py-3", styles[variant], className)}
      {...rest}
    >
      <span className="mt-0.5 shrink-0">
        {variant === "error" ? <AlertMarkIcon /> : variant === "success" ? <TickIcon /> : <HazardPictogram hazard="IRRITANT" size={20} />}
      </span>
      <div className="min-w-0 flex-1 text-body">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && "mt-1", "text-small", variant === "error" && "text-ink")}>{children}</div> : null}
      </div>
    </div>
  );
});
