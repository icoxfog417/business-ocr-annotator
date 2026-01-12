/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { UseBreakpointReturn } from '../../hooks/useBreakpoint';

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Context to share breakpoint info with child components
 */
const ResponsiveContext = createContext<UseBreakpointReturn | null>(null);

/**
 * Hook to access breakpoint context
 */
export function useResponsive(): UseBreakpointReturn {
  const context = useContext(ResponsiveContext);
  if (!context) {
    throw new Error('useResponsive must be used within a ResponsiveContainer');
  }
  return context;
}

/**
 * Wrapper component that provides breakpoint context to children.
 * Use this at the page level to enable responsive behavior.
 */
export function ResponsiveContainer({ children, className = '', style }: ResponsiveContainerProps) {
  const breakpoint = useBreakpoint();

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    ...style,
  };

  return (
    <ResponsiveContext.Provider value={breakpoint}>
      <div
        className={`responsive-container ${breakpoint.breakpoint} ${className}`}
        style={containerStyle}
        data-breakpoint={breakpoint.breakpoint}
      >
        {children}
      </div>
    </ResponsiveContext.Provider>
  );
}

/**
 * Render children only on mobile
 */
export function MobileOnly({ children }: { children: ReactNode }) {
  const { isMobile } = useBreakpoint();
  return isMobile ? <>{children}</> : null;
}

/**
 * Render children only on tablet
 */
export function TabletOnly({ children }: { children: ReactNode }) {
  const { isTablet } = useBreakpoint();
  return isTablet ? <>{children}</> : null;
}

/**
 * Render children only on desktop
 */
export function DesktopOnly({ children }: { children: ReactNode }) {
  const { isDesktop } = useBreakpoint();
  return isDesktop ? <>{children}</> : null;
}

/**
 * Render children on mobile and tablet (not desktop)
 */
export function NotDesktop({ children }: { children: ReactNode }) {
  const { isDesktop } = useBreakpoint();
  return !isDesktop ? <>{children}</> : null;
}

/**
 * Render children on tablet and desktop (not mobile)
 */
export function NotMobile({ children }: { children: ReactNode }) {
  const { isMobile } = useBreakpoint();
  return !isMobile ? <>{children}</> : null;
}
