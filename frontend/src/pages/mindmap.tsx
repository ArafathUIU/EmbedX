import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMindmap, type MindmapNode } from "@/api/client";
import { GitGraph, ZoomIn, ZoomOut, Maximize2, Search, X, Focus } from "lucide-react";

interface SimNode extends MindmapNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  opacity: number;
}

interface SimEdge {
  source: SimNode;
  target: SimNode;
  score: number;
  opacity: number;
}

const COLORS = [
  "#9966ff", "#00e5a0", "#ff8c42", "#60a5fa", "#f472b6",
  "#a78bfa", "#34d399", "#fb923c", "#38bdf8", "#e879f9",
];

function assignClusters(nodes: SimNode[], edges: SimEdge[]): void {
  const adj: Map<string, string[]> = new Map();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.source.id)?.push(e.target.id);
    adj.get(e.target.id)?.push(e.source.id);
  }

  const visited = new Set<string>();
  const clusters: string[][] = [];
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const cluster: string[] = [];
    const stack = [n.id];
    visited.add(n.id);
    while (stack.length) {
      const id = stack.pop()!;
      cluster.push(id);
      for (const nb of adj.get(id) || []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          stack.push(nb);
        }
      }
    }
    clusters.push(cluster);
  }

  const idToIdx = new Map<string, number>();
  clusters.forEach((c, i) => c.forEach((id) => idToIdx.set(id, i)));
  for (const n of nodes) {
    const ci = idToIdx.get(n.id) ?? 0;
    n.color = COLORS[ci % COLORS.length];
  }
}

