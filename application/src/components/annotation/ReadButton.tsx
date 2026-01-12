import React, { useState, useCallback } from 'react';

interface ReadButtonProps {
  onRead: () => Promise<{
    text: string;
    modelId: string;
    confidence?: number;
  }>;
  onTextExtracted: (
    text: string,
    metadata: {
      modelId: string;
      modelProvider: string;
      timestamp: string;
      confidence?: number;
    }
  ) => void;
  disabled?: boolean;
  hasBox?: boolean;
  className?: string;
  language?: string;
}

/**
 * AI text extraction button for annotation workflow.
 * Calls Bedrock Lambda to read text from selected bounding box.
 */
export function ReadButton({
  onRead,
  onTextExtracted,
  disabled = false,
  hasBox = false,
  className = '',
  language = 'en',
}: ReadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labels = {
    en: {
      read: '📖 Read',
      reading: 'Reading...',
      noBox: 'Draw box first',
      error: 'Error reading',
      retry: 'Retry',
    },
    ja: {
      read: '📖 読み取る',
      reading: '読み取り中...',
      noBox: 'まず枠を描画',
      error: '読み取りエラー',
      retry: '再試行',
    },
    zh: {
      read: '📖 读取',
      reading: '读取中...',
      noBox: '先画框',
      error: '读取错误',
      retry: '重试',
    },
    ko: {
      read: '📖 읽기',
      reading: '읽는 중...',
      noBox: '먼저 박스 그리기',
      error: '읽기 오류',
      retry: '재시도',
    },
  };

  const t = labels[language as keyof typeof labels] || labels.en;

  const handleClick = useCallback(async () => {
    if (isLoading || disabled || !hasBox) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await onRead();

      const metadata = {
        modelId: result.modelId,
        modelProvider: 'bedrock',
        timestamp: new Date().toISOString(),
        confidence: result.confidence,
      };

      onTextExtracted(result.text, metadata);
    } catch (err) {
      console.error('Error reading text:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, disabled, hasBox, onRead, onTextExtracted]);

  const getButtonText = () => {
    if (isLoading) return t.reading;
    if (error) return t.retry;
    if (!hasBox) return t.noBox;
    return t.read;
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: hasBox && !disabled ? '#6366f1' : '#d1d5db',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: hasBox && !disabled && !isLoading ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s ease',
    minHeight: '48px',
    width: '100%', // Full width for mobile
    opacity: isLoading ? 0.7 : 1,
  };

  const errorStyle: React.CSSProperties = {
    color: '#dc2626',
    fontSize: '12px',
    marginTop: '4px',
    textAlign: 'center',
  };

  const spinnerStyle: React.CSSProperties = {
    animation: 'spin 1s linear infinite',
  };

  return (
    <div className={`read-button ${className}`}>
      <button
        type="button"
        style={buttonStyle}
        onClick={handleClick}
        disabled={disabled || !hasBox || isLoading}
        title={!hasBox ? t.noBox : t.read}
      >
        {isLoading ? (
          <>
            <span style={spinnerStyle}>⏳</span>
            {t.reading}
          </>
        ) : error ? (
          <>
            <span>🔄</span>
            {t.retry}
          </>
        ) : (
          getButtonText()
        )}
      </button>
      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );
}

/**
 * Simple loading spinner keyframes (add to CSS)
 */
export const spinKeyframes = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;
