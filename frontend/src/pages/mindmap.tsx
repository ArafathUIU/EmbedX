import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMindmap, type MindmapNode } from "@/api/client";
import { GitGraph, X, Maximize2 } from "lucide-react";

interface SimNode extends MindmapNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  opacity: number;
  width: number;
  height: number;
}

interface SimEdge {
  source: SimNode;
  target: SimNode;
  score: number;
  opacity: number;
}

const DOTS = [
  "#b388ff", "#00e5a0", "#60a5fa", "#f472b6", "#facc15",
  "#a78bfa", "#34d399", "#fb923c", "#38bdf8", "#e879f9",
];

const PASTEL = "rgba(153,102,255,0.12)";
const BORDER = "rgba(153,102,255,0.28)";
const FILL_COLORS = [
  "rgba(153,102,255,0.14)", "rgba(0,229,160,0.12)", "rgba(96,165,250,0.12)",
  "rgba(244,114,182,0.12)", "rgba(250,204,21,0.10)", "rgba(167,139,250,0.14)",
  "rgba(52,211,153,0.12)", "rgba(251,146,60,0.12)", "rgba(56,189,248,0.12)",
  "rgba(232,121,249,0.12)",
];

function estimateSize(text: string) {
  const lineLength = 28;
  const lines = Math.ceil(text.length / lineLength);
  return {
    w: Math.min(Math.max(text.length * 5.5 + 24, 80), 220),
    h: Math.min(Math.max(lines * 15 + 18, 34), 72),
  };
}

function assignClusters(nodes: SimNode[], edges: SimEdge[]): void {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.source.id)?.push(e.target.id);
    adj.get(e.target.id)?.push(e.source.id);
  }
  const visited = new Set<string>();
  const clusters: string[][] = [];
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const c: string[] = [];
    const stack = [n.id];
    visited.add(n.id);
    while (stack.length) {
      const id = stack.pop()!;
      c.push(id);
      for (const nb of adj.get(id) || []) {
        if (!visited.has(nb)) { visited.add(nb); stack.push(nb); }
      }
    }
    clusters.push(c);
  }
  clusters.sort((a, b) => b.length - a.length);
  const idToIdx = new Map<string, number>();
  clusters.forEach((c, i) => c.forEach((id) => idToIdx.set(id, i)));
  for (const n of nodes) {
    const ci = idToIdx.get(n.id) ?? 0;
    n.color = DOTS[ci % DOTS.length];
  }
}

function layoutGraph(
  nodes: SimNode[],
  edges: SimEdge[],
  w: number,
  h: number,
  maxEdgesPerNode: number
): void {
  // Filter to strongest edges
  const nodeEdges = new Map<string, SimEdge[]>();
  for (const n of nodes) nodeEdges.set(n.id, []);
  for (const e of edges) {
    nodeEdges.get(e.source.id)?.push(e);
    nodeEdges.get(e.target.id)?.push(e);
  }
  const keptEdges: SimEdge[] = [];
  const usedEdges = new Set<SimEdge>();
    for (const [, es] of nodeEdges) {
    es.sort((a, b) => b.score - a.score);
    for (let i = 0; i < Math.min(es.length, maxEdgesPerNode); i++) {
      if (!usedEdges.has(es[i])) {
        usedEdges.add(es[i]);
        keptEdges.push(es[i]);
      }
    }
  }

  // Place in a wide ring, grouped by cluster
  const cx = w / 2;
  const cy = h / 2;
  const spread = Math.min(w, h) * 0.4;
  const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1);
  for (let i = 0; i < nodes.length; i++) {
    const angle = angleStep * i - Math.PI / 2;
    nodes[i].x = cx + Math.cos(angle) * spread + (Math.random() - 0.5) * 20;
    nodes[i].y = cy + Math.sin(angle) * spread + (Math.random() - 0.5) * 20;
    nodes[i].vx = 0;
    nodes[i].vy = 0;
  }

  // Fast convergence simulation
  const activeEdges = keptEdges;
  for (let iter = 0; iter < 400; iter++) {
    const alpha = Math.max(0.01, 0.6 * Math.exp(-iter / 150));

    // Center gravity
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.001 * alpha;
      n.vy += (cy - n.y) * 0.001 * alpha;
    }

    // Edge attraction
    for (const e of activeEdges) {
      const dx = e.target.x - e.source.x;
      const dy = e.target.y - e.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDist = 130 + e.source.width / 2 + e.target.width / 2;
      const force = (dist - targetDist) * 0.015 * e.score;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      e.source.vx += fx * alpha;
      e.source.vy += fy * alpha;
      e.target.vx -= fx * alpha;
      e.target.vy -= fy * alpha;
    }

    // Node repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = nodes[i].width / 2 + nodes[j].width / 2 + 55;
        if (dist < minDist) {
          const force = (minDist - dist) * 0.04;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx; nodes[i].vy -= fy;
          nodes[j].vx += fx; nodes[j].vy += fy;
        }
      }
    }

    // Damping + bounds
    for (const n of nodes) {
      n.vx *= 0.4;
      n.vy *= 0.4;
      n.x += n.vx;
      n.y += n.vy;
      const hw = n.width / 2 + 10;
      const hh = n.height / 2 + 10;
      n.x = Math.max(hw, Math.min(w - hw, n.x));
      n.y = Math.max(hh, Math.min(h - hh, n.y));
    }
  }
}

