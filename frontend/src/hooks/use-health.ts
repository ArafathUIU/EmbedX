import { useEffect, useState, useCallback } from "react";
import { fetchHealth } from "../api/client";

interface HealthData {
  status: string;
  version: string;
  uptime_seconds: number;
}

interface UseHealthReturn {
  data: HealthData | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useHealth(): UseHealthReturn {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchHealth();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check health");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 15000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { data, error, isLoading, refetch };
}
