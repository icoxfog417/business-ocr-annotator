import { useState, useEffect, useCallback } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

// Breakpoint thresholds (in pixels)
export const BREAKPOINTS = {
  mobile: 768, // < 768px (includes most smartphones and small tablets)
  tablet: 1024, // 768px - 1024px
  // desktop: > 1024px
} as const;

export interface UseBreakpointReturn {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
}

/**
 * Get the current breakpoint based on window width
 */
function getBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.mobile) {
    return 'mobile';
  }
  if (width < BREAKPOINTS.tablet) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * Hook to detect responsive breakpoints.
 * Returns current breakpoint and boolean flags for each breakpoint.
 */
export function useBreakpoint(): UseBreakpointReturn {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : BREAKPOINTS.tablet
  );

  const handleResize = useCallback(() => {
    setWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  const breakpoint = getBreakpoint(width);

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    width,
  };
}

/**
 * Check if current viewport is mobile (without using hook - for SSR)
 */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < BREAKPOINTS.mobile;
}

/**
 * Check if current viewport is tablet (without using hook - for SSR)
 */
export function isTabletViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const width = window.innerWidth;
  return width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
}

/**
 * Check if current viewport is desktop (without using hook - for SSR)
 */
export function isDesktopViewport(): boolean {
  if (typeof window === 'undefined') return true;
  return window.innerWidth >= BREAKPOINTS.tablet;
}
