const BASE_URL = "/api/v1";

async function request<T>(
  path: string,
  options?: RequestInit & { params?: Record<string, string> }
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (options?.params) {
    Object.entries(options.params).forEach(([k, v]) =>
      url.searchParams.set(k, v)
    );
  }
  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: response.statusText,
    }));
    throw new Error(error.detail || `Request failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchHealth(): Promise<{
  status: string;
  version: string;
  uptime_seconds: number;
}> {
  const response = await fetch("/health");
  if (!response.ok) throw new Error("Health check failed");
  return response.json();
}

export async function ingestDocument(
  documentId: string,
  file: File,
  metadata?: Record<string, string>
): Promise<{ document_id: string; chunks_indexed: number; status: string }> {
  const formData = new FormData();
  formData.append("document_id", documentId);
  formData.append("file", file);
  if (metadata) {
    formData.append("metadata", JSON.stringify(metadata));
  }
  const url = `${BASE_URL}/ingest`;
  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || "Upload failed");
  }
  return response.json();
}

export async function queryDocuments(question: string, topK?: number, documentIds?: string[]): Promise<{
  question: string;
  answer: string | null;
  chunks: Array<{ chunk_id: string; text: string; score: number }>;
  model: string | null;
}> {
  return request<{
    question: string;
    answer: string | null;
    chunks: Array<{ chunk_id: string; text: string; score: number }>;
    model: string | null;
  }>("/query", {
    method: "POST",
    body: JSON.stringify({ question, top_k: topK, document_ids: documentIds }),
  });
}

export interface ExplainPoint {
  chunk_id: string;
  text: string;
  score: number;
  x: number;
  y: number;
}

export interface ExplainResponse {
  question: string;
  answer: string | null;
  model: string | null;
  chunks: Array<{ chunk_id: string; text: string; score: number }>;
  query_x: number;
  query_y: number;
  points: ExplainPoint[];
  similarity_matrix: number[][];
}

export async function queryExplain(question: string, topK?: number, documentIds?: string[]): Promise<ExplainResponse> {
  return request<ExplainResponse>("/query/explain", {
    method: "POST",
    body: JSON.stringify({ question, top_k: topK, document_ids: documentIds }),
  });
}

export interface MindmapNode {
  id: string;
  index: number;
  text: string;
  full_text: string;
}

export interface MindmapEdge {
  source: string;
  target: string;
  score: number;
}

export interface MindmapData {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
}

export async function fetchMindmap(
  documentId: string,
  threshold?: number
): Promise<MindmapData> {
  const params = threshold ? `?threshold=${threshold}` : "";
  const response = await fetch(`/api/v1/mindmap/${documentId}${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch mindmap");
  }
  return response.json();
}

export interface DocumentSummary {
  document_id: string;
  chunk_count: number;
}

export async function fetchDocuments(): Promise<{ documents: DocumentSummary[]; total: number }> {
  return request<{ documents: DocumentSummary[]; total: number }>("/documents");
}

export async function deleteDocument(documentId: string): Promise<{ document_id: string; status: string }> {
  return request<{ document_id: string; status: string }>(`/documents/${documentId}`, {
    method: "DELETE",
  });
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface MessageEntry {
  role: string;
  content: string;
  chunks?: Array<{ chunk_id: string; text: string; score: number }>;
  model?: string;
  timestamp: string;
}

export interface ConversationData {
  id: string;
  title: string;
  messages: MessageEntry[];
  created_at: string;
  updated_at: string;
  message_count: number;
}

export async function createConversation(title: string): Promise<ConversationData> {
  return request<ConversationData>("/conversations", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function listConversations(): Promise<{ conversations: ConversationSummary[]; total: number }> {
  return request<{ conversations: ConversationSummary[]; total: number }>("/conversations");
}

export async function getConversation(id: string): Promise<ConversationData> {
  return request<ConversationData>(`/conversations/${id}`);
}

export async function updateConversationTitle(id: string, title: string): Promise<ConversationData> {
  return request<ConversationData>(`/conversations/${id}/title`, {
    method: "PUT",
    body: JSON.stringify({ title }),
  });
}

export async function addConversationMessage(id: string, msg: Omit<MessageEntry, "timestamp">): Promise<ConversationData> {
  return request<ConversationData>(`/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ ...msg, timestamp: new Date().toISOString() }),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await request<{ status: string }>(`/conversations/${id}`, {
    method: "DELETE",
  });
}

export interface AnalyticsStats {
  total_queries: number;
  unique_questions: number;
  avg_latency_ms: number;
  avg_chunks_per_query: number;
  top_questions: Array<{ question: string; count: number }>;
  queries_today: number;
  queries_this_hour: number;
  total_documents_queried: number;
}

export async function fetchAnalyticsStats(): Promise<AnalyticsStats> {
  return request<AnalyticsStats>("/analytics/stats");
}

export async function generateFlashcards(
  documentId: string,
  cardCount?: number
): Promise<{ cards: Array<{ question: string; answer: string }>; total: number }> {
  return request<{ cards: Array<{ question: string; answer: string }>; total: number }>(
    "/flashcards",
    {
      method: "POST",
      body: JSON.stringify({ document_id: documentId, card_count: cardCount || 8 }),
    }
  );
}
