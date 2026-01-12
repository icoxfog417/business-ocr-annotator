import React from 'react';
import type { ReactNode } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { StackedLayout } from './StackedLayout';

type SplitRatio = '50-50' | '60-40' | '40-60' | '70-30' | '30-70';

interface SplitLayoutProps {
  left: ReactNode;
  right: ReactNode;
  ratio?: SplitRatio;
  gap?: number | string;
  padding?: number | string;
  className?: string;
  style?: React.CSSProperties;
  /**
   * If true, stack vertically on mobile. Default is true.
   */
  stackOnMobile?: boolean;
  /**
   * Order of panels when stacked on mobile: 'left-first' | 'right-first'
   */
  mobileOrder?: 'left-first' | 'right-first';
}

const RATIO_MAP: Record<SplitRatio, string> = {
  '50-50': '1fr 1fr',
  '60-40': '60fr 40fr',
  '40-60': '40fr 60fr',
  '70-30': '70fr 30fr',
  '30-70': '30fr 70fr',
};

/**
 * Side-by-side layout for tablet/desktop.
 * Automatically stacks on mobile unless stackOnMobile is false.
 */
export function SplitLayout({
  left,
  right,
  ratio = '50-50',
  gap = 24,
  padding = 24,
  className = '',
  style,
  stackOnMobile = true,
  mobileOrder = 'left-first',
}: SplitLayoutProps) {
  const { isMobile } = useBreakpoint();

  // On mobile, use stacked layout
  if (isMobile && stackOnMobile) {
    return (
      <StackedLayout gap={gap} padding={padding} className={className} style={style}>
        {mobileOrder === 'left-first' ? (
          <>
            {left}
            {right}
          </>
        ) : (
          <>
            {right}
            {left}
          </>
        )}
      </StackedLayout>
    );
  }

  const layoutStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: RATIO_MAP[ratio],
    gap: typeof gap === 'number' ? `${gap}px` : gap,
    padding: typeof padding === 'number' ? `${padding}px` : padding,
    width: '100%',
    minHeight: '100%',
    boxSizing: 'border-box',
    ...style,
  };

  return (
    <div className={`split-layout ${className}`} style={layoutStyle}>
      <div className="split-left">{left}</div>
      <div className="split-right">{right}</div>
    </div>
  );
}

interface SplitPanelProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  scrollable?: boolean;
}

/**
 * Panel within a split layout
 */
export function SplitPanel({
  children,
  className = '',
  style,
  scrollable = false,
}: SplitPanelProps) {
  const panelStyle: React.CSSProperties = {
    ...(scrollable
      ? {
          overflow: 'auto',
          maxHeight: '100vh',
        }
      : {}),
    ...style,
  };

  return (
    <div className={`split-panel ${className}`} style={panelStyle}>
      {children}
    </div>
  );
}
