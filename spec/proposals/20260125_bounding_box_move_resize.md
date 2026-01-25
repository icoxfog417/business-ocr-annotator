# Proposal: Bounding Box Move and Resize Functionality

**Date**: 2026-01-25
**Author**: Claude Agent
**Status**: Implemented

## Background

Users reported that once a bounding box is drawn, they cannot adjust its position or size without deleting and redrawing it. This makes the annotation process cumbersome, especially when minor adjustments are needed.

The requirements document (REQ-AE-003, REQ-AE-008) already specified this feature:
- REQ-AE-003: Users shall adjust bounding box coordinates by dragging corners/edges
- REQ-AE-008: Bounding box corners and edges shall be touch-friendly (minimum 12px touch area)

## Proposal

Implement move and resize functionality for selected bounding boxes in the TouchCanvas component:

### 1. Move Functionality
- When a box is selected, dragging inside the box moves it to a new position
- The box is constrained within image boundaries

### 2. Resize Functionality
- Visual corner handles (12px blue squares) appear on selected boxes
- Touch-friendly 32px hit area for corner detection
- Dragging any corner resizes the box accordingly:
  - NW corner: adjusts x, y, width, height
  - NE corner: adjusts y, width, height
  - SW corner: adjusts x, width, height
  - SE corner: adjusts width, height
- Minimum box size of 10x10 pixels is enforced

### 3. Technical Implementation
- New `DragMode` type: `'none' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se'`
- New `dragRef` to track drag state
- `detectHitArea()` function for hit detection
- `onBoxUpdated` callback prop for communicating changes to parent

## Impact

### Requirements
- Implements REQ-AE-003 and REQ-AE-008

### Design
- TouchCanvas component updated with new interaction modes
- Corner handles drawn for selected boxes in view mode

### Tasks
- Unit G task "Corner handles for resize (32×32px touch area)" completed

## Implementation Details

### Files Modified
1. `application/src/components/annotation/TouchCanvas.tsx`
   - Added `DragMode` type
   - Added `HANDLE_SIZE` (32px) and `HANDLE_VISUAL_SIZE` (12px) constants
   - Added `dragRef` for tracking drag state
   - Added `getScaleFactor()` for coordinate conversion
   - Added `detectHitArea()` for hit detection
   - Added corner handle drawing in `draw()` function
   - Added `handleViewStart/Move/End` for move/resize in view mode
   - Added `onBoxUpdated` optional prop
   - Updated canvas `pointerEvents` to enable interaction in view mode

2. `application/src/components/annotation/AnnotationFlow.tsx`
   - Added `handleBoxUpdated` callback
   - Passed callback to TouchCanvas

## Testing Checklist
- [x] Move box by dragging inside
- [x] Resize from NW corner
- [x] Resize from NE corner
- [x] Resize from SW corner
- [x] Resize from SE corner
- [x] Box stays within image bounds
- [x] Minimum size (10x10) enforced
- [x] Touch events work on mobile
- [x] Mouse events work on desktop
