import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAnalyticsStats, type AnalyticsStats } from "@/api/client";
import {
  BarChart3, MessageSquare, Clock, Layers, TrendingUp, Zap, Database,
} from "lucide-react";

export default function Analytics() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalyticsStats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in-up">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-void p-6"><Skeleton className="h-16" /></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 animate-fade-in-up">
        <h2 className="font-display text-2xl font-bold tracking-tight text-bone">Analytics</h2>
        <Card className="border-heat/30 bg-heat/5 p-6">
          <p className="font-display text-sm text-heat">Failed to load analytics: {error}</p>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { icon: MessageSquare, label: "Total Queries", value: stats.total_queries, variant: "default" as const },
    { icon: TrendingUp, label: "Unique Questions", value: stats.unique_questions, variant: "default" as const },
    { icon: Clock, label: "Avg Latency", value: `${stats.avg_latency_ms}ms`, variant: "default" as const },
    { icon: Layers, label: "Avg Chunks/Query", value: stats.avg_chunks_per_query.toFixed(1), variant: "default" as const },
    { icon: Zap, label: "Queries Today", value: stats.queries_today, variant: "mint" as const },
    { icon: Zap, label: "Queries This Hour", value: stats.queries_this_hour, variant: "mint" as const },
    { icon: Database, label: "Docs Queried", value: stats.total_documents_queried, variant: "default" as const },
  ];

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-bone">Analytics</h2>
        <p className="font-mono text-xs text-bone-dim tracking-wide uppercase mt-2">
          Usage &middot; Performance &middot; Insights
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-px bg-border">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-void p-6 group hover:bg-surface transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <stat.icon className="w-4 h-4 text-bone-dim" />
              <span className="font-mono text-[10px] text-bone-dim tracking-widest uppercase">
                {stat.label}
              </span>
            </div>
            <p className="font-display text-2xl font-bold tracking-tight text-bone">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {stats.top_questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-violet-bright" />
                Top Questions
              </div>
            </CardTitle>
          </CardHeader>
          <div className="px-6 pb-6 space-y-px">
            {stats.top_questions.map((q, i) => {
              const maxCount = stats.top_questions[0].count;
              const pct = maxCount > 0 ? (q.count / maxCount) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-4 px-4 py-3 bg-surface-elevated">
                  <span className="font-mono text-[10px] text-bone-dim w-5">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-bone truncate">{q.question}</p>
                    <div className="mt-1 h-1.5 bg-void overflow-hidden">
                      <div
                        className="h-full bg-violet/60 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-mono text-xs text-bone-dim tabular-nums">{q.count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {stats.total_queries === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BarChart3 className="w-12 h-12 text-bone-dim mb-4 opacity-30" />
          <h3 className="font-display text-lg font-semibold text-bone tracking-tight mb-2">
            No data yet
          </h3>
          <p className="text-sm text-bone-muted font-body max-w-sm">
            Query data will appear here after you ask questions in the Query page.
          </p>
        </div>
      )}
    </div>
  );
}
