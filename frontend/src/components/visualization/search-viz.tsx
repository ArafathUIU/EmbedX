import { useEffect, useRef, useState } from "react";

interface VizPoint {
  chunk_id: string;
  text: string;
  score: number;
  x: number;
  y: number;
}

interface SearchVizProps {
  queryX: number;
  queryY: number;
  points: VizPoint[];
  width?: number;
  height?: number;
}

function scoreColor(score: number): string {
  const r = Math.round(255 * (1 - score));
  const g = Math.round(229 * score);
  const b = Math.round(160 * score);
  return `rgb(${r},${g},${b})`;
}

export default function SearchViz({
  queryX,
  queryY,
  points,
  width = 600,
  height = 400,
}: SearchVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<VizPoint | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const padding = 50;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const allPoints = [{ x: queryX, y: queryY }, ...points.map((p) => ({ x: p.x, y: p.y }))];
  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const toScreen = (x: number, y: number) => ({
    sx: padding + ((x - minX) / rangeX) * innerW,
    sy: padding + ((y - minY) / rangeY) * innerH,
  });

  const queryScreen = toScreen(queryX, queryY);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#13101d";
    ctx.fillRect(0, 0, width, height);

    // Draw connecting lines
    for (const pt of points) {
      const { sx, sy } = toScreen(pt.x, pt.y);
      ctx.beginPath();
      ctx.moveTo(queryScreen.sx, queryScreen.sy);
      ctx.lineTo(sx, sy);
      ctx.strokeStyle = `rgba(153, 102, 255, ${pt.score * 0.4})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw chunk points
    for (const pt of points) {
      const { sx, sy } = toScreen(pt.x, pt.y);
      const radius = 6 + pt.score * 10;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = scoreColor(pt.score);
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(237, 234, 226, 0.3)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Draw query marker (diamond)
    const qs = 10;
    ctx.beginPath();
    ctx.moveTo(queryScreen.sx, queryScreen.sy - qs);
    ctx.lineTo(queryScreen.sx + qs, queryScreen.sy);
    ctx.lineTo(queryScreen.sx, queryScreen.sy + qs);
    ctx.lineTo(queryScreen.sx - qs, queryScreen.sy);
    ctx.closePath();
    ctx.fillStyle = "#b388ff";
    ctx.fill();
    ctx.strokeStyle = "#9966ff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = "#b388ff";
    ctx.font = "10px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("QUERY", queryScreen.sx, queryScreen.sy - qs - 6);

    // Draw score labels
    for (const pt of points) {
      const { sx, sy } = toScreen(pt.x, pt.y);
      const radius = 6 + pt.score * 10;
      ctx.fillStyle = "rgba(237, 234, 226, 0.7)";
      ctx.font = "9px JetBrains Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${(pt.score * 100).toFixed(0)}%`, sx, sy - radius - 4);
    }
  }, [queryX, queryY, points, width, height]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const pt of points) {
      const { sx, sy } = toScreen(pt.x, pt.y);
      const radius = 6 + pt.score * 10;
      const dx = mx - sx;
      const dy = my - sy;
      if (dx * dx + dy * dy < (radius + 4) * (radius + 4)) {
        setHovered(pt);
        setMousePos({ x: e.clientX, y: e.clientY });
        return;
      }
    }
    setHovered(null);
  };

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-surface text-bone-dim text-sm font-body">
        Not enough data to visualize — need at least 2 chunks.
      </div>
    );
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        className="w-full border border-border cursor-crosshair"
        style={{ maxWidth: width, height: "auto" }}
      />
      {hovered && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: mousePos.x + 12, top: mousePos.y - 10 }}
        >
          <div className="bg-surface-elevated border border-border p-3 max-w-xs shadow-lg">
            <p className="font-mono text-[10px] text-bone-dim mb-1">
              {hovered.chunk_id} &middot; {(hovered.score * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-bone leading-relaxed">{hovered.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
