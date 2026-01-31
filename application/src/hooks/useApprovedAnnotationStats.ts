import { useState, useEffect, useCallback } from 'react';
import { listAllItems } from '../lib/paginatedList';

interface ApprovedAnnotationStats {
  annotationCount: number;
  imageCount: number;
  pendingAnnotationCount: number;
  pendingImageCount: number;
  totalExportableAnnotationCount: number;
  totalExportableImageCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch statistics for annotations available for export.
 * Returns counts for APPROVED and PENDING annotations, plus totals.
 * PENDING annotations are auto-approved during the export flow.
 */
export function useApprovedAnnotationStats(): ApprovedAnnotationStats {
  const [annotationCount, setAnnotationCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [pendingAnnotationCount, setPendingAnnotationCount] = useState(0);
  const [pendingImageCount, setPendingImageCount] = useState(0);
  const [totalExportableAnnotationCount, setTotalExportableAnnotationCount] = useState(0);
  const [totalExportableImageCount, setTotalExportableImageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch both APPROVED and PENDING annotations in parallel (with pagination)
      const [approved, pending] = await Promise.all([
        listAllItems<{ imageId: string }>('Annotation', {
          filter: { validationStatus: { eq: 'APPROVED' } },
        }),
        listAllItems<{ imageId: string }>('Annotation', {
          filter: { validationStatus: { eq: 'PENDING' } },
        }),
      ]);

      const approvedImageIds = new Set(approved.map((a) => a.imageId));
      const pendingImageIds = new Set(pending.map((a) => a.imageId));
      const allExportableImageIds = new Set([...approvedImageIds, ...pendingImageIds]);

      setAnnotationCount(approved.length);
      setImageCount(approvedImageIds.size);
      setPendingAnnotationCount(pending.length);
      setPendingImageCount(pendingImageIds.size);
      setTotalExportableAnnotationCount(approved.length + pending.length);
      setTotalExportableImageCount(allExportableImageIds.size);
    } catch (err) {
      console.error('Failed to fetch annotation stats:', err);
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
    pendingAnnotationCount,
    pendingImageCount,
    totalExportableAnnotationCount,
    totalExportableImageCount,
    isLoading,
    error,
    refetch: fetchStats,
  };
}
