import { useState, useEffect, useCallback } from 'react';
import { client } from '../lib/apiClient';

interface AnnotationCountsData {
  annotations: { total: number; pending: number; approved: number; rejected: number };
  images: { total: number; exportable: number };
}

interface AnnotationCounts extends AnnotationCountsData {
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_COUNTS: AnnotationCountsData = {
  annotations: { total: 0, pending: 0, approved: 0, rejected: 0 },
  images: { total: 0, exportable: 0 },
};

/**
 * Hook to fetch annotation and image counts via server-side Lambda.
 * Replaces client-side counting with efficient DynamoDB COUNT queries.
 */
export function useAnnotationCounts(): AnnotationCounts {
  const [data, setData] = useState<AnnotationCountsData>(DEFAULT_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await client.queries.getAnnotationCounts({});
      if (result.data) {
        const parsed: AnnotationCountsData =
          typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
        setData(parsed);
      }
    } catch (err) {
      console.error('Failed to fetch annotation counts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch counts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return {
    ...data,
    isLoading,
    error,
    refetch: fetchCounts,
  };
}
