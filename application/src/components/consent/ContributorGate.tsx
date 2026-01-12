import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { useContributor } from '../../contexts/ContributorContext';
import { StartContributingDialog } from './StartContributingDialog';

interface ContributorGateProps {
  children: ReactNode;
  /**
   * What to render when user is not a contributor.
   * If not provided, shows a tooltip/disabled state.
   */
  fallback?: ReactNode;
  /**
   * Language for consent dialog
   */
  language?: string;
  /**
   * If true, shows dialog immediately when action is attempted.
   * If false, just shows disabled state.
   */
  showDialogOnAttempt?: boolean;
}

/**
 * Wrapper component for contributor-only actions.
 * Shows consent dialog if user attempts action without being a contributor.
 */
export function ContributorGate({
  children,
  fallback,
  language = 'en',
  showDialogOnAttempt = true,
}: ContributorGateProps) {
  const { isContributor, isLoading, becomeContributor } = useContributor();
  const [showDialog, setShowDialog] = useState(false);

  // If loading, show loading state
  if (isLoading) {
    return (
      <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
        {children}
      </div>
    );
  }

  // If contributor, render children normally
  if (isContributor) {
    return <>{children}</>;
  }

  // If not contributor and fallback provided, show fallback
  if (fallback) {
    return <>{fallback}</>;
  }

  // Otherwise, show gated version with click handler
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (showDialogOnAttempt) {
      setShowDialog(true);
    }
  };

  const gateStyle: React.CSSProperties = {
    position: 'relative',
    cursor: 'pointer',
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 10,
  };

  return (
    <>
      <div style={gateStyle} onClick={handleClick}>
        <div style={{ opacity: 0.6, pointerEvents: 'none' }}>
          {children}
        </div>
        <div style={overlayStyle} title="Sign up to contribute" />
      </div>

      <StartContributingDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        onAccept={becomeContributor}
        language={language}
      />
    </>
  );
}

interface ContributorGatedButtonProps {
  onClick: () => void;
  children: ReactNode;
  language?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

/**
 * Button that shows consent dialog if user is not a contributor.
 */
export function ContributorGatedButton({
  onClick,
  children,
  language = 'en',
  className = '',
  style,
  disabled = false,
}: ContributorGatedButtonProps) {
  const { isContributor, isLoading, becomeContributor } = useContributor();
  const [showDialog, setShowDialog] = useState(false);

  const handleClick = () => {
    if (isContributor) {
      onClick();
    } else {
      setShowDialog(true);
    }
  };

  const handleAccept = async () => {
    const success = await becomeContributor();
    if (success) {
      // After becoming contributor, execute the original action
      onClick();
    }
    return success;
  };

  const buttonStyle: React.CSSProperties = {
    ...style,
    opacity: isLoading ? 0.5 : 1,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={className}
        style={buttonStyle}
        disabled={disabled || isLoading}
        type="button"
      >
        {children}
      </button>

      <StartContributingDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        onAccept={handleAccept}
        language={language}
      />
    </>
  );
}
