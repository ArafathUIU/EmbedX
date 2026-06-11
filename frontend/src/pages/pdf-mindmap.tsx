import { useState, useRef, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Upload, Loader2, AlertTriangle, CheckCircle2,
  ZoomIn, ZoomOut, Maximize2, ChevronRight, ChevronDown,
} from "lucide-react";

// ── Types ──

interface MindmapNode {
  id: string;
  label: string;
  children: MindmapNode[];
}

interface LayoutNode {
  node: MindmapNode;
  x: number;
  y: number;
  depth: number;
  angle: number;
  subtreeSize: number;
}

const COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#059669"];
const BG = "#1e1e2e";
const EDGE = "#4c4f69";

// ── Radial layout ──

function countLeaves(n: MindmapNode): number {
    if (!n.children || n.children.length === 0) return 1;
    return n.children.reduce((s, child) => s + countLeaves(child), 0);
}

function layoutRadial(
  node: MindmapNode,
  cx: number,
  cy: number,
  startAngle: number,
  endAngle: number,
  radius: number,
  depth: number,
  expanded: Set<string>,
  result: LayoutNode[],
): void {
  result.push({
    node,
    x: cx,
    y: cy,
    depth,
    angle: (startAngle + endAngle) / 2,
    subtreeSize: countLeaves(node),
  });

  const visibleChildren = node.children.filter(() => expanded.has(node.id));
  if (visibleChildren.length === 0) return;

  const childRadius = radius + 120 + depth * 20;
  const totalLeaves = visibleChildren.reduce((s, c) => s + countLeaves(c), 0);
  const angleSpan = endAngle - startAngle;
  let currentAngle = startAngle;

  for (const child of visibleChildren) {
    const childLeaves = countLeaves(child);
    const childSpan = totalLeaves > 0 ? (childLeaves / totalLeaves) * angleSpan : angleSpan / visibleChildren.length;
    const childMid = currentAngle + childSpan / 2;
    const cx2 = cx + Math.cos(childMid) * childRadius;
    const cy2 = cy + Math.sin(childMid) * childRadius;

    layoutRadial(child, cx2, cy2, currentAngle, currentAngle + childSpan, childRadius, depth + 1, expanded, result);
    currentAngle += childSpan;
  }
}

// ── SVG helpers ──

function bezierPath(x1: number, y1: number, x2: number, y2: number, depth: number): string {
  const midY = (y1 + y2) / 2;
  const cpOffset = Math.min(60 + depth * 20, 120);
  return `M ${x1} ${y1} C ${x1} ${midY - cpOffset}, ${x2} ${midY + cpOffset}, ${x2} ${y2}`;
}

function pillPath(x: number, y: number, w: number, h: number, rx: number): string {
  const l = x - w / 2, r = x + w / 2, t = y - h / 2, b = y + h / 2;
  return [
    `M ${l + rx} ${t}`,
    `L ${r - rx} ${t}`,
    `Q ${r} ${t} ${r} ${t + rx}`,
    `L ${r} ${b - rx}`,
    `Q ${r} ${b} ${r - rx} ${b}`,
    `L ${l + rx} ${b}`,
    `Q ${l} ${b} ${l} ${b - rx}`,
    `L ${l} ${t + rx}`,
    `Q ${l} ${t} ${l + rx} ${t}`,
    "Z",
  ].join(" ");
}

// ── Component ──