export default function Mindmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [documentId, setDocumentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState<SimNode | null>(null);
  const [ready, setReady] = useState(false);
  const simNodes = useRef<SimNode[]>([]);
  const simEdges = useRef<SimEdge[]>([]);
  const animRef = useRef<number>(0);

  const load = useCallback(async () => {
    if (!documentId.trim()) return;
    setLoading(true);
    setError(null);
    setReady(false);
    setSelectedNode(null);
    try {
      const data = await fetchMindmap(documentId, 0.35);
      if (data.nodes.length === 0) { setError("No chunks found"); return; }

      setComputing(true);
      await new Promise((r) => setTimeout(r, 30));

      const w = canvasRef.current?.width ?? 1200;
      const h = canvasRef.current?.height ?? 800;
      const sizeCache = new Map<string, { w: number; h: number }>();

      const simN: SimNode[] = data.nodes.map((n) => {
        const sz = estimateSize(n.text);
        sizeCache.set(n.id, sz);
        return {
          ...n, x: 0, y: 0, vx: 0, vy: 0,
          radius: 6, color: DOTS[0], opacity: 1,
          width: sz.w, height: sz.h,
        };
      });

      const idMap = new Map(simN.map((n) => [n.id, n]));
      const allEdges: SimEdge[] = [];
      for (const e of data.edges) {
        const s = idMap.get(e.source);
        const t = idMap.get(e.target);
        if (s && t) allEdges.push({ source: s, target: t, score: e.score, opacity: 1 });
      }

      assignClusters(simN, allEdges);
      layoutGraph(simN, allEdges, w, h, 3);

      simNodes.current = simN;
      simEdges.current = allEdges;
      setComputing(false);
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  }, [documentId]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(offset.x + w / 2, offset.y + h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);

    const n = simNodes.current;
    const e = simEdges.current;

    // draw all edges
    for (const edge of e) {
      if (edge.opacity < 0.03) continue;
      const a = edge.opacity * (0.05 + edge.score * 0.22);
      ctx.beginPath();
      ctx.moveTo(edge.source.x, edge.source.y);
      ctx.lineTo(edge.target.x, edge.target.y);
      ctx.strokeStyle = `rgba(153,102,255,${a.toFixed(3)})`;
      ctx.lineWidth = 0.6 + edge.score * 1.2 * edge.opacity;
      ctx.stroke();
    }

    // draw all nodes
    for (const node of n) {
      if (node.opacity < 0.05) continue;
      const isHov = hoveredNode?.id === node.id;
      const isSel = selectedNode?.id === node.id;
      const hw = node.width / 2;
      const hh = node.height / 2;
      const rx = 14;
      const x = node.x - hw, y = node.y - hh;

      ctx.globalAlpha = node.opacity;

      // subtle shadow
      if (isHov || isSel) {
        ctx.shadowColor = `${node.color}40`;
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 3;
      }

      // rounded pill
      const ci = DOTS.indexOf(node.color);
      const fill = (isHov || isSel) ? FILL_COLORS[Math.max(ci, 0) % FILL_COLORS.length] : PASTEL;
      const stroke = (isHov || isSel) ? node.color : BORDER;

      ctx.beginPath();
      ctx.moveTo(x + rx, y);
      ctx.lineTo(x + node.width - rx, y);
      ctx.quadraticCurveTo(x + node.width, y, x + node.width, y + rx);
      ctx.lineTo(x + node.width, y + node.height - rx);
      ctx.quadraticCurveTo(x + node.width, y + node.height, x + node.width - rx, y + node.height);
      ctx.lineTo(x + rx, y + node.height);
      ctx.quadraticCurveTo(x, y + node.height, x, y + node.height - rx);
      ctx.lineTo(x, y + rx);
      ctx.quadraticCurveTo(x, y, x + rx, y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = isHov || isSel ? 1.4 : 0.7;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      // dot
      ctx.beginPath();
      ctx.arc(x + 11, y + 11, 3, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // text
      const lines = node.text.match(/.{1,28}/g) || [node.text];
      ctx.fillStyle = "#bab5c4";
      ctx.font = `${isSel ? 500 : 400} 10px "Manrope", system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const startY = node.y - ((lines.length - 1) * 13) / 2;
      const maxLines = Math.min(lines.length, 4);
      for (let i = 0; i < maxLines; i++) {
        const txt = i === 3 && lines.length > 4 ? lines[i].slice(0, 27) + "\u2026" : lines[i];
        ctx.fillText(txt, x + 18, startY + i * 13);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }, [hoveredNode, selectedNode, zoom, offset]);

  useEffect(() => {
    if (!ready) return;
    let running = true;
    const loop = () => {
      if (!running) return;
      render();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [ready, render]);

  const screenToWorld = useCallback((ex: number, ey: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (ex - rect.left - offset.x - canvas.width / 2) / zoom + canvas.width / 2,
      y: (ey - rect.top - offset.y - canvas.height / 2) / zoom + canvas.height / 2,
    };
  }, [offset, zoom]);

  const hitTest = (wx: number, wy: number): SimNode | null => {
    for (const node of simNodes.current) {
      if (Math.abs(wx - node.x) < node.width / 2 + 6 && Math.abs(wy - node.y) < node.height / 2 + 6) {
        return node;
      }
    }
    return null;
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    if (dragging && dragNode) {
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      dragNode.x = x; dragNode.y = y;
      return;
    }
    if (dragging) {
      setOffset({ x: offset.x + e.clientX - dragStart.x, y: offset.y + e.clientY - dragStart.y });
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    setHoveredNode(hitTest(x, y));
  }, [ready, dragging, dragNode, dragStart, offset, zoom, screenToWorld]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const hit = hitTest(x, y);
    if (hit) {
      setDragNode(hit);
      setSelectedNode(hit);
      setDragging(true);
    } else {
      setDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [ready, screenToWorld]);

  const handleMouseUp = useCallback(() => {
    setDragging(false); setDragNode(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.25, Math.min(3, z * (1 - e.deltaY * 0.001))));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-bone">Notebook</h2>
        <p className="font-mono text-xs text-bone-dim tracking-wide uppercase mt-2">
          Topic Map &middot; NotebookLM-style
        </p>
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
        <Button onClick={load} loading={loading || computing} variant="mint" size="lg">
          <GitGraph className="w-4 h-4 mr-2" />Visualize
        </Button>
      </div>

      {error && <div className="p-4 bg-heat/5 border border-heat/30 font-mono text-xs text-heat">{error}</div>}

      {(loading || computing) && (
        <div className="border border-border bg-surface p-8 space-y-3">
          <Skeleton className="h-[640px]" />
          {computing && (
            <p className="text-center font-mono text-xs text-bone-dim animate-pulse">
              Computing layout...
            </p>
          )}
        </div>
      )}

      {ready && (
        <div className="border border-border bg-void relative overflow-hidden">
          <div className="absolute top-3 left-3 z-10 flex gap-px bg-border">
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(3, z * 1.25))}>
              <span className="font-mono text-xs">+</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))}>
              <span className="font-mono text-xs">&minus;</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
            <Badge variant="ghost">{simNodes.current.length} topics</Badge>
            <Badge variant="ghost">{simEdges.current.length} links</Badge>
          </div>

          {selectedNode && (
            <div className="absolute top-3 right-3 z-10 max-w-sm p-4 bg-surface border border-border shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedNode.color }} />
                  <span className="font-mono text-[10px] text-bone-dim tracking-widest uppercase">TOPIC</span>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-bone-dim hover:text-bone">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="font-body text-[13px] text-bone leading-relaxed max-h-48 overflow-y-auto scrollbar-thin pr-1">
                {selectedNode.full_text || selectedNode.text}
              </p>
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={1200}
            height={700}
            className="w-full h-[700px] cursor-grab"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { handleMouseUp(); setHoveredNode(null); }}
            onWheel={handleWheel}
          />
        </div>
      )}

      {!loading && !computing && !ready && !error && (
        <div className="border border-border bg-surface flex flex-col items-center justify-center py-32 text-center">
          <GitGraph className="w-14 h-14 text-bone-dim mb-4 opacity-15" />
          <p className="font-display text-sm text-bone-muted font-medium mb-1">No graph loaded</p>
          <p className="font-body text-xs text-bone-dim max-w-sm">
            Index a document, enter its ID above, and see the topic map with cleaned-up layout.
          </p>
        </div>
      )}
    </div>
  );
}
