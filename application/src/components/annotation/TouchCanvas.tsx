import { useRef, useState, useCallback, useEffect } from 'react';

export type TouchMode = 'view' | 'draw';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragMode = 'none' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se';

interface TouchCanvasProps {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  boxes: BoundingBox[];
  selectedBoxIndex: number | null;
  mode: TouchMode;
  onModeChange: (mode: TouchMode) => void;
  onBoxCreated: (box: BoundingBox) => void;
  onBoxUpdated?: (index: number, box: BoundingBox) => void;
}

// Corner handle size in pixels (touch-friendly)
const HANDLE_SIZE = 32;
const HANDLE_VISUAL_SIZE = 12;

export function TouchCanvas({
  imageSrc,
  imageWidth,
  imageHeight,
  boxes,
  selectedBoxIndex,
  mode,
  onModeChange,
  onBoxCreated,
  onBoxUpdated,
}: TouchCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Drawing state in ref to avoid stale closures
  const drawingRef = useRef({
    isDrawing: false,
    startPoint: null as { x: number; y: number } | null,
    currentBox: null as BoundingBox | null,
  });

  // Drag state for move/resize
  const dragRef = useRef({
    isDragging: false,
    dragMode: 'none' as DragMode,
    startPoint: null as { x: number; y: number } | null,
    originalBox: null as BoundingBox | null,
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

  // Get scale factor for converting touch area to image coordinates
  const getScaleFactor = useCallback((): number => {
    const container = containerRef.current;
    if (!container) return 1;

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const imageAspect = imageWidth / imageHeight;
    const containerAspect = containerWidth / containerHeight;

    if (imageAspect > containerAspect) {
      return imageWidth / containerWidth;
    } else {
      return imageHeight / containerHeight;
    }
  }, [imageWidth, imageHeight]);

  // Detect which part of a box was hit (corner handle or interior)
  const detectHitArea = useCallback(
    (pos: { x: number; y: number }, box: BoundingBox): DragMode => {
      const scale = getScaleFactor();
      const handleTouchArea = HANDLE_SIZE * scale; // Touch area in image coordinates

      const corners = [
        { mode: 'resize-nw' as DragMode, x: box.x, y: box.y },
        { mode: 'resize-ne' as DragMode, x: box.x + box.width, y: box.y },
        { mode: 'resize-sw' as DragMode, x: box.x, y: box.y + box.height },
        { mode: 'resize-se' as DragMode, x: box.x + box.width, y: box.y + box.height },
      ];

      // Check corners first (they have priority)
      for (const corner of corners) {
        if (
          Math.abs(pos.x - corner.x) < handleTouchArea / 2 &&
          Math.abs(pos.y - corner.y) < handleTouchArea / 2
        ) {
          return corner.mode;
        }
      }

      // Check if inside box (for move)
      if (
        pos.x >= box.x &&
        pos.x <= box.x + box.width &&
        pos.y >= box.y &&
        pos.y <= box.y + box.height
      ) {
        return 'move';
      }

      return 'none';
    },
    [getScaleFactor]
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

      // Draw corner handles for selected box
      if (isSelected && mode === 'view') {
        const handleSize = HANDLE_VISUAL_SIZE;
        ctx.fillStyle = '#3b82f6';

        // NW corner
        ctx.fillRect(canvasX - handleSize / 2, canvasY - handleSize / 2, handleSize, handleSize);
        // NE corner
        ctx.fillRect(
          canvasX + canvasWidth - handleSize / 2,
          canvasY - handleSize / 2,
          handleSize,
          handleSize
        );
        // SW corner
        ctx.fillRect(
          canvasX - handleSize / 2,
          canvasY + canvasHeight - handleSize / 2,
          handleSize,
          handleSize
        );
        // SE corner
        ctx.fillRect(
          canvasX + canvasWidth - handleSize / 2,
          canvasY + canvasHeight - handleSize / 2,
          handleSize,
          handleSize
        );
      }
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
  }, [boxes, selectedBoxIndex, imageWidth, imageHeight, mode]);

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

    const handleDrawStart = (clientX: number, clientY: number) => {
      const pos = getCanvasPosition(clientX, clientY);
      drawingRef.current = { isDrawing: true, startPoint: pos, currentBox: null };
    };

    const handleDrawMove = (clientX: number, clientY: number) => {
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

    const handleDrawEnd = () => {
      const { isDrawing, currentBox } = drawingRef.current;
      if (isDrawing && currentBox && currentBox.width > 10 && currentBox.height > 10) {
        onBoxCreated(currentBox);
        onModeChange('view');
      }
      drawingRef.current = { isDrawing: false, startPoint: null, currentBox: null };
      setRedrawTrigger((n) => n + 1);
    };

    // View mode handlers for move/resize
    const handleViewStart = (clientX: number, clientY: number) => {
      if (selectedBoxIndex === null || !boxes[selectedBoxIndex]) return;

      const pos = getCanvasPosition(clientX, clientY);
      const selectedBox = boxes[selectedBoxIndex];
      const hitArea = detectHitArea(pos, selectedBox);

      if (hitArea !== 'none') {
        dragRef.current = {
          isDragging: true,
          dragMode: hitArea,
          startPoint: pos,
          originalBox: { ...selectedBox },
        };
      }
    };

    const handleViewMove = (clientX: number, clientY: number) => {
      const { isDragging, dragMode, startPoint, originalBox } = dragRef.current;
      if (!isDragging || !startPoint || !originalBox || selectedBoxIndex === null) return;
      if (!onBoxUpdated) return;

      const pos = getCanvasPosition(clientX, clientY);
      const deltaX = pos.x - startPoint.x;
      const deltaY = pos.y - startPoint.y;

      let newBox: BoundingBox;

      if (dragMode === 'move') {
        // Move the box
        newBox = {
          x: Math.max(0, Math.min(imageWidth - originalBox.width, originalBox.x + deltaX)),
          y: Math.max(0, Math.min(imageHeight - originalBox.height, originalBox.y + deltaY)),
          width: originalBox.width,
          height: originalBox.height,
        };
      } else {
        // Resize the box based on which corner is being dragged
        let newX = originalBox.x;
        let newY = originalBox.y;
        let newWidth = originalBox.width;
        let newHeight = originalBox.height;

        switch (dragMode) {
          case 'resize-nw':
            newX = Math.min(originalBox.x + originalBox.width - 10, originalBox.x + deltaX);
            newY = Math.min(originalBox.y + originalBox.height - 10, originalBox.y + deltaY);
            newWidth = originalBox.width - (newX - originalBox.x);
            newHeight = originalBox.height - (newY - originalBox.y);
            break;
          case 'resize-ne':
            newY = Math.min(originalBox.y + originalBox.height - 10, originalBox.y + deltaY);
            newWidth = Math.max(10, originalBox.width + deltaX);
            newHeight = originalBox.height - (newY - originalBox.y);
            break;
          case 'resize-sw':
            newX = Math.min(originalBox.x + originalBox.width - 10, originalBox.x + deltaX);
            newWidth = originalBox.width - (newX - originalBox.x);
            newHeight = Math.max(10, originalBox.height + deltaY);
            break;
          case 'resize-se':
            newWidth = Math.max(10, originalBox.width + deltaX);
            newHeight = Math.max(10, originalBox.height + deltaY);
            break;
        }

        // Clamp to image bounds
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        newWidth = Math.min(newWidth, imageWidth - newX);
        newHeight = Math.min(newHeight, imageHeight - newY);

        newBox = { x: newX, y: newY, width: newWidth, height: newHeight };
      }

      onBoxUpdated(selectedBoxIndex, newBox);
    };

    const handleViewEnd = () => {
      dragRef.current = {
        isDragging: false,
        dragMode: 'none',
        startPoint: null,
        originalBox: null,
      };
    };

    // Unified handlers that delegate to draw or view mode
    const handleStart = (clientX: number, clientY: number) => {
      if (mode === 'draw') {
        handleDrawStart(clientX, clientY);
      } else {
        handleViewStart(clientX, clientY);
      }
    };

    const handleMove = (clientX: number, clientY: number) => {
      if (mode === 'draw') {
        handleDrawMove(clientX, clientY);
      } else {
        handleViewMove(clientX, clientY);
      }
    };

    const handleEnd = () => {
      if (mode === 'draw') {
        handleDrawEnd();
      } else {
        handleViewEnd();
      }
    };

    // Touch events
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
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
  }, [
    mode,
    boxes,
    selectedBoxIndex,
    imageWidth,
    imageHeight,
    getCanvasPosition,
    detectHitArea,
    onBoxCreated,
    onBoxUpdated,
    onModeChange,
    draw,
  ]);

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
            pointerEvents: mode === 'draw' || selectedBoxIndex !== null ? 'auto' : 'none',
            cursor:
              mode === 'draw'
                ? 'crosshair'
                : selectedBoxIndex !== null
                  ? 'move'
                  : 'default',
          }}
        />
      </div>
    </div>
  );
}
