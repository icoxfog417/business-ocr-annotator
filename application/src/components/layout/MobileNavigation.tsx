import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', icon: '🏠', label: 'Home' },
  { path: '/upload', icon: '📷', label: 'Upload' },
  { path: '/gallery', icon: '📋', label: 'Gallery' },
  { path: '/datasets', icon: '📊', label: 'Datasets' },
  { path: '/profile', icon: '👤', label: 'Profile' },
];

interface MobileNavigationProps {
  className?: string;
}

/**
 * Bottom navigation bar for mobile devices.
 * Shows on mobile only (< 768px).
 */
export function MobileNavigation({ className = '' }: MobileNavigationProps) {
  const { isMobile } = useBreakpoint();
  const location = useLocation();

  // Only render on mobile
  if (!isMobile) {
    return null;
  }

  const navStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 1000,
  };

  const itemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '48px',
    minHeight: '48px',
    padding: '4px',
    color: isActive ? '#3b82f6' : '#6b7280',
    textDecoration: 'none',
    fontSize: '10px',
    transition: 'color 0.2s ease',
  });

  const iconStyle: React.CSSProperties = {
    fontSize: '24px',
    marginBottom: '2px',
  };

  return (
    <nav className={`mobile-nav ${className}`} style={navStyle} aria-label="Mobile navigation">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);

        return (
          <Link
            key={item.path}
            to={item.path}
            style={itemStyle(isActive)}
            className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span style={iconStyle} className="mobile-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Spacer component to prevent content from being hidden behind mobile nav
 */
export function MobileNavSpacer() {
  const { isMobile } = useBreakpoint();

  if (!isMobile) {
    return null;
  }

  const spacerStyle: React.CSSProperties = {
    height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
    flexShrink: 0,
  };

  return <div style={spacerStyle} className="mobile-nav-spacer" aria-hidden="true" />;
}
