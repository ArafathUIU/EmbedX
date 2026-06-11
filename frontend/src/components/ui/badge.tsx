import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "default" | "mint" | "heat" | "ghost";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  const variants = {
    default: "bg-violet/10 text-violet-bright border border-violet/20",
    mint: "bg-mint/10 text-mint border border-mint/20",
    heat: "bg-heat/10 text-heat border border-heat/20",
    ghost: "bg-transparent text-bone-muted border border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-[11px] tracking-wide uppercase px-2.5 py-0.5",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ status }: { status: "healthy" | "error" | "loading" }) {
  const colors = {
    healthy: "bg-mint",
    error: "bg-heat",
    loading: "bg-violet animate-pulse",
  };

  return (
    <span
      className={cn("inline-block w-1.5 h-1.5", colors[status])}
      style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
    />
  );
}
