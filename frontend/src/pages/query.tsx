import { useState, useRef, useEffect } from "react";
import { useQuery } from "@/hooks/use-query";
import { useConversations } from "@/hooks/use-conversations";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight, User, Copy, Check, Zap, Sparkles,
  MessageSquare, Plus, Trash2, PanelLeftClose, PanelLeft,
  Edit3, CheckCheck, X, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchDocuments, queryExplain, type DocumentSummary, type ExplainResponse } from "@/api/client";
import SearchViz from "@/components/visualization/search-viz";

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [allDocs, setAllDocs] = useState<DocumentSummary[]>([]);
  const [vizData, setVizData] = useState<ExplainResponse | null>(null);
  const [vizLoading, setVizLoading] = useState(false);
  const [vizMsgId, setVizMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { ask, isLoading } = useQuery();
  const conv = useConversations();

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  useEffect(() => {
    conv.fetchAll();
    fetchDocuments().then((d) => setAllDocs(d.documents)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(), type: "user", content: question, timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const q = question;
    setQuestion("");

    try {
      const result = await ask(q, undefined, selectedDocIds.length > 0 ? selectedDocIds : undefined);
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

  const handleNewConversation = async () => {
    const id = await conv.create("New Conversation");
    setMessages([]);
    setEditingId(id);
    setEditTitle("New Conversation");
  };

  const handleLoadConversation = async (id: string) => {
    await conv.load(id);
    if (conv.current) {
      setMessages(
        conv.current.messages.map((m) => ({
          id: crypto.randomUUID(),
          type: m.role as "user" | "bot",
          content: m.content,
          timestamp: new Date(m.timestamp).getTime(),
          chunks: m.chunks,
          model: m.model,
        }))
      );
    }
  };

  const handleRename = async (id: string) => {
    if (editTitle.trim()) {
      await conv.rename(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const toggleDocFilter = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((d) => d !== docId) : [...prev, docId]
    );
  };

  const handleVisualize = async (msg: Message) => {
    if (vizMsgId === msg.id) {
      setVizData(null);
      setVizMsgId(null);
      return;
    }
    setVizLoading(true);
    setVizMsgId(msg.id);
    try {
      const data = await queryExplain(msg.content);
      setVizData(data);
    } catch {
      setVizData(null);
    } finally {
      setVizLoading(false);
    }
  };

  return (
    <div className="flex gap-px bg-border h-[calc(100vh-4rem)] animate-fade-in-up">
      {/* Conversation sidebar */}
      <div
        className={cn(
          "bg-void transition-all duration-200 flex flex-col overflow-hidden",
          sidebarOpen ? "w-64" : "w-0"
        )}
      >
        <div className="p-4 space-y-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-bone-dim tracking-widest uppercase">
              Conversations
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-bone-dim hover:text-bone transition-colors cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
          <Button
            variant="mint"
            size="sm"
            className="w-full"
            onClick={handleNewConversation}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 space-y-px pb-4">
          {conv.conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer",
                conv.current?.id === c.id
                  ? "bg-violet/10 text-violet-bright"
                  : "text-bone-muted hover:text-bone hover:bg-surface-elevated"
              )}
              onClick={() => handleLoadConversation(c.id)}
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
              <div className="flex-1 min-w-0">
                {editingId === c.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-6 text-xs py-0 px-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(c.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRename(c.id); }}
                      className="text-mint hover:text-mint-subtle cursor-pointer"
                    >
                      <CheckCheck className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      className="text-bone-dim hover:text-bone cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <p className="truncate text-xs">{c.title}</p>
                )}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(c.id);
                    setEditTitle(c.title);
                  }}
                  className="p-1 text-bone-dim hover:text-bone cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    conv.remove(c.id);
                  }}
                  className="p-1 text-bone-dim hover:text-heat cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          {conv.conversations.length === 0 && (
            <p className="text-xs text-bone-dim text-center py-8">No conversations yet</p>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <Card className="flex flex-col flex-1 overflow-hidden rounded-none border-0">
        {!sidebarOpen && (
          <div className="p-2 border-b border-border">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-1.5 text-bone-dim hover:text-bone transition-colors text-xs cursor-pointer"
            >
              <PanelLeft className="w-4 h-4" />
              Conversations
            </button>
          </div>
        )}

        {/* Document filter bar */}
        {allDocs.length > 0 && (
          <div className="px-4 py-2 border-b border-border flex items-center gap-2 overflow-x-auto scrollbar-thin">
            <span className="font-mono text-[10px] text-bone-dim tracking-widest uppercase flex-shrink-0">
              Filter:
            </span>
            <button
              onClick={() => setSelectedDocIds([])}
              className={cn(
                "font-mono text-[10px] px-2 py-0.5 border transition-colors flex-shrink-0 cursor-pointer",
                selectedDocIds.length === 0
                  ? "border-violet/40 text-violet-bright bg-violet/10"
                  : "border-border text-bone-dim hover:text-bone"
              )}
            >
              All
            </button>
            {allDocs.map((doc) => (
              <button
                key={doc.document_id}
                onClick={() => toggleDocFilter(doc.document_id)}
                className={cn(
                  "font-mono text-[10px] px-2 py-0.5 border transition-colors flex-shrink-0 cursor-pointer whitespace-nowrap",
                  selectedDocIds.includes(doc.document_id)
                    ? "border-violet/40 text-violet-bright bg-violet/10"
                    : "border-border text-bone-dim hover:text-bone"
                )}
              >
                {doc.document_id}
              </button>
            ))}
          </div>
        )}

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
                      "font-body text-bone"
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
                    <div className="flex items-center gap-2">
                      {msg.model && (
                        <span className="font-mono text-[10px] text-bone-dim tracking-wide uppercase">
                          {msg.model}
                        </span>
                      )}
                      {msg.chunks && msg.chunks.length > 1 && (
                        <button
                          onClick={() => handleVisualize(msg)}
                          className={cn(
                            "flex items-center gap-1 font-mono text-[10px] tracking-wide uppercase transition-colors cursor-pointer",
                            vizMsgId === msg.id
                              ? "text-violet-bright"
                              : "text-bone-dim hover:text-violet-bright"
                          )}
                        >
                          <Eye className="w-3 h-3" />
                          {vizMsgId === msg.id ? "Hide" : "Visualize"}
                        </button>
                      )}
                    </div>
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

          {vizLoading && (
            <div className="flex items-center gap-3 p-4 animate-fade-in-up">
              <div className="w-4 h-4 border-2 border-violet/40 border-t-violet-bright rounded-full animate-spin" />
              <span className="font-mono text-[11px] text-violet-bright tracking-wide uppercase animate-pulse">
                Projecting vectors
              </span>
            </div>
          )}

          {vizData && vizMsgId && (
            <div className="border-t border-border animate-fade-in-up">
              <div className="p-4">
                <h4 className="font-mono text-[11px] text-bone-dim tracking-wide uppercase mb-3">
                  Embedding Space — Query vs Top Chunks (PCA 2D)
                </h4>
                <SearchViz
                  queryX={vizData.query_x}
                  queryY={vizData.query_y}
                  points={vizData.points}
                />
                {vizData.similarity_matrix.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-mono text-[11px] text-bone-dim tracking-wide uppercase mb-2">
                      Chunk Similarity Matrix (cosine)
                    </h4>
                    <div
                      className="grid gap-px"
                      style={{
                        gridTemplateColumns: `repeat(${vizData.similarity_matrix.length}, 28px)`,
                      }}
                    >
                      {vizData.similarity_matrix.map((row, i) =>
                        row.map((val, j) => (
                          <div
                            key={`${i}-${j}`}
                            className="w-7 h-7 flex items-center justify-center font-mono text-[9px]"
                            style={{
                              backgroundColor: `rgba(153, 102, 255, ${val})`,
                              color: val > 0.5 ? "#13101d" : "#b8b3bf",
                            }}
                            title={`${(val * 100).toFixed(0)}%`}
                          >
                            {(val * 100).toFixed(0)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
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
