// Bounding box in HuggingFace standard format
// [x0, y0, x1, y1] where (x0, y0) is upper-left, (x1, y1) is lower-right
// Coordinates are in pixels (not normalized)
export type BoundingBox = [number, number, number, number];

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

export type GenerationSource = 'AI' | 'HUMAN';

export type ImageStatus = 'UPLOADED' | 'PROCESSING' | 'ANNOTATED' | 'VALIDATED';

// Language codes (ISO 639-1)
export type LanguageCode = 'ja' | 'en' | 'zh' | 'ko';
