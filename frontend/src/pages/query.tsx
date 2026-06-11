import { useState, useRef, useEffect } from "react";
import { useQuery } from "@/hooks/use-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight, User, Copy, Check, Zap, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: number;
  chunks?: Array<{ chunk_id: string; text: string; score: number }>;
  model?: string;
}

export default function Query() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { ask, isLoading } = useQuery();

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(), type: "user", content: question, timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");

    try {
      const result = await ask(question);
      const botMsg: Message = {
        id: crypto.randomUUID(), type: "bot",
        content: result.answer || "Unable to generate an answer.",
        timestamp: Date.now(),
        chunks: result.chunks,
        model: result.model || undefined,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errMsg: Message = {
        id: crypto.randomUUID(), type: "bot",
        content: "Unable to reach the API. Verify the backend is running.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-bone">
          Query
        </h2>
        <p className="font-mono text-xs text-bone-dim tracking-wide uppercase mt-2">
          Retrieve &middot; Generate &middot; Answer
        </p>
      </div>

      <Card className="flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-24">
              <div className="w-14 h-14 border border-border flex items-center justify-center mb-5">
                <Zap className="w-6 h-6 text-violet-bright" />
              </div>
              <h3 className="font-display text-lg font-semibold text-bone tracking-tight mb-2">
                Ask anything
              </h3>
              <p className="text-sm text-bone-muted font-body max-w-sm leading-relaxed">
                Upload documents in the <span className="text-bone">Documents</span> tab.
                Questions are grounded in your indexed content using embedding retrieval
                and OpenCode Go.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className="animate-fade-in-up">
              <div
                className={cn(
                  "flex gap-3",
                  msg.type === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.type === "bot" && (
                  <div className="w-7 h-7 border border-border flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles className="w-3 h-3 text-violet-bright" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[78%] p-4",
                    msg.type === "user"
                      ? "bg-violet/10 border border-violet/20"
                      : "bg-surface-elevated border border-border"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm leading-relaxed whitespace-pre-wrap",
                      msg.type === "user" ? "font-body text-bone" : "font-body text-bone"
                    )}
                  >
                    {msg.content}
                  </p>

                  {msg.chunks && msg.chunks.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-[10px] text-bone-dim tracking-widest uppercase">
                          Sources &middot; {msg.chunks.length}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {msg.chunks.map((chunk, i) => (
                          <div
                            key={chunk.chunk_id}
                            className="chunk-node"
                            style={{
                              "--chunk-score": chunk.score.toFixed(2),
                            } as React.CSSProperties}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-[10px] text-bone-dim tracking-wide">
                                CHUNK_{i + 1}
                              </span>
                              <span className="font-mono text-[10px] text-heat tabular-nums">
                                {(chunk.score * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="text-[13px] text-bone-muted leading-relaxed mb-1 line-clamp-3">
                              {chunk.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                    {msg.model && (
                      <span className="font-mono text-[10px] text-bone-dim tracking-wide uppercase">
                        {msg.model}
                      </span>
                    )}
                    {msg.type === "bot" && (
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="text-bone-dim hover:text-bone-muted transition-colors cursor-pointer ml-auto"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {msg.type === "user" && (
                  <div className="w-7 h-7 bg-violet flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-3 h-3 text-void" />
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 animate-fade-in-up">
              <div className="w-7 h-7 border border-border flex items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="w-3 h-3 text-violet-bright" />
              </div>
              <div className="max-w-[78%] p-4 bg-surface-elevated border border-border">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-violet-bright tracking-wide uppercase animate-pulse">
                    Retrieving
                  </span>
                  <div className="w-16 h-px bg-violet/20 overflow-hidden">
                    <div className="w-8 h-full bg-violet/40 animate-[pulse-glow_1.5s_ease-in-out_infinite]" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-border p-4 bg-surface">
          <div className="flex gap-px bg-border">
            <div className="flex-1 bg-void">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about your documents..."
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                className="border-0"
              />
            </div>
            <Button
              type="submit"
              disabled={!question.trim() || isLoading}
              loading={isLoading}
              size="lg"
            >
              {!isLoading && <ArrowRight className="w-4 h-4 mr-1.5" />}
              Send
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