export default function PdfMindmap() {
  const [file, setFile] = useState<File | null>(null);
  const [tree, setTree] = useState<MindmapNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textLen, setTextLen] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root"]));
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<{ id: string; x: number; y: number; label: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleFile = useCallback((f: File | null) => {
    setFile(f);
    setError(null);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setTree(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/pdf-mindmap", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail || "Upload failed");
      }
      const data = await res.json();
      setTree(data.tree);
      setTextLen(data.text_length || 0);
      setExpanded(new Set(["root"]));
      setZoom(0.85);
      setPan({ x: 0, y: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [file]);

  const toggleNode = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const layoutNodes = useRef<LayoutNode[]>([]);
  const nodeMap = useRef<Map<string, LayoutNode>>(new Map());

  useEffect(() => {
    if (!tree) return;
    const result: LayoutNode[] = [];
    layoutRadial(tree, 0, 0, -Math.PI, Math.PI, 0, 0, expanded, result);
    layoutNodes.current = result;
    nodeMap.current = new Map(result.map((n) => [n.node.id, n]));
  }, [tree, expanded]);

  function countNodes(n: MindmapNode): number {
    let c = 1;
    if (n.children) for (const ch of n.children) c += countNodes(ch);
    return c;
  }

  // Mouse handlers
  const toSVG = useCallback(
    (ex: number, ey: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      return {
        x: (ex - rect.left - cx - pan.x) / zoom,
        y: (ey - rect.top - cy - pan.y) / zoom,
      };
    },
    [zoom, pan],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        return;
      }
      const { x, y } = toSVG(e.clientX, e.clientY);
      let found: { id: string; x: number; y: number; label: string } | null = null;
      for (const ln of layoutNodes.current) {
        const w = Math.min(ln.node.label.length * 7 + 30, 200);
        const h = 32;
        if (Math.abs(x - ln.x) < w / 2 + 4 && Math.abs(y - ln.y) < h / 2 + 4) {
          found = { id: ln.node.id, x: ln.x, y: ln.y, label: ln.node.label };
          break;
        }
      }
      setHoveredNode(found);
    },
    [dragging, dragStart, toSVG],
  );

  const onMouseUp = useCallback(() => setDragging(false), []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.max(0.2, Math.min(3, z * (1 - e.deltaY * 0.001))));
    },
    [],
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 animate-fade-in-up">
      {/* Side panel */}
      <div className="w-72 flex-shrink-0 border-r border-[#2e2e3e] bg-[#1a1a2e] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-[#2e2e3e]">
          <h2 className="font-display text-lg font-bold tracking-tight text-[#e0dff0]">PDF Mindmap</h2>
          <p className="font-mono text-[10px] text-[#6c6b7a] tracking-wider uppercase mt-1">
            AI-powered document analysis
          </p>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto scrollbar-thin">
          {/* Upload area */}
          <div
            onClick={() => document.getElementById("pdf-upload-input")?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 ${
              file
                ? "border-[#7c3aed]/40 bg-[#7c3aed]/5"
                : "border-[#2e2e3e] hover:border-[#7c3aed]/30 hover:bg-[#1e1e2e]"
            }`}
          >
            <input
              id="pdf-upload-input"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="space-y-1.5">
                <CheckCircle2 className="w-8 h-8 text-[#7c3aed] mx-auto" />
                <p className="font-body text-sm text-[#d0cfdc] truncate">{file.name}</p>
                <p className="font-mono text-[10px] text-[#6c6b7a]">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-[#6c6b7a] mx-auto" />
                <p className="font-body text-sm text-[#8b8a9e]">Click to select PDF</p>
                <p className="font-mono text-[10px] text-[#6c6b7a]">Max 10MB</p>
              </div>
            )}
          </div>

          <Button
            onClick={handleUpload}
            loading={loading}
            disabled={!file}
            variant="default"
            size="lg"
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {loading ? "Analyzing..." : "Generate Mindmap"}
          </Button>

          {/* Status */}
          {error && (
            <div className="p-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#ef4444] mt-0.5 flex-shrink-0" />
              <p className="font-mono text-[11px] text-[#fca5a5] leading-snug">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-3">
              <Loader2 className="w-4 h-4 text-[#7c3aed] animate-spin" />
              <span className="font-mono text-[11px] text-[#8b8a9e]">
                LLM analyzing document...
              </span>
            </div>
          )}

          {tree && !loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="default">
                  {countNodes(tree)} nodes
                </Badge>
                <Badge variant="ghost">
                  {textLen.toLocaleString()} chars
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {expanded.has("root") ? (
                  <span className="font-mono text-[10px] text-[#8b8a9e]">
                    <ChevronDown className="w-3 h-3 inline mr-0.5" />
                    Expanded
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-[#6c6b7a]">
                    <ChevronRight className="w-3 h-3 inline mr-0.5" />
                    Collapsed
                  </span>
                )}
              </div>
              <p className="font-body text-[11px] text-[#8b8a9e] leading-relaxed mt-2">
                Click nodes to expand/collapse. Scroll to zoom. Drag to pan.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mindmap canvas */}
      <div className="flex-1 relative overflow-hidden" style={{ background: BG }}>
        {/* Toolbar */}
        <div className="absolute top-3 right-3 z-10 flex gap-px rounded-lg overflow-hidden border border-[#2e2e3e]">
          <button
            onClick={() => setZoom((z) => Math.min(3, z * 1.25))}
            className="px-3 py-2 bg-[#1e1e2e] hover:bg-[#2e2e3e] text-[#8b8a9e] hover:text-[#d0cfdc] transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.2, z / 1.25))}
            className="px-3 py-2 bg-[#1e1e2e] hover:bg-[#2e2e3e] text-[#8b8a9e] hover:text-[#d0cfdc] transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setZoom(0.85); setPan({ x: 0, y: 0 }); }}
            className="px-3 py-2 bg-[#1e1e2e] hover:bg-[#2e2e3e] text-[#8b8a9e] hover:text-[#d0cfdc] transition-colors cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Hover tooltip */}
        {hoveredNode && (
          <div
            className="absolute z-20 max-w-xs px-3 py-2 bg-[#2a2a3e] border border-[#3e3e56] rounded-lg shadow-xl pointer-events-none"
            style={{
              left: "50%",
              top: "50%",
              transform: `translate(${hoveredNode.x * zoom + pan.x}px, ${hoveredNode.y * zoom + pan.y - 40}px)`,
            }}
          >
            <p className="font-mono text-[11px] text-[#e0dff0] leading-snug">{hoveredNode.label}</p>
          </div>
        )}

        {tree ? (
          <svg
            ref={svgRef}
            className="w-full h-full cursor-grab select-none"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
            viewBox={`${-600 - pan.x / zoom} ${-400 - pan.y / zoom} ${1200 / zoom} ${800 / zoom}`}
          >
            <g transform={`translate(0, 0) scale(${zoom}) translate(${pan.x}, ${pan.y})`}>
              {layoutNodes.current.map((ln) => {
                const parent = ln.depth > 0
                  ? layoutNodes.current.find((p) => p.node.children.some((c) => c.id === ln.node.id))
                  : null;

                const color = COLORS[Math.min(ln.depth, COLORS.length - 1)];
                const label = ln.node.label;
                const textWidth = Math.min(label.length * 7 + 28, 200);
                const nodeH = 30;
                const hasVisibleChildren =
                  ln.node.children.length > 0 && expanded.has(ln.node.id);

                return (
                  <g key={ln.node.id}>
                    {/* Edge */}
                    {parent && (
                      <path
                        d={bezierPath(parent.x, parent.y, ln.x, ln.y, ln.depth)}
                        fill="none"
                        stroke={EDGE}
                        strokeWidth={1}
                        opacity={0.5}
                      />
                    )}

                    {/* Node pill */}
                    <g
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleNode(ln.node.id);
                      }}
                    >
                      {/* Glow */}
                      <path
                        d={pillPath(ln.x, ln.y, textWidth + 4, nodeH + 4, 18)}
                        fill={`${color}18`}
                        stroke="none"
                      />
                      {/* Body */}
                      <path
                        d={pillPath(ln.x, ln.y, textWidth, nodeH, 16)}
                        fill={`${color}25`}
                        stroke={color}
                        strokeWidth={1.2}
                      />
                      {/* Label */}
                      <text
                        x={ln.x}
                        y={ln.y + 1}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#e0dff0"
                        fontFamily='"JetBrains Mono", monospace'
                        fontSize={ln.depth === 0 ? 12 : 10.5}
                        fontWeight={ln.depth === 0 ? 600 : 400}
                      >
                        {label.length > 28 ? label.slice(0, 27) + "\u2026" : label}
                      </text>
                      {/* Expand indicator */}
                      {ln.node.children.length > 0 && (
                        <text
                          x={ln.x + textWidth / 2 - 10}
                          y={ln.y + 1}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={hasVisibleChildren ? "#8b8a9e" : "#6c6b7a"}
                          fontSize={10}
                        >
                          {hasVisibleChildren ? "−" : "+"}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-sm text-[#6c6b7a]">
              Upload a PDF to generate the mindmap
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
