import React, { useState } from 'react';

// Import consent translations
import enConsent from '../../i18n/consent/en.json';
import jaConsent from '../../i18n/consent/ja.json';
import zhConsent from '../../i18n/consent/zh.json';
import koConsent from '../../i18n/consent/ko.json';

type ConsentTranslation = typeof enConsent;

const TRANSLATIONS: Record<string, ConsentTranslation> = {
  en: enConsent,
  ja: jaConsent,
  zh: zhConsent,
  ko: koConsent,
};

interface StartContributingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => Promise<boolean>;
  language?: string;
}

/**
 * Multi-language consent dialog for becoming a contributor.
 * Shows data usage terms and requires explicit checkbox consent.
 */
export function StartContributingDialog({
  isOpen,
  onClose,
  onAccept,
  language = 'en',
}: StartContributingDialogProps) {
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const t = TRANSLATIONS[language] || TRANSLATIONS['en'];

  if (!isOpen) {
    return null;
  }

  const handleAccept = async () => {
    if (!isChecked) return;

    setIsLoading(true);
    try {
      const success = await onAccept();
      if (success) {
        onClose();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Styles
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '16px',
  };

  const dialogStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  };

  const headerStyle: React.CSSProperties = {
    padding: '24px 24px 16px',
    borderBottom: '1px solid #e5e7eb',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 700,
    color: '#111827',
    margin: 0,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '4px',
  };

  const bodyStyle: React.CSSProperties = {
    padding: '24px',
  };

  const messageBoxStyle: React.CSSProperties = {
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#374151',
  };

  const warningBoxStyle: React.CSSProperties = {
    backgroundColor: '#fef3c7',
    border: '1px solid #f59e0b',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    fontSize: '14px',
    color: '#92400e',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  };

  const checkboxContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    marginTop: '16px',
    cursor: 'pointer',
  };

  const checkboxStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    marginTop: '2px',
    flexShrink: 0,
    cursor: 'pointer',
  };

  const footerStyle: React.CSSProperties = {
    padding: '16px 24px 24px',
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  };

  const buttonBaseStyle: React.CSSProperties = {
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '48px',
  };

  const cancelButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    color: '#374151',
  };

  const acceptButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: isChecked ? '#3b82f6' : '#d1d5db',
    border: 'none',
    color: '#ffffff',
    opacity: isLoading ? 0.7 : 1,
    cursor: isChecked && !isLoading ? 'pointer' : 'not-allowed',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={headerStyle}>
          <h2 style={titleStyle}>{t.title}</h2>
          <p style={subtitleStyle}>{t.subtitle}</p>
        </div>

        <div style={bodyStyle}>
          <div style={messageBoxStyle}>
            <p style={{ margin: '0 0 12px' }}>{t.message}</p>
            <p style={{ margin: '0 0 12px' }}>{t.publicNotice}</p>
            <p style={{ margin: 0 }}>{t.acknowledgment}</p>
          </div>

          <div style={warningBoxStyle}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <span>{t.warning}</span>
          </div>

          <label style={checkboxContainerStyle}>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              style={checkboxStyle}
            />
            <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>
              {t.checkbox}
            </span>
          </label>
        </div>

        <div style={footerStyle}>
          <button style={cancelButtonStyle} onClick={onClose} type="button">
            {t.cancel}
          </button>
          <button
            style={acceptButtonStyle}
            onClick={handleAccept}
            disabled={!isChecked || isLoading}
            type="button"
          >
            {isLoading ? '...' : t.agree}
          </button>
        </div>
      </div>
    </div>
  );
}
