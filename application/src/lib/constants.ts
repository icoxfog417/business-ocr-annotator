export const LANGUAGES = [
  { code: 'ja', label: '日本語 (Japanese)' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文 (Chinese)' },
  { code: 'ko', label: '한국어 (Korean)' },
] as const;

export const DOCUMENT_TYPES = [
  { code: 'RECEIPT', label: 'Receipt' },
  { code: 'INVOICE', label: 'Invoice' },
  { code: 'ORDER_FORM', label: 'Order Form' },
  { code: 'TAX_FORM', label: 'Tax Form' },
  { code: 'CONTRACT', label: 'Contract' },
  { code: 'APPLICATION_FORM', label: 'Application Form' },
  { code: 'OTHER', label: 'Other' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];
export type DocumentTypeCode = (typeof DOCUMENT_TYPES)[number]['code'];
