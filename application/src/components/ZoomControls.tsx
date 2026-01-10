interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomFit: () => void;
  zoomLevel: number;
}

export function ZoomControls({ onZoomIn, onZoomOut, onZoomReset, onZoomFit, zoomLevel }: ZoomControlsProps) {
  const buttonStyle = {
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '0.5rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500' as const
  };

  const grayButtonStyle = {
    ...buttonStyle,
    background: '#6b7280'
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <button onClick={onZoomIn} style={buttonStyle} title="Zoom In">+</button>
      <button onClick={onZoomOut} style={buttonStyle} title="Zoom Out">−</button>
      <button onClick={onZoomReset} style={grayButtonStyle} title="Reset Zoom">1:1</button>
      <button onClick={onZoomFit} style={grayButtonStyle} title="Fit to Screen">Fit</button>
      <span style={{ fontSize: '0.875rem', color: '#374151', minWidth: '50px' }}>
        {Math.round(zoomLevel * 100)}%
      </span>
    </div>
  );
}
