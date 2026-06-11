import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, MessageSquare, GitGraph, ExternalLink, Layers } from "lucide-react";
import { StatusDot, Badge } from "../ui/badge";
import { useHealth } from "@/hooks/use-health";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/documents", icon: FileText, label: "Documents" },
  { to: "/query", icon: MessageSquare, label: "Query" },
  { to: "/mindmap", icon: GitGraph, label: "Notebook" },
  { to: "/flashcards", icon: Layers, label: "Flashcards" },
];

export function Sidebar() {
  const { data: health } = useHealth();
  const status: "healthy" | "error" | "loading" = health
    ? "healthy"
    : "error";

  return (
    <aside className="w-60 h-screen fixed left-0 top-0 border-r border-border bg-void z-30 flex flex-col">
      <div className="p-5 pb-0">
        <div className="flex items-end gap-2">
          <span className="font-display font-bold text-2xl tracking-tighter text-bone">
            embed
          </span>
          <span className="font-mono text-xs text-violet tracking-widest uppercase mb-1">
            x
          </span>
        </div>
        <p className="font-mono text-[10px] text-bone-dim tracking-widest uppercase mt-0.5">
          RAG Platform v0.1
        </p>
      </div>

      <hr className="ortho-rule mx-5 my-4" />

      <nav className="flex-1 px-3 space-y-px">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-3 py-2 font-body text-sm tracking-tight transition-colors duration-150",
                isActive
                  ? "bg-violet/10 text-violet-bright border-l border-violet/40"
                  : "text-bone-muted hover:text-bone hover:bg-surface-elevated border-l border-transparent"
              )
            }
          >
            <item.icon className="w-4 h-4 opacity-70" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <hr className="ortho-rule mx-5 mb-4" />
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-bone-dim tracking-widest uppercase">
              API
            </span>
            <Badge variant={status === "healthy" ? "mint" : "heat"}>
              <StatusDot status={status} />
              <span className="ml-1.5">{status === "healthy" ? "LIVE" : "DOWN"}</span>
            </Badge>
          </div>
          <a
            href="https://github.com/ArafathUIU/EmbedX"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-mono text-[11px] text-bone-dim hover:text-bone-muted transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            github
          </a>
        </div>
      </div>
    </aside>
  );
}
