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

export async function queryDocuments(question: string, topK?: number): Promise<{
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
    body: JSON.stringify({ question, top_k: topK }),
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
