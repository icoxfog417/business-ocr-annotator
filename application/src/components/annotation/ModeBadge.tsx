import React from 'react';
import type { TouchMode } from './TouchCanvas';

interface ModeBadgeProps {
  mode: TouchMode;
  onToggle: () => void;
  className?: string;
  language?: string;
}

/**
 * Tappable mode indicator badge.
 * Shows current mode (VIEW/DRAW) and allows toggling.
 */
export function ModeBadge({
  mode,
  onToggle,
  className = '',
  language = 'en',
}: ModeBadgeProps) {
  const labels = {
    en: {
      view: 'VIEW',
      draw: 'DRAW',
    },
    ja: {
      view: '閲覧',
      draw: '描画',
    },
    zh: {
      view: '查看',
      draw: '绘制',
    },
    ko: {
      view: '보기',
      draw: '그리기',
    },
  };

  const t = labels[language as keyof typeof labels] || labels.en;

  const badgeStyle: React.CSSProperties = {
    position: 'fixed',
    top: '56px',
    right: '16px',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    minWidth: '64px',
    minHeight: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    zIndex: 100,
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    backgroundColor: mode === 'draw' ? '#3b82f6' : '#6b7280',
    color: '#ffffff',
    animation: mode === 'draw' ? 'pulse 1.5s infinite' : 'none',
  };

  const iconStyle: React.CSSProperties = {
    marginRight: '6px',
    fontSize: '14px',
  };

  return (
    <button
      type="button"
      className={`mode-badge ${mode} ${className}`}
      style={badgeStyle}
      onClick={onToggle}
      aria-label={`Current mode: ${mode}. Click to toggle.`}
    >
      <span style={iconStyle}>
        {mode === 'draw' ? '✏️' : '👁️'}
      </span>
      {mode === 'draw' ? t.draw : t.view}
    </button>
  );
}

/**
 * Draw Box button to enter draw mode
 */
interface DrawBoxButtonProps {
  onClick: () => void;
  isDrawMode: boolean;
  disabled?: boolean;
  className?: string;
  language?: string;
}

export function DrawBoxButton({
  onClick,
  isDrawMode,
  disabled = false,
  className = '',
  language = 'en',
}: DrawBoxButtonProps) {
  const labels = {
    en: {
      drawBox: 'Draw Box',
      drawing: 'Drawing...',
      cancel: 'Cancel',
    },
    ja: {
      drawBox: '枠を描画',
      drawing: '描画中...',
      cancel: 'キャンセル',
    },
    zh: {
      drawBox: '画框',
      drawing: '绘制中...',
      cancel: '取消',
    },
    ko: {
      drawBox: '박스 그리기',
      drawing: '그리는 중...',
      cancel: '취소',
    },
  };

  const t = labels[language as keyof typeof labels] || labels.en;

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: isDrawMode ? '#ef4444' : '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '48px',
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <button
      type="button"
      className={`draw-box-button ${className}`}
      style={buttonStyle}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{isDrawMode ? '✕' : '✏️'}</span>
      {isDrawMode ? t.cancel : t.drawBox}
    </button>
  );
}
