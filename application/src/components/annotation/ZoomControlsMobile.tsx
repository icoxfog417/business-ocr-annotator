import React from 'react';

interface ZoomControlsMobileProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
}

/**
 * Mobile-friendly zoom controls.
 * Touch-friendly buttons for zoom in, zoom out, and fit.
 */
export function ZoomControlsMobile({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  minZoom = 0.5,
  maxZoom = 4,
  className = '',
}: ZoomControlsMobileProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    padding: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  };

  const buttonStyle = (disabled: boolean): React.CSSProperties => ({
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    backgroundColor: disabled ? '#f3f4f6' : '#ffffff',
    color: disabled ? '#9ca3af' : '#374151',
    fontSize: '20px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
  });

  const zoomLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '48px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
  };

  const canZoomIn = zoom < maxZoom;
  const canZoomOut = zoom > minZoom;

  return (
    <div className={`zoom-controls-mobile ${className}`} style={containerStyle}>
      <button
        type="button"
        style={buttonStyle(!canZoomOut)}
        onClick={onZoomOut}
        disabled={!canZoomOut}
        aria-label="Zoom out"
      >
        −
      </button>
      <div style={zoomLabelStyle}>
        {Math.round(zoom * 100)}%
      </div>
      <button
        type="button"
        style={buttonStyle(!canZoomIn)}
        onClick={onZoomIn}
        disabled={!canZoomIn}
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        style={buttonStyle(false)}
        onClick={onFit}
        aria-label="Fit to view"
      >
        ⊡
      </button>
    </div>
  );
}

/**
 * Floating zoom controls positioned at bottom of viewport
 */
interface FloatingZoomControlsProps extends ZoomControlsMobileProps {
  position?: 'bottom-left' | 'bottom-right' | 'bottom-center';
}

export function FloatingZoomControls({
  position = 'bottom-center',
  ...props
}: FloatingZoomControlsProps) {
  const positionStyles: Record<string, React.CSSProperties> = {
    'bottom-left': {
      position: 'fixed',
      bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
      left: '16px',
    },
    'bottom-right': {
      position: 'fixed',
      bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
      right: '16px',
    },
    'bottom-center': {
      position: 'fixed',
      bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
      left: '50%',
      transform: 'translateX(-50%)',
    },
  };

  return (
    <div style={positionStyles[position]}>
      <ZoomControlsMobile {...props} />
    </div>
  );
}
