import { useMemo } from 'react';
import defaultQuestions from '../config/defaultQuestions.json';

export interface DefaultQuestion {
  id: string;
  text: string;
  type: string;
}

export interface DefaultQuestionSet {
  defaultQuestions: DefaultQuestion[];
  optionalQuestions: DefaultQuestion[];
}

type DocumentType =
  | 'RECEIPT'
  | 'INVOICE'
  | 'ORDER_FORM'
  | 'TAX_FORM'
  | 'CONTRACT'
  | 'APPLICATION_FORM'
  | 'OTHER';

type Language = 'ja' | 'en' | 'zh' | 'ko';

interface DocumentTypeQuestions {
  [language: string]: {
    default: DefaultQuestion[];
    optional: DefaultQuestion[];
  };
}

interface QuestionsConfig {
  version: string;
  documentTypes: {
    [key: string]: DocumentTypeQuestions;
  };
}

const questionsConfig = defaultQuestions as QuestionsConfig;

/**
 * Hook to load default questions from JSON config based on document type and language.
 * Falls back to English if the specified language is not available.
 */
export function useDefaultQuestions(
  documentType: DocumentType | string,
  language: Language | string
): DefaultQuestionSet {
  return useMemo(() => {
    const docTypeQuestions = questionsConfig.documentTypes[documentType];

    if (!docTypeQuestions) {
      // Return empty if document type not found
      return {
        defaultQuestions: [],
        optionalQuestions: [],
      };
    }

    // Try to get questions for the specified language, fallback to English
    const langQuestions = docTypeQuestions[language] || docTypeQuestions['en'];

    if (!langQuestions) {
      return {
        defaultQuestions: [],
        optionalQuestions: [],
      };
    }

    return {
      defaultQuestions: langQuestions.default || [],
      optionalQuestions: langQuestions.optional || [],
    };
  }, [documentType, language]);
}

/**
 * Get all available document types from the config
 */
export function getDocumentTypes(): string[] {
  return Object.keys(questionsConfig.documentTypes);
}

/**
 * Get all available languages for a specific document type
 */
export function getLanguagesForDocumentType(documentType: string): string[] {
  const docTypeQuestions = questionsConfig.documentTypes[documentType];
  return docTypeQuestions ? Object.keys(docTypeQuestions) : [];
}
