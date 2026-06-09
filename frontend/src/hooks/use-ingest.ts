import { useState, useCallback } from "react";
import { ingestDocument } from "../api/client";

interface IngestResult {
  document_id: string;
  chunks_indexed: number;
  status: string;
}

interface UseIngestReturn {
  upload: (
    documentId: string,
    file: File,
    metadata?: Record<string, string>
  ) => Promise<IngestResult>;
  isLoading: boolean;
  error: string | null;
  result: IngestResult | null;
}

export function useIngest(): UseIngestReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);

  const upload = useCallback(
    async (
      documentId: string,
      file: File,
      metadata?: Record<string, string>
    ) => {
      setIsLoading(true);
      setError(null);
      setResult(null);
      try {
        const res = await ingestDocument(documentId, file, metadata);
        setResult(res);
        return res;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Upload failed";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { upload, isLoading, error, result };
}
