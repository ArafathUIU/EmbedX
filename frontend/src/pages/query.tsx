import { useState, useRef, useEffect } from "react";
import { useQuery } from "@/hooks/use-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Sparkles,
  Bot,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
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
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { ask, isLoading } = useQuery();

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      type: "user",
      content: question,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");

    try {
      const result = await ask(question);
      const botMsg: Message = {
        id: crypto.randomUUID(),
        type: "bot",
        content: result.answer || "No answer generated from the context.",
        timestamp: Date.now(),
        chunks: result.chunks,
        model: result.model || undefined,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        type: "bot",
        content: "Failed to get a response. Please check if the API is running.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  };

  const toggleChunks = (id: string) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Query</h2>
        <p className="text-text-secondary mt-1">
          Ask questions grounded in your indexed documents
        </p>
      </div>

      <Card className="flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">RAG-Powered Q&A</h3>
              <p className="text-sm text-text-secondary max-w-md">
                Upload documents in the Documents tab, then ask questions here.
                Answers are grounded in your indexed content using OpenCode Go.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.type === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.type === "bot" && (
                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-accent" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3",
                  msg.type === "user"
                    ? "bg-accent text-white"
                    : "bg-surface-hover border border-border text-text-primary"
                )}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </p>

                {msg.chunks && msg.chunks.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleChunks(msg.id)}
                      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {msg.chunks.length} source chunk
                      {msg.chunks.length > 1 ? "s" : ""}
                      {expandedChunks.has(msg.id) ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {expandedChunks.has(msg.id) && (
                      <div className="mt-2 space-y-2">
                        {msg.chunks.map((chunk, i) => (
                          <div
                            key={chunk.chunk_id}
                            className="p-2.5 rounded-xl bg-surface border border-border text-xs"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <Badge>
                                Source {i + 1}
                                <span className="ml-1.5 text-text-muted">
                                  {(chunk.score * 100).toFixed(1)}%
                                </span>
                              </Badge>
                            </div>
                            <p className="text-text-secondary leading-relaxed">
                              {chunk.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {msg.model && (
                  <p className="text-[10px] text-text-muted mt-2">
                    Generated by {msg.model}
                  </p>
                )}

                {msg.type === "bot" && (
                  <button
                    onClick={() => copyToClipboard(msg.content, msg.id)}
                    className="mt-1.5 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              {msg.type === "user" && (
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-accent" />
              </div>
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-surface-hover border border-border">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-accent/40 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-text-muted">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-border p-4 bg-surface"
        >
          <div className="flex gap-3">
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
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!question.trim() || isLoading}
              loading={isLoading}
            >
              {!isLoading && <Send className="w-4 h-4 mr-2" />}
              Send
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