export default function Mindmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [documentId, setDocumentId] = useState("");
  const [rawNodes, setRawNodes] = useState<MindmapNode[]>([]);
  const [rawEdges, setRawEdges] = useState<{ source: string; target: string; score: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [focusNode, setFocusNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState<SimNode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [simRunning, setSimRunning] = useState(false);
  const animFrame = useRef<number>(0);
  const simNodes = useRef<SimNode[]>([]);
  const simEdges = useRef<SimEdge[]>([]);
  const frameCount = useRef(0);

  const load = useCallback(async () => {
    if (!documentId.trim()) return;
    setLoading(true);
    setError(null);
    setFocusNode(null);
    try {
      const data = await fetchMindmap(documentId);
      if (data.nodes.length === 0) {
        setError("No chunks found");
        return;
      }
      setRawNodes(data.nodes);
      setRawEdges(data.edges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (rawNodes.length === 0) return;

    const w = canvasRef.current?.width ?? 1200;
    const h = canvasRef.current?.height ?? 800;
    const cx = w / 2;
    const cy = h / 2;
    const spread = Math.min(w, h) * 0.38;

    const simN: SimNode[] = rawNodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / rawNodes.length + Math.random() * 0.3;
      const r = spread * (0.2 + 0.8 * Math.random());
      const l = n.text.length;
      return {
        ...n,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0, vy: 0,
        radius: 4 + Math.min(l / 15, 12),
        color: COLORS[0],
        opacity: 1,
      };
    });

    const idMap = new Map(simN.map((n) => [n.id, n]));
    const simE: SimEdge[] = [];
    for (const e of rawEdges) {
      const s = idMap.get(e.source);
      const t = idMap.get(e.target);
      if (s && t) simE.push({ source: s, target: t, score: e.score, opacity: 1 });
    }

    assignClusters(simN, simE);

    simNodes.current = simN;
    simEdges.current = simE;
    setSimRunning(true);
    frameCount.current = 0;
  }, [rawNodes, rawEdges]);

  useEffect(() => {
    if (!simRunning) return;

    const run = () => {
      frameCount.current++;
      const n = simNodes.current;
      const e = simEdges.current;
      const w = canvasRef.current?.width ?? 1200;
      const h = canvasRef.current?.height ?? 800;
      const cx = w / 2;
      const cy = h / 2;

      if (frameCount.current < 600) {
        const cool = Math.max(0.01, 0.5 * Math.exp(-frameCount.current / 200));
        const alpha = cool;

        for (let i = 0; i < n.length; i++) {
          const a = n[i];
          if (a === dragNode) continue;
          const dx = cx - a.x;
          const dy = cy - a.y;
          a.vx += dx * 0.0008 * alpha;
          a.vy += dy * 0.0008 * alpha;
        }

        for (const edge of e) {
          const dx = edge.target.x - edge.source.x;
          const dy = edge.target.y - edge.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 130) * 0.015 * edge.score;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          edge.source.vx += fx * alpha;
          edge.source.vy += fy * alpha;
          edge.target.vx -= fx * alpha;
          edge.target.vy -= fy * alpha;
        }

        for (let i = 0; i < n.length; i++) {
          for (let j = i + 1; j < n.length; j++) {
            const dx = n[j].x - n[i].x;
            const dy = n[j].y - n[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const minDist = n[i].radius + n[j].radius + 35;
            if (dist < minDist) {
              const force = (minDist - dist) * 0.04;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              n[i].vx -= fx; n[i].vy -= fy;
              n[j].vx += fx; n[j].vy += fy;
            }
          }
        }

        for (const node of n) {
          if (node === dragNode) continue;
          node.vx *= 0.48;
          node.vy *= 0.48;
          node.x += node.vx;
          node.y += node.vy;
          node.x = Math.max(15, Math.min(w - 15, node.x));
          node.y = Math.max(15, Math.min(h - 15, node.y));
        }
      }

      // Update opacities based on focus
      const focused = focusNode;
      for (const node of n) {
        if (!focused) {
          node.opacity = 1;
        } else if (node.id === focused) {
          node.opacity = 1;
        } else {
          const connected = e.some(
            (ed) =>
              (ed.source.id === focused && ed.target.id === node.id) ||
              (ed.target.id === focused && ed.source.id === node.id)
          );
          node.opacity = connected ? 0.6 : 0.15;
        }
      }
      for (const edge of e) {
        if (!focused) {
          edge.opacity = 1;
        } else {
          edge.opacity =
            edge.source.id === focused || edge.target.id === focused ? 1 : 0.08;
        }
      }

      render();
      animFrame.current = requestAnimationFrame(run);
    };

    animFrame.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(animFrame.current);
  }, [simRunning, focusNode, dragNode]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(offset.x + w / 2, offset.y + h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);

    const n = simNodes.current;
    const e = simEdges.current;

    // edges
    for (const edge of e) {
      const a = edge.opacity * (0.08 + edge.score * 0.3);
      ctx.beginPath();
      ctx.moveTo(edge.source.x, edge.source.y);
      ctx.lineTo(edge.target.x, edge.target.y);
      ctx.strokeStyle = `rgba(153,102,255,${a.toFixed(3)})`;
      ctx.lineWidth = 0.5 + edge.score * 1.2 * edge.opacity;
      ctx.stroke();
    }

    // nodes
    for (const node of n) {
      const isHov = hoveredNode?.id === node.id;
      const isFoc = focusNode === node.id;
      const r = isHov || isFoc ? node.radius + 3 : node.radius;
      const a = node.opacity;

      // glow ring
      if (isHov || isFoc) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color}1a`;
        ctx.fill();
      }

      // node body
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
      const bright = isHov || isFoc ? node.color : `${node.color}cc`;
      const dark = `${node.color}55`;
      grad.addColorStop(0, bright);
      grad.addColorStop(1, dark);
      ctx.globalAlpha = a;
      ctx.fillStyle = grad;
      ctx.fill();

      // label for larger nodes or hovered
      if (isHov || isFoc || node.radius > 6) {
        const label = node.text.slice(0, 40) + (node.text.length > 40 ? "…" : "");
        ctx.globalAlpha = isHov || isFoc ? 1 : Math.min(1, a * 1.3);
        ctx.fillStyle = "#edeae2";
        ctx.font = `${isHov ? 12 : 10}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.fillText(label, node.x, node.y - r - 7);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [hoveredNode, focusNode, zoom, offset]);

  const screenToWorld = useCallback(
    (ex: number, ey: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const mx = (ex - rect.left - offset.x - canvas.width / 2) / zoom + canvas.width / 2;
      const my = (ey - rect.top - offset.y - canvas.height / 2) / zoom + canvas.height / 2;
      return { x: mx, y: my };
    },
    [offset, zoom]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragging && dragNode) {
        const { x, y } = screenToWorld(e.clientX, e.clientY);
        dragNode.x = x;
        dragNode.y = y;
        dragNode.vx = 0;
        dragNode.vy = 0;
        return;
      }
      if (dragging) {
        setOffset({
          x: offset.x + (e.clientX - dragStart.x),
          y: offset.y + (e.clientY - dragStart.y),
        });
        setDragStart({ x: e.clientX, y: e.clientY });
        return;
      }

      const { x, y } = screenToWorld(e.clientX, e.clientY);
      let found: SimNode | null = null;
      for (const node of simNodes.current) {
        const dx = node.x - x;
        const dy = node.y - y;
        if (dx * dx + dy * dy < (node.radius + 12) ** 2) {
          found = node;
          break;
        }
      }
      setHoveredNode(found);
    },
    [dragging, dragNode, dragStart, offset, zoom, screenToWorld]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      let hit: SimNode | null = null;
      for (const node of simNodes.current) {
        const dx = node.x - x;
        const dy = node.y - y;
        if (dx * dx + dy * dy < (node.radius + 12) ** 2) {
          hit = node;
          break;
        }
      }
      if (hit) {
        setDragNode(hit);
        setFocusNode(hit.id);
        setDragging(true);
      } else {
        setDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    },
    [screenToWorld]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    setDragNode(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.2, Math.min(4, z * (1 - e.deltaY * 0.001))));
  }, []);

  const handleDblClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      let hit: SimNode | null = null;
      for (const node of simNodes.current) {
        const dx = node.x - x;
        const dy = node.y - y;
        if (dx * dx + dy * dy < (node.radius + 12) ** 2) {
          hit = node;
          break;
        }
      }
      setFocusNode(hit?.id ?? null);
    },
    [screenToWorld]
  );

  const filteredNodeIds = searchTerm
    ? new Set(
        simNodes.current
          .filter((n) => n.text.toLowerCase().includes(searchTerm.toLowerCase()))
          .map((n) => n.id)
      )
    : null;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-bone">
            Graph
          </h2>
          <p className="font-mono text-xs text-bone-dim tracking-wide uppercase mt-2">
            Semantic Constellation &middot; Obsidian-style
          </p>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="font-mono text-[10px] text-bone-dim tracking-widest uppercase mb-1.5 block">
            Document ID
          </label>
          <Input
            placeholder="Enter document ID..."
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <Button onClick={load} loading={loading} variant="mint" size="lg">
          <GitGraph className="w-4 h-4 mr-2" />
          Visualize
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-heat/5 border border-heat/30 font-mono text-xs text-heat">
          {error}
        </div>
      )}

      {loading && (
        <div className="border border-border bg-surface p-8">
          <Skeleton className="h-[640px]" />
        </div>
      )}

      {!loading && simNodes.current.length > 0 && (
        <div className="border border-border bg-void relative overflow-hidden">
          {/* Toolbar */}
          <div className="absolute top-3 left-3 z-10 flex gap-px bg-border">
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(4, z * 1.25))}>
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.2, z / 1.25))}>
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
            {focusNode && (
              <Button variant="ghost" size="sm" onClick={() => setFocusNode(null)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="absolute top-3 right-3 z-10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-bone-dim absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter nodes..."
                className="w-48 h-9 pl-9 pr-3 bg-surface border border-border font-mono text-xs text-bone placeholder:text-bone-dim focus:outline-none focus:border-violet/60"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-bone-dim hover:text-bone"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Hover details */}
          {hoveredNode && (
            <div className="absolute bottom-3 left-3 right-3 z-10 max-w-lg p-3.5 bg-surface border border-border shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5"
                    style={{ backgroundColor: hoveredNode.color, clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
                  />
                  <span className="font-mono text-[10px] text-bone-dim tracking-widest uppercase">
                    CHUNK
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFocusNode(focusNode === hoveredNode.id ? null : hoveredNode.id)}
                    className="flex items-center gap-1 font-mono text-[10px] text-violet-bright hover:text-violet tracking-wide uppercase cursor-pointer"
                  >
                    <Focus className="w-3 h-3" />
                    {focusNode === hoveredNode.id ? "Unfocus" : "Focus"}
                  </button>
                </div>
              </div>
              <p className="font-body text-[13px] text-bone leading-relaxed line-clamp-3">
                {hoveredNode.full_text || hoveredNode.text}
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
            <Badge variant="ghost">{simNodes.current.length} nodes</Badge>
            <Badge variant="ghost">{simEdges.current.length} edges</Badge>
            {focusNode && <Badge variant="default">focused</Badge>}
          </div>

          <canvas
            ref={canvasRef}
            width={1200}
            height={700}
            className="w-full h-[700px] cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { handleMouseUp(); setHoveredNode(null); }}
            onWheel={handleWheel}
            onDoubleClick={handleDblClick}
          />

          {/* Search results - dim non-matching */}
          {filteredNodeIds && (
            <style>{`
              @keyframes filter-in { to { opacity: 1; } }
            `}</style>
          )}
        </div>
      )}

      {!loading && simNodes.current.length === 0 && !error && (
        <div className="border border-border bg-surface flex flex-col items-center justify-center py-32 text-center">
          <GitGraph className="w-14 h-14 text-bone-dim mb-4 opacity-15" />
          <p className="font-display text-sm text-bone-muted font-medium mb-1">
            No graph loaded
          </p>
          <p className="font-body text-xs text-bone-dim max-w-sm">
            Upload and index a document, then enter its ID above.
            Similar chunks connect as edges — drag nodes, zoom, and click to focus.
          </p>
        </div>
      )}
    </div>
  );
}
