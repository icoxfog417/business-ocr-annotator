interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomFit: () => void;
  zoomLevel: number;
}

export function ZoomControls({ onZoomIn, onZoomOut, onZoomReset, onZoomFit, zoomLevel }: ZoomControlsProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        display: 'flex',
        gap: '0.5rem',
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '8px',
        padding: '0.5rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        zIndex: 10
      }}
    >
      <button
        onClick={onZoomIn}
        style={{
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '0.5rem',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
        title="Zoom In"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        style={{
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '0.5rem',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
        title="Zoom Out"
      >
        -
      </button>
      <button
        onClick={onZoomReset}
        style={{
          background: '#6b7280',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '0.5rem',
          cursor: 'pointer',
          fontSize: '0.75rem'
        }}
        title="Reset Zoom"
      >
        1:1
      </button>
      <button
        onClick={onZoomFit}
        style={{
          background: '#6b7280',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '0.5rem',
          cursor: 'pointer',
          fontSize: '0.75rem'
        }}
        title="Fit to Screen"
      >
        Fit
      </button>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 0.5rem',
          fontSize: '0.875rem',
          color: '#374151'
        }}
      >
        {Math.round(zoomLevel * 100)}%
      </div>
    </div>
  );
}
