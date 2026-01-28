import { useState, useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

/**
 * Hook to check if the current user is an administrator.
 * Checks for membership in the 'Admins' Cognito group.
 *
 * To add a user to the Admins group:
 * 1. Go to AWS Console > Cognito > User Pools
 * 2. Select the user pool
 * 3. Create a group named 'Admins' if it doesn't exist
 * 4. Add the user to the 'Admins' group
 */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const session = await fetchAuthSession();
        const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];
        setIsAdmin(groups.includes('Admins'));
      } catch (error) {
        console.error('Failed to check admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdmin();
  }, []);

  return { isAdmin, isLoading };
}
