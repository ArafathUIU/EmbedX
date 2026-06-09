import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "error";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  const variants = {
    default:
      "bg-accent/10 text-accent border-accent/20",
    success:
      "bg-success/10 text-success border-success/20",
    warning:
      "bg-warning/10 text-warning border-warning/20",
    error:
      "bg-error/10 text-error border-error/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
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
    healthy: "bg-success",
    error: "bg-error",
    loading: "bg-warning animate-pulse",
  };

  return (
    <span className={cn("inline-block w-2 h-2 rounded-full", colors[status])} />
  );
}
