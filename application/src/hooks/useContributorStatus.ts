import { useState, useEffect, useCallback } from 'react';
import { fetchUserAttributes, updateUserAttributes } from 'aws-amplify/auth';

const CONSENT_VERSION = '1.0';

export interface ContributorStatus {
  isContributor: boolean;
  isLoading: boolean;
  error: string | null;
  consentDate: string | null;
  consentVersion: string | null;
}

export interface UseContributorStatusReturn extends ContributorStatus {
  becomeContributor: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

/**
 * Hook to manage contributor consent status via Cognito custom attributes.
 *
 * Reads and writes the following Cognito custom attributes:
 * - custom:contributor - "true" when user has consented
 * - custom:consent_date - ISO timestamp of consent
 * - custom:consent_version - Version of consent terms (e.g., "1.0")
 */
export function useContributorStatus(): UseContributorStatusReturn {
  const [status, setStatus] = useState<ContributorStatus>({
    isContributor: false,
    isLoading: true,
    error: null,
    consentDate: null,
    consentVersion: null,
  });

  /**
   * Fetch current contributor status from Cognito
   */
  const refreshStatus = useCallback(async () => {
    setStatus((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const attributes = await fetchUserAttributes();

      const isContributor = attributes['custom:contributor'] === 'true';
      const consentDate = attributes['custom:consent_date'] || null;
      const consentVersion = attributes['custom:consent_version'] || null;

      setStatus({
        isContributor,
        isLoading: false,
        error: null,
        consentDate,
        consentVersion,
      });
    } catch (error) {
      console.error('Failed to fetch contributor status:', error);
      setStatus((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch status',
      }));
    }
  }, []);

  /**
   * Update user to contributor status after consent
   */
  const becomeContributor = useCallback(async (): Promise<boolean> => {
    setStatus((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const consentDate = new Date().toISOString();

      await updateUserAttributes({
        userAttributes: {
          'custom:contributor': 'true',
          'custom:consent_date': consentDate,
          'custom:consent_version': CONSENT_VERSION,
        },
      });

      setStatus({
        isContributor: true,
        isLoading: false,
        error: null,
        consentDate,
        consentVersion: CONSENT_VERSION,
      });

      return true;
    } catch (error) {
      console.error('Failed to update contributor status:', error);
      setStatus((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update status',
      }));
      return false;
    }
  }, []);

  // Fetch status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    ...status,
    becomeContributor,
    refreshStatus,
  };
}
