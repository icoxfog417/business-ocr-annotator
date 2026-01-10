// Bounding box in HuggingFace standard format
// [x0, y0, x1, y1] where (x0, y0) is upper-left, (x1, y1) is lower-right
// Coordinates are in pixels (not normalized)
export type BoundingBox = [number, number, number, number];

// Canvas bounding box format for internal use (drawing/editing)
export interface CanvasBoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Conversion utilities between formats
export function canvasToHuggingFace(box: CanvasBoundingBox): BoundingBox {
  return [
    Math.round(box.x),
    Math.round(box.y),
    Math.round(box.x + box.width),
    Math.round(box.y + box.height),
  ];
}

export function huggingFaceToCanvas(bbox: BoundingBox, id: string): CanvasBoundingBox {
  return {
    id,
    x: bbox[0],
    y: bbox[1],
    width: bbox[2] - bbox[0],
    height: bbox[3] - bbox[1],
  };
}

export type DocumentType =
  | 'RECEIPT'
  | 'INVOICE'
  | 'ORDER_FORM'
  | 'TAX_FORM'
  | 'CONTRACT'
  | 'APPLICATION_FORM'
  | 'OTHER';

export type QuestionType =
  | 'EXTRACTIVE'
  | 'ABSTRACTIVE'
  | 'BOOLEAN'
  | 'COUNTING'
  | 'REASONING';

export type ValidationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Matches schema: ['UPLOADED', 'ANNOTATING', 'VALIDATED']
export type ImageStatus = 'UPLOADED' | 'ANNOTATING' | 'VALIDATED';

// Language codes (ISO 639-1)
export type LanguageCode = 'ja' | 'en' | 'zh' | 'ko';
