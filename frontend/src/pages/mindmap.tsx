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
  collapsed: boolean;
}

interface SimEdge {
  source: SimNode;
  target: SimNode;
  score: number;
  opacity: number;
}

const PASTELS = [
  "rgba(153,102,255,0.18)", "rgba(0,229,160,0.16)", "rgba(96,165,250,0.16)",
  "rgba(244,114,182,0.16)", "rgba(250,204,21,0.14)", "rgba(167,139,250,0.18)",
  "rgba(52,211,153,0.16)", "rgba(251,146,60,0.16)", "rgba(56,189,248,0.16)",
  "rgba(232,121,249,0.16)",
];

const BORDERS = [
  "rgba(153,102,255,0.35)", "rgba(0,229,160,0.35)", "rgba(96,165,250,0.35)",
  "rgba(244,114,182,0.35)", "rgba(250,204,21,0.30)", "rgba(167,139,250,0.35)",
  "rgba(52,211,153,0.35)", "rgba(251,146,60,0.35)", "rgba(56,189,248,0.35)",
  "rgba(232,121,249,0.35)",
];

const DOTS = [
  "#b388ff", "#00e5a0", "#60a5fa", "#f472b6", "#facc15",
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
  const idToIdx = new Map<string, number>();
  clusters.forEach((c, i) => c.forEach((id) => idToIdx.set(id, i)));
  for (const n of nodes) {
    const ci = idToIdx.get(n.id) ?? 0;
    n.color = DOTS[ci % DOTS.length];
  }
}

