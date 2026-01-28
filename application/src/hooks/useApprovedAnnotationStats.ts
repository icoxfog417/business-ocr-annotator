import { useState, useEffect, useCallback } from 'react';
import { client } from '../lib/apiClient';

interface ApprovedAnnotationStats {
  annotationCount: number;
  imageCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch statistics for approved annotations.
 * Returns the count of APPROVED annotations and unique images.
 */
export function useApprovedAnnotationStats(): ApprovedAnnotationStats {
  const [annotationCount, setAnnotationCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Query annotations with APPROVED status using the GSI
      const result = await client.models.Annotation.list({
        filter: {
          validationStatus: { eq: 'APPROVED' },
        },
      });

      const annotations = result.data || [];
      const uniqueImageIds = new Set(
        annotations.map((a: { imageId: string }) => a.imageId)
      );

      setAnnotationCount(annotations.length);
      setImageCount(uniqueImageIds.size);
    } catch (err) {
      console.error('Failed to fetch approved annotation stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    annotationCount,
    imageCount,
    isLoading,
    error,
    refetch: fetchStats,
  };
}
