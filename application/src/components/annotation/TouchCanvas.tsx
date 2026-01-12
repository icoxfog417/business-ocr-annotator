import { useRef, useState, useCallback, useEffect } from 'react';

export type TouchMode = 'view' | 'draw';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TouchCanvasProps {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  boxes: BoundingBox[];
  selectedBoxIndex: number | null;
  mode: TouchMode;
  onModeChange: (mode: TouchMode) => void;
  onBoxCreated: (box: BoundingBox) => void;
}

export function TouchCanvas({
  imageSrc,
  imageWidth,
  imageHeight,
  boxes,
  selectedBoxIndex,
  mode,
  onModeChange,
  onBoxCreated,
}: TouchCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Drawing state in ref to avoid stale closures
  const drawingRef = useRef({
    isDrawing: false,
    startPoint: null as { x: number; y: number } | null,
    currentBox: null as BoundingBox | null,
  });
  
  const [redrawTrigger, setRedrawTrigger] = useState(0);

  const getCanvasPosition = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };

      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;
      const imageAspect = imageWidth / imageHeight;
      const containerAspect = containerWidth / containerHeight;
      
      let actualImageWidth, actualImageHeight, offsetX, offsetY;
      
      if (imageAspect > containerAspect) {
        actualImageWidth = containerWidth;
        actualImageHeight = containerWidth / imageAspect;
        offsetX = 0;
        offsetY = (containerHeight - actualImageHeight) / 2;
      } else {
        actualImageWidth = containerHeight * imageAspect;
        actualImageHeight = containerHeight;
        offsetX = (containerWidth - actualImageWidth) / 2;
        offsetY = 0;
      }
      
      const relativeX = clientX - rect.left - offsetX;
      const relativeY = clientY - rect.top - offsetY;
      
      return {
        x: (relativeX / actualImageWidth) * imageWidth,
        y: (relativeY / actualImageHeight) * imageHeight,
      };
    },
    [imageWidth, imageHeight]
  );

  // Draw function - called directly, not via useEffect for real-time updates
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const imageAspect = imageWidth / imageHeight;
    const containerAspect = containerWidth / containerHeight;
    
    let actualImageWidth, actualImageHeight, offsetX, offsetY;
    
    if (imageAspect > containerAspect) {
      actualImageWidth = containerWidth;
      actualImageHeight = containerWidth / imageAspect;
      offsetX = 0;
      offsetY = (containerHeight - actualImageHeight) / 2;
    } else {
      actualImageWidth = containerHeight * imageAspect;
      actualImageHeight = containerHeight;
      offsetX = (containerWidth - actualImageWidth) / 2;
      offsetY = 0;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing boxes
    boxes.forEach((box, index) => {
      const isSelected = index === selectedBoxIndex;
      const canvasX = offsetX + (box.x / imageWidth) * actualImageWidth;
      const canvasY = offsetY + (box.y / imageHeight) * actualImageHeight;
      const canvasWidth = (box.width / imageWidth) * actualImageWidth;
      const canvasHeight = (box.height / imageHeight) * actualImageHeight;

      ctx.strokeStyle = isSelected ? '#3b82f6' : '#10b981';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(canvasX, canvasY, canvasWidth, canvasHeight);
      ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)';
      ctx.fillRect(canvasX, canvasY, canvasWidth, canvasHeight);
    });

    // Draw current drawing box (while dragging)
    const { currentBox } = drawingRef.current;
    if (currentBox) {
      const canvasX = offsetX + (currentBox.x / imageWidth) * actualImageWidth;
      const canvasY = offsetY + (currentBox.y / imageHeight) * actualImageHeight;
      const canvasWidth = (currentBox.width / imageWidth) * actualImageWidth;
      const canvasHeight = (currentBox.height / imageHeight) * actualImageHeight;

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(canvasX, canvasY, canvasWidth, canvasHeight);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
      ctx.fillRect(canvasX, canvasY, canvasWidth, canvasHeight);
      ctx.setLineDash([]);
    }
  }, [boxes, selectedBoxIndex, imageWidth, imageHeight]);

  // Redraw when boxes change or trigger updates
  useEffect(() => {
    draw();
  }, [draw, redrawTrigger]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      draw();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // Touch/Mouse event handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleStart = (clientX: number, clientY: number) => {
      if (mode !== 'draw') return;
      const pos = getCanvasPosition(clientX, clientY);
      drawingRef.current = { isDrawing: true, startPoint: pos, currentBox: null };
    };

    const handleMove = (clientX: number, clientY: number) => {
      if (mode !== 'draw') return;
      const { isDrawing, startPoint } = drawingRef.current;
      if (!isDrawing || !startPoint) return;

      const pos = getCanvasPosition(clientX, clientY);
      const width = pos.x - startPoint.x;
      const height = pos.y - startPoint.y;

      drawingRef.current.currentBox = {
        x: width >= 0 ? startPoint.x : pos.x,
        y: height >= 0 ? startPoint.y : pos.y,
        width: Math.abs(width),
        height: Math.abs(height),
      };
      
      // Redraw immediately to show box while dragging
      draw();
    };

    const handleEnd = () => {
      const { isDrawing, currentBox } = drawingRef.current;
      if (isDrawing && currentBox && currentBox.width > 10 && currentBox.height > 10) {
        onBoxCreated(currentBox);
        onModeChange('view');
      }
      drawingRef.current = { isDrawing: false, startPoint: null, currentBox: null };
      setRedrawTrigger(n => n + 1);
    };

    // Touch events
    const onTouchStart = (e: TouchEvent) => {
      if (mode !== 'draw') return;
      e.preventDefault();
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (mode !== 'draw') return;
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (mode !== 'draw') return;
      e.preventDefault();
      handleEnd();
    };

    // Mouse events
    const onMouseDown = (e: MouseEvent) => handleStart(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onMouseUp = () => handleEnd();

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
    };
  }, [mode, getCanvasPosition, onBoxCreated, onModeChange, draw]);

  return (
    <div
      ref={containerRef}
      className="touch-canvas"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: mode === 'view' ? 'auto' : 'hidden',
        touchAction: mode === 'view' ? 'auto' : 'none',
      }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundImage: `url(${imageSrc})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        minHeight: '300px',
      }}>
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: mode === 'draw' ? 'auto' : 'none',
          }}
        />
      </div>
    </div>
  );
}