function estimateNodeSize(text: string) {
  const lineLength = 28;
  const lines = Math.ceil(text.length / lineLength);
  const w = Math.min(Math.max(text.length * 5.5 + 24, 80), 240);
  const h = Math.min(Math.max(lines * 16 + 20, 36), 80);
  return { w, h };
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
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState<SimNode | null>(null);
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
    setSelectedNode(null);
    try {
      const data = await fetchMindmap(documentId);
      if (data.nodes.length === 0) { setError("No chunks found"); return; }
      setRawNodes(data.nodes);
      setRawEdges(data.edges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
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
      const r = spread * (0.15 + 0.85 * Math.random());
      const size = estimateNodeSize(n.text);
      return {
        ...n, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r,
        vx: 0, vy: 0, radius: 6,
        color: DOTS[0], opacity: 1,
        width: size.w, height: size.h, collapsed: false,
      };
    });

    const idMap = new Map(simN.map((n) => [n.id, n]));
    const simE: SimEdge[] = [];
    for (const e of rawEdges) {
      const s = idMap.get(e.source); const t = idMap.get(e.target);
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

      if (frameCount.current < 800) {
        const alpha = Math.max(0.008, 0.45 * Math.exp(-frameCount.current / 220));
        for (let i = 0; i < n.length; i++) {
          const a = n[i];
          if (a === dragNode) continue;
          a.vx += (cx - a.x) * 0.0006 * alpha;
          a.vy += (cy - a.y) * 0.0006 * alpha;
        }
        for (const edge of e) {
          const dx = edge.target.x - edge.source.x;
          const dy = edge.target.y - edge.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 140 + edge.source.width / 2 + edge.target.width / 2;
          const force = (dist - targetDist) * 0.012 * edge.score;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          edge.source.vx += fx * alpha; edge.source.vy += fy * alpha;
          edge.target.vx -= fx * alpha; edge.target.vy -= fy * alpha;
        }
        for (let i = 0; i < n.length; i++) {
          for (let j = i + 1; j < n.length; j++) {
            const dx = n[j].x - n[i].x;
            const dy = n[j].y - n[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const minDist = n[i].width / 2 + n[j].width / 2 + 30;
            if (dist < minDist) {
              const force = (minDist - dist) * 0.03;
              const fx = (dx / dist) * force; const fy = (dy / dist) * force;
              n[i].vx -= fx; n[i].vy -= fy; n[j].vx += fx; n[j].vy += fy;
            }
          }
        }
        for (const node of n) {
          if (node === dragNode) continue;
          node.vx *= 0.45; node.vy *= 0.45;
          node.x += node.vx; node.y += node.vy;
          const hw = node.width / 2 + 10;
          const hh = node.height / 2 + 10;
          node.x = Math.max(hw, Math.min(w - hw, node.x));
          node.y = Math.max(hh, Math.min(h - hh, node.y));
        }
      }

      const focused = focusNode;
      for (const node of n) {
        if (!focused) { node.opacity = 1; } else if (node.id === focused) {
          node.opacity = 1;
        } else {
          const conn = e.some((ed) =>
            (ed.source.id === focused && ed.target.id === node.id) ||
            (ed.target.id === focused && ed.source.id === node.id));
          node.opacity = conn ? 0.6 : 0.12;
        }
      }
      for (const edge of e) {
        if (!focused) { edge.opacity = 1; }
        else { edge.opacity = edge.source.id === focused || edge.target.id === focused ? 1 : 0.05; }
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
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(offset.x + w / 2, offset.y + h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);

    const n = simNodes.current;
    const e = simEdges.current;

    // edges
    for (const edge of e) {
      const a = edge.opacity * (0.06 + edge.score * 0.25);
      if (a < 0.02) continue;
      const sx = edge.source.x, sy = edge.source.y;
      const tx = edge.target.x, ty = edge.target.y;
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my - 15 * edge.score, tx, ty);
      ctx.strokeStyle = `rgba(153,102,255,${a.toFixed(3)})`;
      ctx.lineWidth = 0.8 + edge.score * 1.4 * edge.opacity;
      ctx.stroke();
    }

    // nodes — NotebookLM pill bubbles
    for (const node of n) {
      if (node.opacity < 0.05) continue;
      const isHov = hoveredNode?.id === node.id;
      const isFoc = focusNode === node.id;
      const isSel = selectedNode?.id === node.id;
      const hw = node.width / 2;
      const hh = node.height / 2;
      const rx = 16;

      ctx.globalAlpha = node.opacity;

      // shadow
      if (isHov || isFoc || isSel) {
        ctx.shadowColor = `${node.color}40`;
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 4;
      } else {
        ctx.shadowColor = "rgba(0,0,0,0.15)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
      }

      // pill background
      const ci = DOTS.indexOf(node.color);
      const fill = PASTELS[ci % PASTELS.length];
      const stroke = isHov || isFoc || isSel
        ? node.color
        : BORDERS[ci % BORDERS.length];

      ctx.beginPath();
      const x = node.x - hw, y = node.y - hh;
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
      ctx.lineWidth = isHov || isFoc ? 1.5 : 0.8;
      ctx.stroke();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // indicator dot
      ctx.beginPath();
      ctx.arc(x + 12, y + 12, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // text
      const lines = node.text.match(/.{1,28}/g) || [node.text];
      const fontSize = isSel ? 11.5 : 10.5;
      ctx.fillStyle = "#c8c4d0";
      ctx.font = `${isSel || isHov ? 500 : 400} ${fontSize}px "Manrope", system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const startY = node.y - ((lines.length - 1) * 14) / 2;
      for (let i = 0; i < Math.min(lines.length, 4); i++) {
        const line = i === 3 && lines.length > 4 ? lines[i].slice(0, 27) + "…" : lines[i];
        ctx.fillText(line, x + 20, startY + i * 14);
      }

      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [hoveredNode, focusNode, selectedNode, zoom, offset]);

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
      const hw = node.width / 2 + 6;
      const hh = node.height / 2 + 6;
      if (Math.abs(wx - node.x) < hw && Math.abs(wy - node.y) < hh) return node;
    }
    return null;
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging && dragNode) {
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      dragNode.x = x; dragNode.y = y; dragNode.vx = 0; dragNode.vy = 0;
      return;
    }
    if (dragging) {
      setOffset({ x: offset.x + e.clientX - dragStart.x, y: offset.y + e.clientY - dragStart.y });
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    setHoveredNode(hitTest(x, y));
  }, [dragging, dragNode, dragStart, offset, zoom, screenToWorld]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const hit = hitTest(x, y);
    if (hit) {
      setDragNode(hit);
      setFocusNode(hit.id);
      setSelectedNode(hit);
      setDragging(true);
    } else {
      setDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [screenToWorld]);

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
          Topic Map &middot; Pill Bubbles &middot; NotebookLM-style
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
        <Button onClick={load} loading={loading} variant="mint" size="lg">
          <GitGraph className="w-4 h-4 mr-2" />Visualize
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-heat/5 border border-heat/30 font-mono text-xs text-heat">{error}</div>
      )}

      {loading && (
        <div className="border border-border bg-surface p-8"><Skeleton className="h-[640px]" /></div>
      )}

      {!loading && simNodes.current.length > 0 && (
        <div className="border border-border bg-void relative overflow-hidden">
          <div className="absolute top-3 left-3 z-10 flex gap-px bg-border">
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(3, z * 1.25))}>
              <span className="font-mono text-xs">+</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))}>
              <span className="font-mono text-xs">−</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
            {focusNode && (
              <Button variant="ghost" size="sm" onClick={() => { setFocusNode(null); setSelectedNode(null); }}>
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
            <Badge variant="ghost">{simNodes.current.length} topics</Badge>
            <Badge variant="ghost">{simEdges.current.length} links</Badge>
            {selectedNode && <Badge variant="default">selected</Badge>}
          </div>

          {/* Selected detail panel (NotebookLM-style sidecard) */}
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
              {focusNode === selectedNode.id && (
                <p className="font-mono text-[10px] text-violet-bright mt-2 tracking-wide uppercase">
                  Focused — showing connected topics
                </p>
              )}
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
            onDoubleClick={(e) => {
              const { x, y } = screenToWorld(e.clientX, e.clientY);
              const hit = hitTest(x, y);
              setFocusNode(hit ? (focusNode === hit.id ? null : hit.id) : null);
            }}
          />
        </div>
      )}

      {!loading && simNodes.current.length === 0 && !error && (
        <div className="border border-border bg-surface flex flex-col items-center justify-center py-32 text-center">
          <GitGraph className="w-14 h-14 text-bone-dim mb-4 opacity-15" />
          <p className="font-display text-sm text-bone-muted font-medium mb-1">No graph loaded</p>
          <p className="font-body text-xs text-bone-dim max-w-sm">
            Index a document, enter its ID, and visualize the topic map.
            Each pill represents a chunk — drag, zoom, click to explore.
          </p>
        </div>
      )}
    </div>
  );
}
