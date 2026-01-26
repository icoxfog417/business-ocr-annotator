import React from 'react';

interface QuestionNavigatorProps {
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isLastQuestion: boolean;
  className?: string;
  language?: string;
}

/**
 * Navigation component for question-by-question annotation flow.
 * Provides Previous, Skip, and Next/Finish buttons.
 */
export function QuestionNavigator({
  onPrevious,
  onNext,
  onSkip,
  canGoPrevious,
  canGoNext,
  isLastQuestion,
  className = '',
  language = 'en',
}: QuestionNavigatorProps) {
  const labels = {
    en: {
      previous: '← Prev',
      skip: 'Skip',
      next: 'Next →',
      finish: 'Finish →',
    },
    ja: {
      previous: '← 前へ',
      skip: 'スキップ',
      next: '次へ →',
      finish: '完了 →',
    },
    zh: {
      previous: '← 上一个',
      skip: '跳过',
      next: '下一个 →',
      finish: '完成 →',
    },
    ko: {
      previous: '← 이전',
      skip: '건너뛰기',
      next: '다음 →',
      finish: '완료 →',
    },
  };

  const t = labels[language as keyof typeof labels] || labels.en;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
  };

  const navigationStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  };

  const buttonBaseStyle: React.CSSProperties = {
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '48px',
    minWidth: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const prevButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: canGoPrevious ? '#ffffff' : '#f3f4f6',
    border: '1px solid #e5e7eb',
    color: canGoPrevious ? '#374151' : '#9ca3af',
    cursor: canGoPrevious ? 'pointer' : 'not-allowed',
    opacity: canGoPrevious ? 1 : 0.5,
  };

  const skipButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: '#ffffff',
    border: '1px solid #f59e0b',
    color: '#f59e0b',
  };

  const nextButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: canGoNext ? '#3b82f6' : '#d1d5db',
    border: 'none',
    color: '#ffffff',
    cursor: canGoNext ? 'pointer' : 'not-allowed',
  };

  const finishButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: '#10b981',
    border: 'none',
    color: '#ffffff',
  };

  return (
    <div className={`question-navigator ${className}`} style={containerStyle}>
      {/* Navigation Buttons */}
      <div style={navigationStyle}>
        <button
          type="button"
          style={prevButtonStyle}
          onClick={onPrevious}
          disabled={!canGoPrevious}
        >
          {t.previous}
        </button>

        <button
          type="button"
          style={skipButtonStyle}
          onClick={onSkip}
        >
          {t.skip}
        </button>

        {isLastQuestion ? (
          <button
            type="button"
            style={finishButtonStyle}
            onClick={onNext}
          >
            {t.finish}
          </button>
        ) : (
          <button
            type="button"
            style={nextButtonStyle}
            onClick={onNext}
            disabled={!canGoNext}
          >
            {t.next}
          </button>
        )}
      </div>
    </div>
  );
}
