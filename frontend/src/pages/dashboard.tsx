import { useState, useEffect } from "react";
import { useHealth } from "@/hooks/use-health";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ArrowRight, FileText } from "lucide-react";
import { fetchDocuments } from "@/api/client";

export default function Dashboard() {
  const { data: health, isLoading, error, refetch } = useHealth();
  const [uptimeDisplay, setUptimeDisplay] = useState("");
  const [docCount, setDocCount] = useState<number | null>(null);

  useEffect(() => {
    if (health?.uptime_seconds) {
      const h = Math.floor(health.uptime_seconds / 3600);
      const m = Math.floor((health.uptime_seconds % 3600) / 60);
      const s = Math.floor(health.uptime_seconds % 60);
      setUptimeDisplay(`${h}h ${m}m ${s}s`);
    }
  }, [health?.uptime_seconds]);

  useEffect(() => {
    fetchDocuments()
      .then((d) => setDocCount(d.total))
      .catch(() => {});
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-void p-6">
              <Skeleton className="h-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-bone">
            Dashboard
          </h2>
          <p className="font-mono text-xs text-bone-dim tracking-wide uppercase mt-2">
            System Health
          </p>
        </div>
        <Card className="border-heat/30 bg-heat/5">
          <div className="p-6 flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center bg-heat/10">
              <Activity className="w-5 h-5 text-heat" />
            </div>
            <div className="flex-1">
              <p className="font-display font-semibold text-heat text-sm">API Unavailable</p>
              <p className="font-mono text-xs text-bone-dim mt-0.5">{error}</p>
            </div>
            <button
              onClick={refetch}
              className="px-4 py-2 border border-border bg-surface-elevated font-mono text-xs text-bone-muted hover:text-bone hover:border-border-active transition-colors cursor-pointer tracking-wide uppercase"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-bone">
          Dashboard
        </h2>
        <p className="font-mono text-xs text-bone-dim tracking-wide uppercase mt-2">
          System Health
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border">
        {[
          { label: "STATUS", value: "Healthy", variant: "mint" as const, dot: "healthy" as const },
          { label: "UPTIME", value: uptimeDisplay, variant: "default" as const, dot: null },
          { label: "VERSION", value: `v${health.version}`, variant: "ghost" as const, dot: null },
          { label: "DOCUMENTS", value: docCount !== null ? String(docCount) : "...", variant: "default" as const, dot: null, icon: FileText },
        ].map((stat) => (
          <div key={stat.label} className="bg-void p-6 group hover:bg-surface transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[10px] text-bone-dim tracking-widest uppercase flex items-center gap-1.5">
                {stat.icon && <stat.icon className="w-3 h-3" />}
                {stat.label}
              </span>
              {stat.dot && <StatusDot status={stat.dot} />}
            </div>
            <p className="font-display text-2xl font-bold tracking-tight text-bone">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardDescription>Available REST handlers for ingestion and retrieval</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 space-y-px">
          {[
            { method: "GET", path: "/health", desc: "Status and uptime", variant: "mint" as const },
            { method: "POST", path: "/api/v1/ingest", desc: "Upload and index documents", variant: "default" as const },
            { method: "POST", path: "/api/v1/query", desc: "RAG-powered question answering", variant: "default" as const },
            { method: "GET", path: "/api/v1/documents", desc: "List indexed documents", variant: "default" as const },
            { method: "DELETE", path: "/api/v1/documents/{id}", desc: "Delete a document", variant: "heat" as const },
            { method: "GET", path: "/api/v1/mindmap/{id}", desc: "Chunk similarity graph", variant: "default" as const },
            { method: "POST", path: "/api/v1/flashcards", desc: "Generate AI flash cards", variant: "default" as const },
            { method: "GET", path: "/api/v1/conversations", desc: "Conversation history", variant: "default" as const },
            { method: "POST", path: "/api/v1/conversations", desc: "Create conversation", variant: "default" as const },
            { method: "GET", path: "/api/v1/analytics/stats", desc: "Usage analytics", variant: "mint" as const },
          ].map((ep) => (
            <div
              key={ep.path}
              className="flex items-center gap-4 px-4 py-3 bg-surface-elevated group hover:bg-surface transition-colors"
            >
              <Badge variant={ep.variant}>{ep.method}</Badge>
              <code className="font-mono text-xs text-bone tracking-tight">{ep.path}</code>
              <span className="text-xs text-bone-dim ml-auto">{ep.desc}</span>
              <ArrowRight className="w-3 h-3 text-bone-dim opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
