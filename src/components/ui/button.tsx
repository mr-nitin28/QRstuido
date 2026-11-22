import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-slate-950 shadow-soft hover:translate-y-[-1px] hover:bg-accent/90",
  secondary:
    "bg-surfaceAlt text-ink ring-1 ring-border hover:bg-surfaceAlt/80 hover:translate-y-[-1px]",
  ghost:
    "bg-transparent text-ink ring-1 ring-transparent hover:bg-surfaceAlt/50 hover:ring-border",
  danger:
    "bg-danger text-white shadow-soft hover:translate-y-[-1px] hover:bg-danger/90"
};

const sizeClasses: Record<Size, string> = {
  sm: "min-h-11 rounded-full px-3.5 text-sm",
  md: "h-11 rounded-full px-5 text-sm",
  lg: "h-12 rounded-full px-6 text-base"
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}

