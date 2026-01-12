/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useContributorStatus } from '../hooks/useContributorStatus';
import type { UseContributorStatusReturn } from '../hooks/useContributorStatus';

/**
 * Context for sharing contributor status across the application.
 * Provides cached contributor status and update functions.
 */
const ContributorContext = createContext<UseContributorStatusReturn | null>(null);

interface ContributorProviderProps {
  children: ReactNode;
}

/**
 * Provider component that wraps the app and provides contributor status.
 * Use this at the app root to make contributor status available everywhere.
 */
export function ContributorProvider({ children }: ContributorProviderProps) {
  const contributorStatus = useContributorStatus();

  return (
    <ContributorContext.Provider value={contributorStatus}>{children}</ContributorContext.Provider>
  );
}

/**
 * Hook to access contributor status from context.
 * Must be used within a ContributorProvider.
 *
 * @throws Error if used outside of ContributorProvider
 */
export function useContributor(): UseContributorStatusReturn {
  const context = useContext(ContributorContext);

  if (!context) {
    throw new Error('useContributor must be used within a ContributorProvider');
  }

  return context;
}

/**
 * Hook to check if user is a contributor (convenience wrapper).
 * Returns false while loading.
 */
export function useIsContributor(): boolean {
  const { isContributor, isLoading } = useContributor();
  return !isLoading && isContributor;
}
