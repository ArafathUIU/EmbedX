import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMindmap, type MindmapNode } from "@/api/client";
import { GitGraph, X, Maximize2, Link2 } from "lucide-react";

interface SimNode extends MindmapNode {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  width: number; height: number;
}

interface SimEdge {
  source: SimNode;
  target: SimNode;
  score: number;
}

const DOTS = [
  "#b388ff", "#00e5a0", "#60a5fa", "#f472b6", "#facc15",
  "#a78bfa", "#34d399", "#fb923c", "#38bdf8", "#e879f9",
];

const EDGE_MAX = 2;
const REPULSE = 120;
const SIM_ITERS = 600;
const THRESHOLD = 0.4;

function estimateSize(text: string) {
  const lines = Math.ceil(text.length / 28);
  return {
    w: Math.min(Math.max(text.length * 5.2 + 30, 85), 200),
    h: Math.min(Math.max(lines * 14 + 18, 32), 68),
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
  for (const n of nodes) n.color = DOTS[(idToIdx.get(n.id) ?? 0) % DOTS.length];
}

function layoutGraph(
  nodes: SimNode[],
  edges: SimEdge[],
  w: number, h: number
): void {
  const cx = w / 2;
  const cy = h / 2;
  const spread = Math.min(w, h) * 0.44;

  // Ring start
  for (let i = 0; i < nodes.length; i++) {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    nodes[i].x = cx + Math.cos(angle) * spread;
    nodes[i].y = cy + Math.sin(angle) * spread;
    nodes[i].vx = 0; nodes[i].vy = 0;
  }

  // Simulation
  for (let iter = 0; iter < SIM_ITERS; iter++) {
    const alpha = Math.max(0.005, 0.5 * Math.exp(-iter / 120));

    for (const e of edges) {
      const dx = e.target.x - e.source.x;
      const dy = e.target.y - e.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = 100 + e.source.width / 2 + e.target.width / 2;
      const force = (dist - target) * 0.01 * e.score;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      e.source.vx += fx * alpha; e.source.vy += fy * alpha;
      e.target.vx -= fx * alpha; e.target.vy -= fy * alpha;
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = a.width / 2 + b.width / 2 + REPULSE;
        if (dist < minDist) {
          const force = (minDist - dist) * 0.03;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }
    }

    for (const n of nodes) {
      n.vx *= 0.35; n.vy *= 0.35;
      n.x += n.vx; n.y += n.vy;
      const hw = n.width / 2 + 15;
      const hh = n.height / 2 + 15;
      n.x = Math.max(hw, Math.min(w - hw, n.x));
      n.y = Math.max(hh, Math.min(h - hh, n.y));
    }
  }
}

export default function Mindmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [documentId, setDocumentId] = useState(
    () => sessionStorage.getItem("embedx_last_doc") || ""
  );
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [zoom, setZoom] = useState(0.75);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState<SimNode | null>(null);
  const [ready, setReady] = useState(false);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<SimEdge[]>([]);
  const animRef = useRef<number>(0);

  const doLoad = useCallback(async (docId: string) => {
    if (!docId.trim()) return;
    setLoading(true); setError(null); setReady(false); setSelectedNode(null);
    try {
      const data = await fetchMindmap(docId, THRESHOLD);
      if (data.nodes.length === 0) { setError("No chunks found"); return; }
      setComputing(true);
      await new Promise((r) => setTimeout(r, 30));

      const w = canvasRef.current?.width ?? 1200;
      const h = canvasRef.current?.height ?? 800;

      const simN: SimNode[] = data.nodes.map((n) => ({
        ...n, x: 0, y: 0, vx: 0, vy: 0,
        color: DOTS[0],
        width: estimateSize(n.text).w,
        height: estimateSize(n.text).h,
      }));

      const idMap = new Map(simN.map((n) => [n.id, n]));
      const allEdges: SimEdge[] = [];
      for (const e of data.edges) {
        const s = idMap.get(e.source); const t = idMap.get(e.target);
        if (s && t) allEdges.push({ source: s, target: t, score: e.score });
      }

      // Keep only top edges per node
      const byNode = new Map<string, SimEdge[]>();
      for (const n of simN) byNode.set(n.id, []);
      for (const e of allEdges) {
        byNode.get(e.source.id)?.push(e);
        byNode.get(e.target.id)?.push(e);
      }
      const kept = new Set<SimEdge>();
      for (const [, es] of byNode) {
        es.sort((a, b) => b.score - a.score);
        for (let i = 0; i < Math.min(es.length, EDGE_MAX); i++) kept.add(es[i]);
      }
      const filteredEdges = [...kept];

      assignClusters(simN, filteredEdges);
      layoutGraph(simN, filteredEdges, w, h);

      nodesRef.current = simN;
      edgesRef.current = filteredEdges;
      setComputing(false); setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  }, []);

  // Auto-load from sessionStorage on mount
  useEffect(() => {
    const lastDoc = sessionStorage.getItem("embedx_last_doc");
    if (lastDoc) {
      setDocumentId(lastDoc);
      doLoad(lastDoc);
    }
  }, [doLoad]);

  const load = useCallback(() => {
    if (!documentId.trim()) return;
    sessionStorage.setItem("embedx_last_doc", documentId);
    doLoad(documentId);
  }, [documentId, doLoad]);

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

    for (const e of edgesRef.current) {
      const a = 0.04 + e.score * 0.18;
      ctx.beginPath();
      ctx.moveTo(e.source.x, e.source.y);
      ctx.lineTo(e.target.x, e.target.y);
      ctx.strokeStyle = `rgba(153,102,255,${a.toFixed(3)})`;
      ctx.lineWidth = 0.5 + e.score * 1;
      ctx.stroke();
    }

    for (const node of nodesRef.current) {
      const isHov = hoveredNode?.id === node.id;
      const isSel = selectedNode?.id === node.id;
      const hw = node.width / 2, hh = node.height / 2;
      const rx = 12;

      if (isHov || isSel) {
        ctx.shadowColor = `${node.color}30`;
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 2;
      }

      const x = node.x - hw, y = node.y - hh;
      ctx.beginPath();
      ctx.moveTo(x + rx, y); ctx.lineTo(x + node.width - rx, y);
      ctx.quadraticCurveTo(x + node.width, y, x + node.width, y + rx);
      ctx.lineTo(x + node.width, y + node.height - rx);
      ctx.quadraticCurveTo(x + node.width, y + node.height, x + node.width - rx, y + node.height);
      ctx.lineTo(x + rx, y + node.height);
      ctx.quadraticCurveTo(x, y + node.height, x, y + node.height - rx);
      ctx.lineTo(x, y + rx); ctx.quadraticCurveTo(x, y, x + rx, y);
      ctx.closePath();

      ctx.fillStyle = isHov || isSel
        ? `${node.color}18` : "rgba(153,102,255,0.08)";
      ctx.fill();
      ctx.strokeStyle = isHov || isSel ? node.color : "rgba(153,102,255,0.22)";
      ctx.lineWidth = isHov || isSel ? 1.3 : 0.6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Dot
      ctx.beginPath(); ctx.arc(x + 10, y + 10, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = node.color; ctx.fill();

      // Label
      const lines = node.text.match(/.{1,26}/g) || [node.text];
      ctx.fillStyle = "#b0acb8";
      ctx.font = `${isSel ? 500 : 400} 9.5px "Manrope", system-ui, sans-serif`;
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      const sy = node.y - ((lines.length - 1) * 12.5) / 2;
      for (let i = 0; i < Math.min(lines.length, 4); i++) {
        const t = i === 3 && lines.length > 4 ? lines[i].slice(0, 25) + "\u2026" : lines[i];
        ctx.fillText(t, x + 16, sy + i * 12.5);
      }
    }
    ctx.restore();
  }, [hoveredNode, selectedNode, zoom, offset]);

  useEffect(() => {
    if (!ready) return;
    let running = true;
    const loop = () => { if (!running) return; render(); animRef.current = requestAnimationFrame(loop); };
    animRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [ready, render]);

  const toWorld = useCallback((ex: number, ey: number) => {
    const c = canvasRef.current; if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return {
      x: (ex - r.left - offset.x - c.width / 2) / zoom + c.width / 2,
      y: (ey - r.top - offset.y - c.height / 2) / zoom + c.height / 2,
    };
  }, [offset, zoom]);

  const hit = (wx: number, wy: number) => {
    for (const n of nodesRef.current) {
      if (Math.abs(wx - n.x) < n.width / 2 + 4 && Math.abs(wy - n.y) < n.height / 2 + 4) return n;
    }
    return null;
  };

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    if (dragging && dragNode) {
      const p = toWorld(e.clientX, e.clientY);
      dragNode.x = p.x; dragNode.y = p.y; return;
    }
    if (dragging) {
      setOffset({ x: offset.x + e.clientX - dragStart.x, y: offset.y + e.clientY - dragStart.y });
      setDragStart({ x: e.clientX, y: e.clientY }); return;
    }
    const p = toWorld(e.clientX, e.clientY);
    setHoveredNode(hit(p.x, p.y));
  }, [ready, dragging, dragNode, dragStart, offset, zoom, toWorld]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    const p = toWorld(e.clientX, e.clientY);
    const h = hit(p.x, p.y);
    if (h) { setDragNode(h); setSelectedNode(h); setDragging(true); }
    else { setDragging(true); setDragStart({ x: e.clientX, y: e.clientY }); }
  }, [ready, toWorld]);

  const onMouseUp = useCallback(() => { setDragging(false); setDragNode(null); }, []);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-bone">Notebook</h2>
        <p className="font-mono text-[11px] text-bone-dim tracking-wide uppercase mt-1.5">
          Topic Map &middot; Auto-loads from upload
        </p>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            placeholder="Document ID (auto-filled from upload)"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <Button onClick={load} loading={loading || computing} variant="mint" size="lg">
          <GitGraph className="w-4 h-4 mr-1.5" />Load
        </Button>
      </div>

      {error && <div className="p-3 bg-heat/5 border border-heat/30 font-mono text-[11px] text-heat">{error}</div>}

      {(loading || computing) && (
        <div className="border border-border bg-surface p-6">
          <Skeleton className="h-[600px]" />
          {computing && <p className="text-center font-mono text-[11px] text-bone-dim mt-3 animate-pulse">Computing layout&hellip;</p>}
        </div>
      )}

      {ready && (
        <div className="border border-border bg-void relative overflow-hidden">
          <div className="absolute top-3 left-3 z-10 flex gap-px bg-border">
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(3, z * 1.25))}>
              <span className="font-mono text-[11px]">+</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))}>
              <span className="font-mono text-[11px]">&minus;</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setZoom(0.75); setOffset({ x: 0, y: 0 }); }}>
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
            <Badge variant="ghost">{nodesRef.current.length} topics</Badge>
            <Badge variant="ghost"><Link2 className="w-3 h-3 mr-0.5" />{edgesRef.current.length}</Badge>
          </div>

          {selectedNode && (
            <div className="absolute top-3 right-3 z-10 max-w-xs p-3.5 bg-surface border border-border shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedNode.color }} />
                  <span className="font-mono text-[10px] text-bone-dim tracking-wider uppercase">Topic</span>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-bone-dim hover:text-bone"><X className="w-3 h-3" /></button>
              </div>
              <p className="font-body text-[12px] text-bone leading-relaxed max-h-40 overflow-y-auto scrollbar-thin pr-1">
                {selectedNode.full_text || selectedNode.text}
              </p>
            </div>
          )}

          <canvas
            ref={canvasRef} width={1200} height={640}
            className="w-full h-[640px] cursor-grab"
            onMouseMove={onMouseMove} onMouseDown={onMouseDown}
            onMouseUp={onMouseUp} onMouseLeave={() => { onMouseUp(); setHoveredNode(null); }}
            onWheel={(e) => { e.preventDefault(); setZoom((z) => Math.max(0.25, Math.min(3, z * (1 - e.deltaY * 0.001)))); }}
          />
        </div>
      )}

      {!loading && !computing && !ready && !error && (
        <div className="border border-border bg-surface flex flex-col items-center justify-center py-28 text-center">
          <GitGraph className="w-12 h-12 text-bone-dim mb-3 opacity-15" />
          <p className="font-display text-sm text-bone-muted font-medium mb-1">No graph loaded</p>
          <p className="font-body text-[12px] text-bone-dim max-w-xs">
            Upload a document on the <span className="text-bone">Documents</span> page — the mindmap loads automatically here.
          </p>
        </div>
      )}
    </div>
  );
}
