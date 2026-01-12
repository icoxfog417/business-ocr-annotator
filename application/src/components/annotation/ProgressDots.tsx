/* eslint-disable react-refresh/only-export-components */
import React from 'react';

export type QuestionStatus = 'pending' | 'current' | 'completed' | 'skipped';

interface ProgressDotsProps {
  total: number;
  current: number;
  statuses?: QuestionStatus[];
  onDotClick?: (index: number) => void;
  className?: string;
  showCount?: boolean;
}

/**
 * Visual progress dots for question navigation.
 * Shows completion status for each question.
 */
export function ProgressDots({
  total,
  current,
  statuses = [],
  onDotClick,
  className = '',
  showCount = true,
}: ProgressDotsProps) {
  const getStatus = (index: number): QuestionStatus => {
    if (statuses[index]) {
      return statuses[index];
    }
    if (index === current) {
      return 'current';
    }
    if (index < current) {
      return 'completed';
    }
    return 'pending';
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  };

  const dotsContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    maxWidth: '100%',
  };

  const getDotStyle = (status: QuestionStatus, clickable: boolean): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      transition: 'all 0.2s ease',
      cursor: clickable ? 'pointer' : 'default',
    };

    switch (status) {
      case 'current':
        return {
          ...baseStyle,
          backgroundColor: '#3b82f6',
          border: '2px solid #3b82f6',
          transform: 'scale(1.3)',
          boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.2)',
        };
      case 'completed':
        return {
          ...baseStyle,
          backgroundColor: '#10b981',
          border: '2px solid #10b981',
        };
      case 'skipped':
        return {
          ...baseStyle,
          backgroundColor: '#f59e0b',
          border: '2px solid #f59e0b',
        };
      case 'pending':
      default:
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          border: '2px solid #d1d5db',
        };
    }
  };

  const countStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
  };

  return (
    <div className={`progress-dots ${className}`} style={containerStyle}>
      <div style={dotsContainerStyle}>
        {Array.from({ length: total }, (_, index) => {
          const status = getStatus(index);
          return (
            <button
              key={index}
              type="button"
              style={getDotStyle(status, !!onDotClick)}
              onClick={() => onDotClick?.(index)}
              aria-label={`Question ${index + 1} - ${status}`}
              aria-current={status === 'current' ? 'step' : undefined}
              disabled={!onDotClick}
            />
          );
        })}
      </div>
      {showCount && (
        <div style={countStyle}>
          {current + 1} / {total}
        </div>
      )}
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
