import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "default",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "mint";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center font-medium font-display tracking-tight transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-sm";

  const variants = {
    default:
      "bg-violet text-void hover:bg-violet-bright active:scale-[0.98]",
    outline:
      "border border-border bg-transparent text-bone hover:border-border-active hover:bg-surface-elevated",
    ghost:
      "bg-transparent text-bone-muted hover:text-bone hover:bg-surface-elevated",
    mint:
      "bg-mint text-void hover:brightness-110 active:scale-[0.98]",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-5",
    lg: "h-12 px-7",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12" cy="12" r="10"
            stroke="currentColor" strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
