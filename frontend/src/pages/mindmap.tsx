import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMindmap, type MindmapNode } from "@/api/client";
import { GitGraph, X, Layers, ChevronRight } from "lucide-react";

// ── Types ──

interface Pos { x: number; y: number }

interface ChunkNode extends Pos {
  id: string;
  text: string;
  fullText: string;
  radius: number;
  color: string;
  domain: number;
  opacity: number;
  targetX: number;
  targetY: number;
}

interface Domain {
  id: number;
  label: string;
  color: string;
  count: number;
  x: number;
  y: number;
  opacity: number;
  targetX: number;
  targetY: number;
  expanded: boolean;
}

// ── Colors ──

const PALETTE = [
  "#b388ff", "#00e5a0", "#60a5fa", "#f472b6", "#facc15",
  "#a78bfa", "#34d399", "#fb923c", "#38bdf8", "#e879f9",
];

// ── Layout engine ──

function clusterChunks(
  rawNodes: MindmapNode[],
  edges: { source: string; target: string; score: number }[]
): { domainMap: Map<string, number>; domains: Map<number, string[]> } {
  const adj = new Map<string, string[]>();
  for (const n of rawNodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  }

  const visited = new Set<string>();
  const clusters: string[][] = [];
  for (const n of rawNodes) {
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

  const domainMap = new Map<string, number>();
  const domains = new Map<number, string[]>();
  clusters.forEach((c, i) => {
    for (const id of c) domainMap.set(id, i);
    domains.set(i, c);
  });
  return { domainMap, domains };
}

function computeDomainLabel(chunks: ChunkNode[], domainId: number): string {
  const domainChunks = chunks.filter((c) => c.domain === domainId);
  if (domainChunks.length === 0) return `Domain ${domainId + 1}`;
  const longest = domainChunks.reduce((a, b) => (a.text.length > b.text.length ? a : b));
  const words = longest.text.split(/\s+/).slice(0, 4).join(" ");
  return words || `Domain ${domainId + 1}`;
}

// ── Component ──

export default function Mindmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [documentId, setDocumentId] = useState(() => sessionStorage.getItem("embedx_last_doc") || "");
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [targetZoom, setTargetZoom] = useState(0.8);
  const [targetPan, setTargetPan] = useState({ x: 0, y: 0 });

  const chunksRef = useRef<ChunkNode[]>([]);
  const domainsRef = useRef<Domain[]>([]);
  const edgesRef = useRef<{ a: ChunkNode; b: ChunkNode; score: number }[]>([]);
  const animRef = useRef(0);
  const timeRef = useRef(0);
  const hoveringRef = useRef<ChunkNode | Domain | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [hovered, setHovered] = useState<{ id: string; x: number; y: number; text: string } | null>(null);

  const layoutChunks = useCallback((domains: Domain[]) => {
    const canvas = canvasRef.current;
    const w = canvas?.width ?? 1200;
    const h = canvas?.height ?? 800;
    const cx = w / 2, cy = h / 2;
    const chunks = chunksRef.current;
    const expandedDomains = domains.filter((d) => d.expanded);
    const collapsedDomains = domains.filter((d) => !d.expanded);

    // Position collapsed domain nodes in a ring
    const totalCollapsed = collapsedDomains.length;
    const ringRadius = Math.min(w, h) * 0.35;
    for (let i = 0; i < totalCollapsed; i++) {
      const angle = (2 * Math.PI * i) / totalCollapsed - Math.PI / 2;
      const d = collapsedDomains[i];
      d.targetX = cx + Math.cos(angle) * ringRadius;
      d.targetY = cy + Math.sin(angle) * ringRadius;
    }

    // Position expanded domain chunks in sub-rings
    const expandedCount = expandedDomains.length;
    if (expandedCount === 0) {
      // Hide all chunks
      for (const c of chunks) {
        c.targetX = c.x; c.targetY = c.y; c.opacity = 0;
      }
      return;
    }

    for (let di = 0; di < expandedCount; di++) {
      const d = expandedDomains[di];
      const domainChunks = chunks.filter((c) => c.domain === d.id);
      const baseAngle = (2 * Math.PI * di) / expandedCount - Math.PI / 2;
      const baseDist = Math.min(w, h) * 0.35;
      d.targetX = cx + Math.cos(baseAngle) * baseDist;
      d.targetY = cy + Math.sin(baseAngle) * baseDist;
      d.opacity = 0.4;

      const subRingRadius = Math.min(w, h) * 0.14;
      for (let i = 0; i < domainChunks.length; i++) {
        const angle = (2 * Math.PI * i) / domainChunks.length - Math.PI / 2;
        const c = domainChunks[i];
        c.targetX = d.targetX + Math.cos(angle) * subRingRadius;
        c.targetY = d.targetY + Math.sin(angle) * subRingRadius;
        c.opacity = 1;
      }
    }

    // Hide chunks in collapsed domains
    for (const d of collapsedDomains) {
      for (const c of chunks) {
        if (c.domain === d.id) { c.opacity = 0; c.targetX = d.x; c.targetY = d.y; }
      }
      d.opacity = 1;
    }
  }, []);

  const load = useCallback(async (docId: string) => {
    if (!docId.trim()) return;
    setLoading(true); setError(null); setReady(false);
    try {
      const data = await fetchMindmap(docId, 0.3);
      if (data.nodes.length === 0) { setError("No chunks found"); setLoading(false); return; }

      setComputing(true);
      await new Promise((r) => setTimeout(r, 30));

      const { domainMap, domains } = clusterChunks(data.nodes, data.edges);

      const w = canvasRef.current?.width ?? 1200;
      const h = canvasRef.current?.height ?? 800;
      const cx = w / 2, cy = h / 2;

      const chunks: ChunkNode[] = data.nodes.map((n) => {
        const d = domainMap.get(n.id) ?? 0;
        return {
          id: n.id, text: n.text, fullText: n.full_text || n.text,
          x: cx, y: cy, targetX: cx, targetY: cy,
          radius: 4 + Math.min(n.text.length / 12, 10),
          color: PALETTE[d % PALETTE.length],
          domain: d, opacity: 0,
        };
      });

      const domainList: Domain[] = [];
      for (const [id, chunkIds] of domains) {
        domainList.push({
          id, label: computeDomainLabel(chunks, id),
          color: PALETTE[id % PALETTE.length],
          count: chunkIds.length,
          x: cx, y: cy, targetX: cx, targetY: cy,
          opacity: 1, expanded: false,
        });
      }
      domainList.sort((a, b) => b.count - a.count);

      // Edge lookup
      const nodeMap = new Map(chunks.map((c) => [c.id, c]));
      const es: { a: ChunkNode; b: ChunkNode; score: number }[] = [];
      for (const e of data.edges) {
        const a = nodeMap.get(e.source);
        const b = nodeMap.get(e.target);
        if (a && b && a.domain === b.domain) {
          es.push({ a, b, score: e.score });
        }
      }

      chunksRef.current = chunks;
      domainsRef.current = domainList;
      edgesRef.current = es;

      // Position collapsed domains only
      layoutChunks(domainList);

      setComputing(false); setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  }, [layoutChunks]);

  useEffect(() => {
    const lastDoc = sessionStorage.getItem("embedx_last_doc");
    if (lastDoc) { setDocumentId(lastDoc); load(lastDoc); }
  }, [load]);

  const handleLoad = () => {
    if (!documentId.trim()) return;
    sessionStorage.setItem("embedx_last_doc", documentId);
    load(documentId);
  };

  const toggleDomain = useCallback((d: Domain) => {
    const domains = domainsRef.current;
    const target = domains.find((x) => x.id === d.id);
    if (!target) return;
    target.expanded = !target.expanded;
    setSelectedDomain(target.expanded ? target : null);
    layoutChunks([...domains]);
  }, [layoutChunks]);

  // Animation loop
  useEffect(() => {
    if (!ready) return;
    let running = true;
    timeRef.current = performance.now();

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min((now - timeRef.current) / 1000, 0.1);
      timeRef.current = now;

      // Smooth zoom/pan
      const z = zoom + (targetZoom - zoom) * Math.min(dt * 6, 1);
      setZoom(z);
      setPan({
        x: pan.x + (targetPan.x - pan.x) * Math.min(dt * 6, 1),
        y: pan.y + (targetPan.y - pan.y) * Math.min(dt * 6, 1),
      });

      // Smooth node positions
      const lerp = Math.min(dt * 5, 1);
      for (const c of chunksRef.current) {
        c.x += (c.targetX - c.x) * lerp;
        c.y += (c.targetY - c.y) * lerp;
      }
      for (const d of domainsRef.current) {
        d.x += (d.targetX - d.x) * lerp;
        d.y += (d.targetY - d.y) * lerp;
      }

      // Render
      const canvas = canvasRef.current;
      if (!canvas) { animRef.current = requestAnimationFrame(loop); return; }
      const ctx = canvas.getContext("2d");
      if (!ctx) { animRef.current = requestAnimationFrame(loop); return; }
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      ctx.translate(pan.x + w / 2, pan.y + h / 2);
      ctx.scale(z, z);
      ctx.translate(-w / 2, -h / 2);

      const t = now * 0.001;
      const cx = w / 2, cy = h / 2;

      // Root node — breathing glow
      const rootPulse = 1 + Math.sin(t * 1.5) * 0.08;
      const rootR = 14 * rootPulse;
      ctx.beginPath();
      ctx.arc(cx, cy, rootR + 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(153,102,255,0.06)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, rootR, 0, Math.PI * 2);
      const rootGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rootR);
      rootGrad.addColorStop(0, "#c4a0ff");
      rootGrad.addColorStop(0.6, "#7c4dff");
      rootGrad.addColorStop(1, "#4a2a8a");
      ctx.fillStyle = rootGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(179,136,255,0.4)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Root label
      ctx.fillStyle = "#edeae2";
      ctx.font = '500 10px "Space Grotesk", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("ROOT", cx, cy + rootR + 16);

      // Edges — from root to domains
      for (const d of domainsRef.current) {
        if (d.opacity < 0.05) continue;
        const a = d.opacity * 0.12;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(d.x, d.y);
        ctx.strokeStyle = `rgba(153,102,255,${a.toFixed(3)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Edges — between chunks in same expanded domain
      for (const e of edgesRef.current) {
        const oa = Math.min(e.a.opacity, e.b.opacity);
        if (oa < 0.1) continue;
        ctx.beginPath();
        ctx.moveTo(e.a.x, e.a.y);
        ctx.lineTo(e.b.x, e.b.y);
        ctx.strokeStyle = `rgba(153,102,255,${(0.04 + e.score * 0.15) * oa})`;
        ctx.lineWidth = 0.4 + e.score * 0.7;
        ctx.stroke();
      }

      // Domain nodes
      const hoveredDomain = hoveringRef.current && "count" in hoveringRef.current ? hoveringRef.current as Domain : null;
      for (const d of domainsRef.current) {
        if (d.opacity < 0.05) continue;
        const isHov = hoveredDomain?.id === d.id;
        const pulse = 1 + Math.sin(t * 2 + d.id) * 0.04;
        const r = (16 + d.count * 1.5) * pulse;
        const dx = d.x, dy = d.y;

        // Glow
        ctx.beginPath();
        ctx.arc(dx, dy, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = isHov ? `${d.color}15` : "rgba(153,102,255,0.04)";
        ctx.fill();

        // Body
        ctx.beginPath();
        ctx.arc(dx, dy, r, 0, Math.PI * 2);
        const dg = ctx.createRadialGradient(dx, dy, 0, dx, dy, r);
        dg.addColorStop(0, isHov ? d.color : `${d.color}dd`);
        dg.addColorStop(1, `${d.color}44`);
        ctx.fillStyle = dg;
        ctx.globalAlpha = d.opacity;
        ctx.fill();
        ctx.strokeStyle = isHov ? d.color : `${d.color}55`;
        ctx.lineWidth = isHov ? 1.5 : 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Label
        const label = d.expanded ? "" : d.label.slice(0, 18);
        if (label) {
          ctx.fillStyle = "#edeae2";
          ctx.font = '500 9px "Manrope", sans-serif';
          ctx.textAlign = "center";
          ctx.fillText(label, dx, dy - r - 8);
        }

        // Count badge
        ctx.fillStyle = "#edeae2";
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(d.count), dx, dy + 1);
        ctx.textBaseline = "alphabetic";
      }

      // Chunks
      const hoveredChunk = hoveringRef.current && "domain" in hoveringRef.current ? hoveringRef.current as ChunkNode : null;
      for (const c of chunksRef.current) {
        if (c.opacity < 0.08) continue;
        const isHov = hoveredChunk?.id === c.id;
        const pulse = 1 + Math.sin(t * 2.5 + chunksRef.current.indexOf(c) * 0.3) * 0.04;
        const r = (c.radius + (isHov ? 2 : 0)) * pulse;

        ctx.globalAlpha = c.opacity;

        ctx.beginPath();
        ctx.arc(c.x, c.y, r + 3, 0, Math.PI * 2);
        ctx.fillStyle = isHov ? `${c.color}15` : `${c.color}06`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        const cg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        cg.addColorStop(0, isHov ? c.color : `${c.color}cc`);
        cg.addColorStop(1, `${c.color}55`);
        ctx.fillStyle = cg;
        ctx.fill();
        ctx.strokeStyle = isHov ? c.color : `${c.color}44`;
        ctx.lineWidth = isHov ? 1.2 : 0.5;
        ctx.stroke();

        // Short label for hovered or larger chunks
        if (isHov || c.radius > 7) {
          const txt = c.text.slice(0, 22);
          ctx.fillStyle = "#b0acb8";
          ctx.font = `${isHov ? 500 : 400} ${isHov ? "9.5" : "8.5"}px "Manrope", sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(txt + (c.text.length > 22 ? "\u2026" : ""), c.x, c.y - r - 6);
        }
        ctx.globalAlpha = 1;
      }

      // Domain connector lines from root to chunks (for expanded domains)
      for (const d of domainsRef.current) {
        if (!d.expanded) continue;
        const domainChunks = chunksRef.current.filter((c) => c.domain === d.id && c.opacity > 0.1);
        for (const c of domainChunks) {
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(c.x, c.y);
          ctx.strokeStyle = `${d.color}15`;
          ctx.lineWidth = 0.4;
          ctx.stroke();
        }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [ready, zoom, pan, targetZoom, targetPan]);

  // Mouse
  const toWorld = useCallback((ex: number, ey: number) => {
    const c = canvasRef.current; if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return {
      x: (ex - r.left - pan.x - c.width / 2) / zoom + c.width / 2,
      y: (ey - r.top - pan.y - c.height / 2) / zoom + c.height / 2,
    };
  }, [pan, zoom]);

  const [dragInfo, setDragInfo] = useState<{ sx: number; sy: number; px: number; py: number } | null>(null);

  const hitDomain = (wx: number, wy: number): Domain | null => {
    for (const d of domainsRef.current) {
      const r = 16 + d.count * 1.5 + 8;
      if ((wx - d.x) ** 2 + (wy - d.y) ** 2 < r ** 2) return d;
    }
    return null;
  };

  const hitChunk = (wx: number, wy: number): ChunkNode | null => {
    for (const c of chunksRef.current) {
      if (c.opacity < 0.1) continue;
      if ((wx - c.x) ** 2 + (wy - c.y) ** 2 < (c.radius + 6) ** 2) return c;
    }
    return null;
  };

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragInfo) {
      setTargetPan({ x: dragInfo.px + e.clientX - dragInfo.sx, y: dragInfo.py + e.clientY - dragInfo.sy });
      return;
    }
    const { x, y } = toWorld(e.clientX, e.clientY);
    const d = hitDomain(x, y);
    if (d) { hoveringRef.current = d; setHovered({ id: `d${d.id}`, x, y, text: d.label }); return; }
    const c = hitChunk(x, y);
    if (c) { hoveringRef.current = c; setHovered({ id: c.id, x, y, text: c.fullText || c.text }); return; }
    hoveringRef.current = null; setHovered(null);
  }, [dragInfo, toWorld]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toWorld(e.clientX, e.clientY);
    const d = hitDomain(x, y);
    if (d) { toggleDomain(d); return; }
    setDragInfo({ sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y });
  }, [toWorld, toggleDomain, pan]);

  const onMouseUp = useCallback(() => { setDragInfo(null); }, []);
  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setTargetZoom((z) => Math.max(0.3, Math.min(3, z * (1 - e.deltaY * 0.0008))));
  }, []);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-bone">Notebook</h2>
          <p className="font-mono text-[11px] text-bone-dim tracking-wide uppercase mt-1.5">
            Domain Layers &middot; Click to expand
          </p>
        </div>
        {selectedDomain && (
          <Button variant="ghost" size="sm" onClick={() => {
            toggleDomain(selectedDomain);
            setSelectedDomain(null);
          }}>
            <X className="w-3.5 h-3.5 mr-1" />Collapse
          </Button>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            placeholder="Document ID (auto-filled from upload)"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
          />
        </div>
        <Button onClick={handleLoad} loading={loading || computing} variant="mint" size="lg">
          <GitGraph className="w-4 h-4 mr-1.5" />Load
        </Button>
      </div>

      {error && <div className="p-3 bg-heat/5 border border-heat/30 font-mono text-[11px] text-heat">{error}</div>}

      {(loading || computing) && (
        <div className="border border-border bg-surface p-6">
          <Skeleton className="h-[620px]" />
          {computing && <p className="text-center font-mono text-[11px] text-bone-dim mt-3 animate-pulse">Computing domains&hellip;</p>}
        </div>
      )}

      {ready && (
        <div className="border border-border bg-void relative overflow-hidden">
          <div className="absolute top-3 left-3 z-10 flex gap-px bg-border">
            <Button variant="ghost" size="sm" onClick={() => setTargetZoom((z) => Math.min(3, z * 1.25))}>
              <span className="font-mono text-[11px]">+</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setTargetZoom((z) => Math.max(0.3, z / 1.25))}>
              <span className="font-mono text-[11px]">&minus;</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setTargetZoom(0.8); setTargetPan({ x: 0, y: 0 }); }}>
              <Layers className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
            <Badge variant="ghost">{domainsRef.current.length} domains</Badge>
            <Badge variant="ghost">{chunksRef.current.length} chunks</Badge>
          </div>

          {hovered && (
            <div className="absolute top-3 right-3 z-10 max-w-xs p-3 bg-surface border border-border shadow-xl">
              <p className="font-body text-[11px] text-bone leading-relaxed max-h-40 overflow-y-auto scrollbar-thin">
                {hovered.text}
              </p>
            </div>
          )}

          <div className="absolute bottom-3 left-3 z-10 flex gap-2">
            <Badge variant="ghost">
              <ChevronRight className="w-3 h-3 mr-1" />
              Click a domain circle to expand
            </Badge>
          </div>

          <canvas
            ref={canvasRef} width={1200} height={660}
            className="w-full h-[660px] cursor-grab"
            onMouseMove={onMouseMove} onMouseDown={onMouseDown}
            onMouseUp={onMouseUp} onMouseLeave={() => { onMouseUp(); hoveringRef.current = null; setHovered(null); }}
            onWheel={onWheel}
          />
        </div>
      )}

      {!loading && !computing && !ready && !error && (
        <div className="border border-border bg-surface flex flex-col items-center justify-center py-28 text-center">
          <Layers className="w-12 h-12 text-bone-dim mb-3 opacity-15" />
          <p className="font-display text-sm text-bone-muted font-medium mb-1">No graph loaded</p>
          <p className="font-body text-[12px] text-bone-dim max-w-xs">
            Upload on <span className="text-bone">Documents</span> &mdash; the domain map loads automatically here.
          </p>
        </div>
      )}
    </div>
  );
}
