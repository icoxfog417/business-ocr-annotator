import { useRef, useEffect, useState } from 'react';
import { ZoomControls } from './ZoomControls';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  const zoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5));
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.1));
  const zoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const zoomFit = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const image = imageRef.current;
    if (!canvas || !container || !image) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const imageWidth = image.naturalWidth;
    const imageHeight = image.naturalHeight;
    
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    
    setZoom(scale);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan transformations
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(pan.x, pan.y);

    // Draw bounding boxes
    boundingBoxes.forEach((box) => {
      ctx.strokeStyle = box.id === selectedBoxId ? '#3b82f6' : '#ef4444';
      ctx.lineWidth = 2 / zoom; // Adjust line width for zoom
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      
      // Draw corner handles for selected box
      if (box.id === selectedBoxId) {
        ctx.fillStyle = '#3b82f6';
        const handleSize = 6 / zoom; // Adjust handle size for zoom
        // Top-left
        ctx.fillRect(box.x - handleSize/2, box.y - handleSize/2, handleSize, handleSize);
        // Top-right
        ctx.fillRect(box.x + box.width - handleSize/2, box.y - handleSize/2, handleSize, handleSize);
        // Bottom-left
        ctx.fillRect(box.x - handleSize/2, box.y + box.height - handleSize/2, handleSize, handleSize);
        // Bottom-right
        ctx.fillRect(box.x + box.width - handleSize/2, box.y + box.height - handleSize/2, handleSize, handleSize);
      }
    });

    ctx.restore();
  }, [boundingBoxes, selectedBoxId, zoom, pan]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x * zoom) / zoom;
    const y = (e.clientY - rect.top - pan.y * zoom) / zoom;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(e);

    // Check for pan mode (middle mouse or ctrl+click)
    if (e.button === 1 || e.ctrlKey) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    // Check if clicking on existing box
    const clickedBox = boundingBoxes.find(box => 
      x >= box.x && x <= box.x + box.width &&
      y >= box.y && y <= box.y + box.height
    );

    if (clickedBox) {
      onBoxSelect(clickedBox.id);
    } else {
      // Start drawing new box
      setIsDrawing(true);
      setStartPoint({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      setPan(prev => ({
        x: prev.x + deltaX / zoom,
        y: prev.y + deltaY / zoom
      }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!isDrawing) return;

    const { x, y } = getCanvasCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and redraw with current transformations
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(pan.x, pan.y);
    
    // Draw existing boxes
    boundingBoxes.forEach((box) => {
      ctx.strokeStyle = box.id === selectedBoxId ? '#3b82f6' : '#ef4444';
      ctx.lineWidth = 2 / zoom;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    });

    // Draw current box being drawn
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(
      Math.min(startPoint.x, x),
      Math.min(startPoint.y, y),
      Math.abs(x - startPoint.x),
      Math.abs(y - startPoint.y)
    );

    ctx.restore();
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawing) return;

    const { x, y } = getCanvasCoordinates(e);
    const width = Math.abs(x - startPoint.x);
    const height = Math.abs(y - startPoint.y);

    // Only create box if it's large enough
    if (width > 10 && height > 10) {
      const newBox: BoundingBox = {
        id: Date.now().toString(),
        x: Math.min(startPoint.x, x),
        y: Math.min(startPoint.y, y),
        width,
        height
      };

      onBoundingBoxChange([...boundingBoxes, newBox]);
      onBoxSelect(newBox.id);
    }

    setIsDrawing(false);
  };

  const handleImageLoad = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', overflow: 'hidden' }}>
      <ZoomControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        onZoomFit={zoomFit}
        zoomLevel={zoom}
      />
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Annotation target"
        onLoad={handleImageLoad}
        style={{ 
          maxWidth: '100%', 
          height: 'auto', 
          display: 'block',
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: 'top left'
        }}
      />
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          cursor: isPanning ? 'grabbing' : isDrawing ? 'crosshair' : 'default',
          maxWidth: '100%',
          height: 'auto',
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: 'top left'
        }}
      />
    </div>
  );
}
