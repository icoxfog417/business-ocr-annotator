import React from 'react';
import type { ReactNode } from 'react';

interface StackedLayoutProps {
  children: ReactNode;
  gap?: number | string;
  padding?: number | string;
  className?: string;
  style?: React.CSSProperties;
  withMobileNavSpacing?: boolean;
}

/**
 * Mobile-first vertical stacking layout.
 * Full-width content areas with configurable gap.
 */
export function StackedLayout({
  children,
  gap = 16,
  padding = 16,
  className = '',
  style,
  withMobileNavSpacing = true,
}: StackedLayoutProps) {
  const layoutStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: typeof gap === 'number' ? `${gap}px` : gap,
    padding: typeof padding === 'number' ? `${padding}px` : padding,
    paddingBottom: withMobileNavSpacing
      ? `calc(${typeof padding === 'number' ? `${padding}px` : padding} + var(--mobile-nav-height, 60px) + var(--safe-area-bottom, 0px))`
      : typeof padding === 'number'
        ? `${padding}px`
        : padding,
    width: '100%',
    minHeight: '100%',
    boxSizing: 'border-box',
    ...style,
  };

  return (
    <div className={`stacked-layout ${className}`} style={layoutStyle}>
      {children}
    </div>
  );
}

interface StackedSectionProps {
  children: ReactNode;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Section within a stacked layout with optional title
 */
export function StackedSection({ children, title, className = '', style }: StackedSectionProps) {
  const sectionStyle: React.CSSProperties = {
    width: '100%',
    ...style,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div className={`stacked-section ${className}`} style={sectionStyle}>
      {title && <div style={titleStyle}>{title}</div>}
      {children}
    </div>
  );
}
