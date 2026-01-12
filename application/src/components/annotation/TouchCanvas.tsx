import React, { useRef, useState, useCallback, useEffect } from 'react';

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
  onBoxSelected: (index: number | null) => void;
  onBoxUpdated: (index: number, box: BoundingBox) => void;
  zoom?: number;
  className?: string;
}

/**
 * Touch-friendly canvas for bounding box annotation.
 * Supports view mode (scroll/pan) and draw mode (box creation).
 */
export function TouchCanvas({
  imageSrc,
  imageWidth,
  imageHeight,
  boxes,
  selectedBoxIndex,
  mode,
  onModeChange,
  onBoxCreated,
  onBoxSelected,
  onBoxUpdated,
  zoom = 1,
  className = '',
}: TouchCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<BoundingBox | null>(null);
  const [isDraggingHandle, setIsDraggingHandle] = useState<string | null>(null);

  // Get position relative to canvas
  const getCanvasPosition = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / zoom,
        y: (clientY - rect.top) / zoom,
      };
    },
    [zoom]
  );

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing boxes
    boxes.forEach((box, index) => {
      const isSelected = index === selectedBoxIndex;

      // Box outline
      ctx.strokeStyle = isSelected ? '#3b82f6' : '#10b981';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      // Box fill (semi-transparent)
      ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)';
      ctx.fillRect(box.x, box.y, box.width, box.height);

      // Draw corner handles for selected box
      if (isSelected) {
        const handleSize = 12;
        const handles = [
          { x: box.x, y: box.y }, // top-left
          { x: box.x + box.width, y: box.y }, // top-right
          { x: box.x, y: box.y + box.height }, // bottom-left
          { x: box.x + box.width, y: box.y + box.height }, // bottom-right
        ];

        ctx.fillStyle = '#3b82f6';
        handles.forEach((handle) => {
          ctx.beginPath();
          ctx.arc(handle.x, handle.y, handleSize / 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Box index label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textBaseline = 'top';
      const labelWidth = 20;
      const labelHeight = 18;
      ctx.fillStyle = isSelected ? '#3b82f6' : '#10b981';
      ctx.fillRect(box.x, box.y - labelHeight, labelWidth, labelHeight);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${index + 1}`, box.x + 5, box.y - labelHeight + 3);
    });

    // Draw current drawing box
    if (currentBox) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
      ctx.setLineDash([]);
    }
  }, [boxes, selectedBoxIndex, currentBox]);

  // Redraw on changes
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Touch/Mouse handlers
  const handleStart = useCallback(
    (x: number, y: number) => {
      if (mode !== 'draw') return;

      const pos = getCanvasPosition(x, y);

      // Check if clicking on a handle
      if (selectedBoxIndex !== null) {
        const box = boxes[selectedBoxIndex];
        const handleSize = 32; // Touch area for handles
        const handles = [
          { name: 'tl', x: box.x, y: box.y },
          { name: 'tr', x: box.x + box.width, y: box.y },
          { name: 'bl', x: box.x, y: box.y + box.height },
          { name: 'br', x: box.x + box.width, y: box.y + box.height },
        ];

        for (const handle of handles) {
          const dist = Math.sqrt((pos.x - handle.x) ** 2 + (pos.y - handle.y) ** 2);
          if (dist < handleSize / 2) {
            setIsDraggingHandle(handle.name);
            setStartPoint(pos);
            return;
          }
        }
      }

      // Check if clicking on existing box
      for (let i = boxes.length - 1; i >= 0; i--) {
        const box = boxes[i];
        if (pos.x >= box.x && pos.x <= box.x + box.width && pos.y >= box.y && pos.y <= box.y + box.height) {
          onBoxSelected(i);
          return;
        }
      }

      // Start drawing new box
      setIsDrawing(true);
      setStartPoint(pos);
      setCurrentBox(null);
      onBoxSelected(null);
    },
    [mode, getCanvasPosition, boxes, selectedBoxIndex, onBoxSelected]
  );

  const handleMove = useCallback(
    (x: number, y: number) => {
      if (mode !== 'draw') return;

      const pos = getCanvasPosition(x, y);

      // Handle dragging
      if (isDraggingHandle && startPoint && selectedBoxIndex !== null) {
        const box = boxes[selectedBoxIndex];
        const dx = pos.x - startPoint.x;
        const dy = pos.y - startPoint.y;

        let newBox = { ...box };
        switch (isDraggingHandle) {
          case 'tl':
            newBox = { x: box.x + dx, y: box.y + dy, width: box.width - dx, height: box.height - dy };
            break;
          case 'tr':
            newBox = { ...box, y: box.y + dy, width: box.width + dx, height: box.height - dy };
            break;
          case 'bl':
            newBox = { ...box, x: box.x + dx, width: box.width - dx, height: box.height + dy };
            break;
          case 'br':
            newBox = { ...box, width: box.width + dx, height: box.height + dy };
            break;
        }

        // Ensure positive dimensions
        if (newBox.width < 10 || newBox.height < 10) return;

        onBoxUpdated(selectedBoxIndex, newBox);
        setStartPoint(pos);
        return;
      }

      // Drawing new box
      if (isDrawing && startPoint) {
        const width = pos.x - startPoint.x;
        const height = pos.y - startPoint.y;

        setCurrentBox({
          x: width >= 0 ? startPoint.x : pos.x,
          y: height >= 0 ? startPoint.y : pos.y,
          width: Math.abs(width),
          height: Math.abs(height),
        });
      }
    },
    [mode, getCanvasPosition, isDrawing, startPoint, isDraggingHandle, selectedBoxIndex, boxes, onBoxUpdated]
  );

  const handleEnd = useCallback(() => {
    if (isDraggingHandle) {
      setIsDraggingHandle(null);
      setStartPoint(null);
      return;
    }

    if (isDrawing && currentBox && currentBox.width > 10 && currentBox.height > 10) {
      onBoxCreated(currentBox);
      // Auto-exit draw mode after successful box creation
      onModeChange('view');
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentBox(null);
  }, [isDraggingHandle, isDrawing, currentBox, onBoxCreated, onModeChange]);

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (mode !== 'draw') return;
    e.preventDefault();
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (mode !== 'draw') return;
    e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (mode !== 'draw') return;
    e.preventDefault();
    handleEnd();
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'draw') return;
    handleStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode !== 'draw') return;
    handleMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    if (mode !== 'draw') return;
    handleEnd();
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: mode === 'view' ? 'auto' : 'hidden',
    touchAction: mode === 'view' ? 'auto' : 'none',
  };

  const canvasContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: imageWidth * zoom,
    height: imageHeight * zoom,
    backgroundImage: `url(${imageSrc})`,
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  };

  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: mode === 'draw' ? 'auto' : 'none',
  };

  return (
    <div
      ref={containerRef}
      className={`touch-canvas ${className}`}
      style={containerStyle}
    >
      <div style={canvasContainerStyle}>
        <canvas
          ref={canvasRef}
          width={imageWidth}
          height={imageHeight}
          style={canvasStyle}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleEnd}
        />
      </div>
    </div>
  );
}
