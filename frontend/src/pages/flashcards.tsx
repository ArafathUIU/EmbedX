import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, Shuffle, Sparkles,
  Eye, EyeOff, RefreshCw,
} from "lucide-react";

interface Card {
  question: string;
  answer: string;
}

export default function Flashcards() {
  const [documentId, setDocumentId] = useState(
    () => sessionStorage.getItem("embedx_last_doc") || ""
  );
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const generate = useCallback(async () => {
    if (!documentId.trim()) return;
    setLoading(true);
    setError(null);
    setCards([]);
    setIndex(0);
    setFlipped(false);
    sessionStorage.setItem("embedx_last_doc", documentId);
    try {
      const res = await fetch("/api/v1/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId, card_count: 8 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed" }));
        throw new Error(err.detail || "Failed to generate cards");
      }
      const data = await res.json();
      if (data.cards.length === 0) throw new Error("No cards generated");
      setCards(data.cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  const flip = useCallback(() => {
    setFlipped((v) => !v);
  }, []);

  const next = useCallback(() => {
    setFlipped(false);
    setIndex((i) => (i + 1) % cards.length);
  }, [cards.length]);

  const prev = useCallback(() => {
    setFlipped(false);
    setIndex((i) => (i - 1 + cards.length) % cards.length);
  }, [cards.length]);

  const shuffle = useCallback(() => {
    setFlipped(false);
    setCards((prev) => {
      const arr = [...prev];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
    setIndex(0);
  }, []);

  const card = cards[index];

  return (
    <div className="space-y-6 animate-fade-in-up max-w-2xl mx-auto">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-bone">
          Flashcards
        </h2>
        <p className="font-mono text-xs text-bone-dim tracking-wide uppercase mt-2">
          AI-generated Q&A from your documents
        </p>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="font-mono text-[10px] text-bone-dim tracking-widest uppercase mb-1.5 block">
            Document ID
          </label>
          <Input
            placeholder="Document ID from upload..."
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
          />
        </div>
        <Button onClick={generate} loading={loading} variant="mint" size="lg">
          <Sparkles className="w-4 h-4 mr-2" />
          Generate
        </Button>
      </div>

      {error && (
        <div className="p-3.5 bg-heat/5 border border-heat/30 font-mono text-[11px] text-heat leading-relaxed">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 border border-border bg-void">
          <RefreshCw className="w-8 h-8 text-violet-bright animate-spin mb-4" />
          <p className="font-mono text-xs text-bone-dim animate-pulse">
            AI is generating flash cards...
          </p>
        </div>
      )}

      {cards.length > 0 && !loading && (
        <div className="space-y-5">
          {/* Progress */}
          <div className="flex items-center gap-3">
            <Badge variant="default">{index + 1} / {cards.length}</Badge>
            <div className="flex-1 h-0.5 bg-border overflow-hidden">
              <div
                className="h-full bg-violet transition-all duration-300"
                style={{ width: `${((index + 1) / cards.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Card */}
          <div
            onClick={flip}
            className="relative cursor-pointer select-none"
            style={{ perspective: "800px" }}
          >
            <div
              className="relative w-full transition-transform duration-200"
              style={{
                height: "260px",
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Front — Question */}
              <div
                className="absolute inset-0 border border-border bg-surface flex flex-col items-center justify-center p-8 text-center"
                style={{ backfaceVisibility: "hidden" }}
              >
                <span className="font-mono text-[10px] text-violet tracking-widest uppercase mb-4">
                  QUESTION
                </span>
                <p className="font-display text-xl font-semibold text-bone leading-relaxed">
                  {card?.question}
                </p>
                <div className="absolute bottom-4 right-4 flex items-center gap-1 text-[10px] text-bone-dim font-mono">
                  <Eye className="w-3 h-3" />
                  Tap to reveal
                </div>
              </div>

              {/* Back — Answer */}
              <div
                className="absolute inset-0 border border-violet/30 bg-violet/5 flex flex-col items-center justify-center p-8 text-center"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <span className="font-mono text-[10px] text-mint tracking-widest uppercase mb-4">
                  ANSWER
                </span>
                <p className="font-body text-base text-bone leading-relaxed">
                  {card?.answer}
                </p>
                <div className="absolute bottom-4 right-4 flex items-center gap-1 text-[10px] text-bone-dim font-mono">
                  <EyeOff className="w-3 h-3" />
                  Tap to hide
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={prev}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>

            <Button variant="ghost" onClick={shuffle} title="Shuffle cards">
              <Shuffle className="w-4 h-4" />
            </Button>

            <Button variant="ghost" onClick={next}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Jump to card */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {cards.map((_, i) => (
              <button
                key={i}
                onClick={() => { setFlipped(false); setIndex(i); }}
                className={`w-7 h-7 flex items-center justify-center font-mono text-[10px] transition-colors cursor-pointer border ${
                  i === index
                    ? "border-violet/40 bg-violet/10 text-violet-bright"
                    : "border-transparent text-bone-dim hover:text-bone hover:border-border"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && cards.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-24 border border-border bg-void text-center">
          <Sparkles className="w-10 h-10 text-bone-dim mb-3 opacity-20" />
          <p className="font-display text-sm text-bone-muted font-medium mb-1">
            No cards yet
          </p>
          <p className="font-body text-xs text-bone-dim max-w-xs">
            Upload and index a document, then enter its ID above and generate AI flash cards.
          </p>
        </div>
      )}
    </div>
  );
}
