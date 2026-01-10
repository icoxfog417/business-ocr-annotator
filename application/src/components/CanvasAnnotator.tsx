import { useRef, useEffect, useState } from 'react';
import { ZoomControls } from './ZoomControls';

// Constants for bounding box styling
const BOUNDING_BOX_STYLES = {
  STROKE_WIDTH: 3,
  FILL_ALPHA: 0.2,
  CORNER_HANDLE_SIZE: 8,
  MIN_BOX_SIZE: 10,
} as const;

const ZOOM_LEVELS = {
  MIN: 0.5,
  MAX: 3,
  STEP: 1.2,
  DEFAULT: 1,
} as const;

interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasAnnotatorProps {
  imageUrl: string;
  boundingBoxes: BoundingBox[];
  onBoundingBoxChange: (boxes: BoundingBox[]) => void;
  selectedBoxId?: string;
  onBoxSelect: (boxId: string) => void;
}

export function CanvasAnnotator({
  imageUrl,
  boundingBoxes,
  onBoundingBoxChange,
  selectedBoxId,
  onBoxSelect
}: CanvasAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(ZOOM_LEVELS.DEFAULT);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      // naturalWidth and naturalHeight are the intrinsic dimensions of the image
      // (actual pixel dimensions before any CSS scaling)
      setCanvasSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to actual image dimensions (100% zoom = natural size)
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // Clear and draw image at actual size
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    // Draw existing bounding boxes
    boundingBoxes.forEach((box) => {
      const isSelected = box.id === selectedBoxId;
      
      // Fill with transparent color
      ctx.fillStyle = isSelected 
        ? `rgba(59, 130, 246, ${BOUNDING_BOX_STYLES.FILL_ALPHA})` 
        : `rgba(239, 68, 68, ${BOUNDING_BOX_STYLES.FILL_ALPHA})`;
      ctx.fillRect(box.x, box.y, box.width, box.height);
      
      // Border
      ctx.strokeStyle = isSelected ? '#3b82f6' : '#ef4444';
      ctx.lineWidth = BOUNDING_BOX_STYLES.STROKE_WIDTH;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      
      // Corner handles for selected box
      if (isSelected) {
        ctx.fillStyle = '#3b82f6';
        const handleSize = BOUNDING_BOX_STYLES.CORNER_HANDLE_SIZE;
        ctx.fillRect(box.x - handleSize/2, box.y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x + box.width - handleSize/2, box.y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x - handleSize/2, box.y + box.height - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x + box.width - handleSize/2, box.y + box.height - handleSize/2, handleSize, handleSize);
      }
    });

    // Draw current box being created
    if (currentBox) {
      ctx.fillStyle = `rgba(34, 197, 94, ${BOUNDING_BOX_STYLES.FILL_ALPHA})`;
      ctx.fillRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = BOUNDING_BOX_STYLES.STROKE_WIDTH;
      ctx.strokeRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
    }
  }, [image, boundingBoxes, selectedBoxId, currentBox, canvasSize]);

  // Transform canvas coordinates to image coordinates
  // Account for canvas scaling to get actual pixel position
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    // Calculate scale factors between displayed size and actual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Convert mouse position to canvas coordinates
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x, y };
  };

  // Mouse event handling for drawing bounding boxes
  // Track mouse position and state to create/select boxes
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(e);

    // Check if clicking on existing box
    const clickedBox = boundingBoxes.find(box => 
      x >= box.x && x <= box.x + box.width &&
      y >= box.y && y <= box.y + box.height
    );

    if (clickedBox) {
      onBoxSelect(clickedBox.id);
    } else {
      setIsDrawing(true);
      setStartPoint({ x, y });
      setCurrentBox({ x, y, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const { x, y } = getCanvasCoordinates(e);
    
    // Calculate bounding box from start point to current position
    setCurrentBox({
      x: Math.min(startPoint.x, x),
      y: Math.min(startPoint.y, y),
      width: Math.abs(x - startPoint.x),
      height: Math.abs(y - startPoint.y)
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox) {
      setIsDrawing(false);
      return;
    }

    // Only create box if it's large enough (minimum size threshold)
    if (currentBox.width > BOUNDING_BOX_STYLES.MIN_BOX_SIZE && 
        currentBox.height > BOUNDING_BOX_STYLES.MIN_BOX_SIZE) {
      const newBox: BoundingBox = {
        id: Date.now().toString(),
        ...currentBox
      };
      onBoundingBoxChange([...boundingBoxes, newBox]);
      onBoxSelect(newBox.id);
    }

    setIsDrawing(false);
    setCurrentBox(null);
  };

  const deleteSelectedBox = () => {
    if (selectedBoxId) {
      onBoundingBoxChange(boundingBoxes.filter(box => box.id !== selectedBoxId));
      onBoxSelect('');
    }
  };

  const zoomIn = () => setZoom(prev => Math.min(prev * ZOOM_LEVELS.STEP, ZOOM_LEVELS.MAX));
  const zoomOut = () => setZoom(prev => Math.max(prev / ZOOM_LEVELS.STEP, ZOOM_LEVELS.MIN));
  const zoomReset = () => setZoom(ZOOM_LEVELS.DEFAULT);
  const zoomFit = () => {
    const container = containerRef.current;
    if (!container || !image) return;
    const scale = Math.min(
      (container.clientWidth - 40) / image.naturalWidth,
      (container.clientHeight - 100) / image.naturalHeight,
      ZOOM_LEVELS.DEFAULT
    );
    setZoom(scale);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', height: '100%', overflow: 'auto' }}>
      <div style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 10, 
        background: 'rgba(255,255,255,0.95)',
        padding: '0.5rem',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <ZoomControls
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={zoomReset}
          onZoomFit={zoomFit}
          zoomLevel={zoom}
        />
        {selectedBoxId && (
          <button
            onClick={deleteSelectedBox}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Delete Selected Box
          </button>
        )}
      </div>
      
      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: isDrawing ? 'crosshair' : 'default',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            maxWidth: '100%',
            width: canvasSize.width * zoom,
            height: canvasSize.height * zoom
          }}
        />
      </div>
    </div>
  );
}
