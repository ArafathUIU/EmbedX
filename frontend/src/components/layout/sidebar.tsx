import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  ExternalLink,
  Zap,
} from "lucide-react";
import { StatusDot, Badge } from "../ui/badge";
import { useHealth } from "@/hooks/use-health";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/documents", icon: FileText, label: "Documents" },
  { to: "/query", icon: MessageSquare, label: "Query" },
];

export function Sidebar() {
  const { data: health } = useHealth();
  const status: "healthy" | "error" | "loading" = health
    ? "healthy"
    : "error";

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 border-r border-border bg-surface flex flex-col z-30">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">EmbedX</h1>
            <p className="text-xs text-text-muted">RAG Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent"
              )
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">API Status</span>
          <Badge variant={status === "healthy" ? "success" : "error"}>
            <StatusDot status={status} />
            <span className="ml-1.5">
              {status === "healthy" ? "Online" : "Offline"}
            </span>
          </Badge>
        </div>
        <a
          href="https://github.com/ArafathUIU/EmbedX"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          GitHub
        </a>
      </div>
    </aside>
  );
}
