import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full border border-border bg-surface px-4 font-body text-sm text-bone placeholder:text-bone-dim",
        "focus:outline-none focus:border-violet/60 focus:ring-0",
        "transition-colors duration-200 font-body",
        className
      )}
      {...props}
    />
  );
}
