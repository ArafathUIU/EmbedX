import { useState, useCallback } from "react";
import { queryDocuments } from "../api/client";

interface Chunk {
  chunk_id: string;
  text: string;
  score: number;
}

interface QueryResult {
  question: string;
  answer: string | null;
  chunks: Chunk[];
  model: string | null;
}

interface UseQueryReturn {
  ask: (question: string, topK?: number, documentIds?: string[]) => Promise<QueryResult>;
  isLoading: boolean;
  error: string | null;
  result: QueryResult | null;
  clear: () => void;
}

export function useQuery(): UseQueryReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);

  const ask = useCallback(async (question: string, topK?: number, documentIds?: string[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await queryDocuments(question, topK, documentIds);
      setResult(res);
      return res;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Query failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { ask, isLoading, error, result, clear };
}
