import React, { useState } from 'react';
import { useContributor } from '../../contexts/ContributorContext';
import { StartContributingDialog } from './StartContributingDialog';

// Import translations
import enConsent from '../../i18n/consent/en.json';
import jaConsent from '../../i18n/consent/ja.json';
import zhConsent from '../../i18n/consent/zh.json';
import koConsent from '../../i18n/consent/ko.json';

type BannerTranslation = {
  banner: {
    title: string;
    description: string;
    button: string;
  };
};

const TRANSLATIONS: Record<string, BannerTranslation> = {
  en: enConsent,
  ja: jaConsent,
  zh: zhConsent,
  ko: koConsent,
};

interface StartContributingBannerProps {
  language?: string;
  className?: string;
  onBecomeContributor?: () => void;
}

/**
 * Banner displayed on dashboard for non-contributors.
 * Prompts users to start contributing with a call-to-action.
 */
export function StartContributingBanner({
  language = 'en',
  className = '',
  onBecomeContributor,
}: StartContributingBannerProps) {
  const { isContributor, isLoading, becomeContributor } = useContributor();
  const [showDialog, setShowDialog] = useState(false);

  const t = TRANSLATIONS[language] || TRANSLATIONS['en'];

  // Don't show banner if already a contributor or loading
  if (isContributor || isLoading) {
    return null;
  }

  const handleAccept = async () => {
    const success = await becomeContributor();
    if (success && onBecomeContributor) {
      onBecomeContributor();
    }
    return success;
  };

  const bannerStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
  };

  const contentStyle: React.CSSProperties = {
    flex: '1 1 300px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 700,
    margin: '0 0 8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '14px',
    margin: 0,
    opacity: 0.9,
    lineHeight: '1.5',
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    color: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '48px',
    whiteSpace: 'nowrap',
  };

  return (
    <>
      <div className={`start-contributing-banner ${className}`} style={bannerStyle}>
        <div style={contentStyle}>
          <h3 style={titleStyle}>
            <span>🚀</span>
            {t.banner.title}
          </h3>
          <p style={descriptionStyle}>{t.banner.description}</p>
        </div>
        <button
          style={buttonStyle}
          onClick={() => setShowDialog(true)}
          type="button"
        >
          {t.banner.button}
        </button>
      </div>

      <StartContributingDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        onAccept={handleAccept}
        language={language}
      />
    </>
  );
}
