/* eslint-disable react-refresh/only-export-components */
import React from 'react';

export type QuestionStatus = 'pending' | 'current' | 'completed' | 'skipped' | 'unanswerable';

interface ProgressDotsProps {
  total: number;
  current: number;
  statuses?: QuestionStatus[];
  onDotClick?: (index: number) => void;
  className?: string;
  showCount?: boolean;
}

/**
 * Simple progress indicator showing current question number.
 * Optimized for mobile with text-only display.
 */
export function ProgressDots({
  total,
  current,
  className = '',
}: ProgressDotsProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 16px',
  };

  const progressTextStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151',
  };

  return (
    <div className={`progress-dots ${className}`} style={containerStyle}>
      <div style={progressTextStyle}>
        {current + 1} / {total}
      </div>
    </div>
  );
}

/**
 * Get status icon for a question
 */
export function getStatusIcon(status: QuestionStatus): string {
  switch (status) {
    case 'completed':
      return '✓';
    case 'current':
      return '●';
    case 'skipped':
      return '○';
    case 'pending':
    default:
      return '○';
  }
}
