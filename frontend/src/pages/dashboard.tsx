import { useState, useEffect } from "react";
import { useHealth } from "@/hooks/use-health";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Clock, Server, Zap } from "lucide-react";

export default function Dashboard() {
  const { data: health, isLoading, error, refetch } = useHealth();
  const [uptimeDisplay, setUptimeDisplay] = useState("");

  useEffect(() => {
    if (health?.uptime_seconds) {
      const h = Math.floor(health.uptime_seconds / 3600);
      const m = Math.floor((health.uptime_seconds % 3600) / 60);
      const s = Math.floor(health.uptime_seconds % 60);
      setUptimeDisplay(`${h}h ${m}m ${s}s`);
    }
  }, [health?.uptime_seconds]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-20" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-text-secondary mt-1">System overview and health status</p>
        </div>
        <Card className="border-error/20 bg-error/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
              <Server className="w-5 h-5 text-error" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-error">API is unavailable</p>
              <p className="text-sm text-text-secondary">{error}</p>
            </div>
            <button
              onClick={refetch}
              className="px-4 py-2 rounded-xl bg-surface-hover text-sm hover:bg-border transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const statusCards = [
    {
      icon: Activity,
      label: "Status",
      value: health.status === "ok" ? "Healthy" : "Issues",
      variant: "success" as const,
    },
    {
      icon: Clock,
      label: "Uptime",
      value: uptimeDisplay,
      variant: "default" as const,
    },
    {
      icon: Zap,
      label: "Version",
      value: `v${health.version}`,
      variant: "default" as const,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-text-secondary mt-1">System overview and health status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statusCards.map((card) => (
          <Card key={card.label} className="hover:border-border-hover transition-colors">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <card.icon className="w-5 h-5 text-accent" />
              </div>
              {card.variant === "success" && (
                <Badge variant="success">
                  <StatusDot status="healthy" />
                  <span className="ml-1.5">Active</span>
                </Badge>
              )}
            </div>
            <div className="mt-4">
              <p className="text-sm text-text-secondary">{card.label}</p>
              <p className="text-2xl font-bold mt-1">{card.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Endpoints</CardTitle>
          <CardDescription>Available REST endpoints for document ingestion and querying</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          {[
            { method: "GET", path: "/health", desc: "Health check with version and uptime" },
            { method: "POST", path: "/api/v1/ingest", desc: "Upload and index a document" },
            { method: "POST", path: "/api/v1/query", desc: "Ask a RAG-powered question" },
          ].map((ep) => (
            <div
              key={ep.path}
              className="flex items-center gap-4 p-3 rounded-xl bg-surface-hover border border-transparent hover:border-border transition-all"
            >
              <Badge
                variant={ep.method === "GET" ? "success" : "default"}
              >
                {ep.method}
              </Badge>
              <code className="text-sm text-text-primary font-mono">{ep.path}</code>
              <span className="text-sm text-text-secondary ml-auto">{ep.desc}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
