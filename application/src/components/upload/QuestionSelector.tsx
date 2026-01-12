import React, { useState, useCallback, useMemo } from 'react';
import { useDefaultQuestions } from '../../hooks/useDefaultQuestions';
import type { DefaultQuestion } from '../../hooks/useDefaultQuestions';

export interface SelectedQuestion {
  id: string;
  text: string;
  type: string;
  isCustom: boolean;
}

interface QuestionSelectorProps {
  documentType: string;
  language: string;
  selectedQuestions: SelectedQuestion[];
  onQuestionsChange: (questions: SelectedQuestion[]) => void;
  className?: string;
}

/**
 * Component for selecting questions before annotation.
 * Loads default questions based on document type and language.
 */
export function QuestionSelector({
  documentType,
  language,
  selectedQuestions,
  onQuestionsChange,
  className = '',
}: QuestionSelectorProps) {
  const { defaultQuestions, optionalQuestions } = useDefaultQuestions(documentType, language);
  const [customQuestionText, setCustomQuestionText] = useState('');

  // Convert default questions to SelectedQuestion format
  const defaultAsSelected = useMemo(
    () =>
      defaultQuestions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        isCustom: false,
      })),
    [defaultQuestions]
  );

  const optionalAsSelected = useMemo(
    () =>
      optionalQuestions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        isCustom: false,
      })),
    [optionalQuestions]
  );

  // Check if a question is selected
  const isSelected = useCallback(
    (questionId: string) => selectedQuestions.some((q) => q.id === questionId),
    [selectedQuestions]
  );

  // Toggle question selection
  const toggleQuestion = useCallback(
    (question: DefaultQuestion, isCustom: boolean = false) => {
      const exists = selectedQuestions.find((q) => q.id === question.id);

      if (exists) {
        // Remove
        onQuestionsChange(selectedQuestions.filter((q) => q.id !== question.id));
      } else {
        // Add
        onQuestionsChange([
          ...selectedQuestions,
          {
            id: question.id,
            text: question.text,
            type: question.type,
            isCustom,
          },
        ]);
      }
    },
    [selectedQuestions, onQuestionsChange]
  );

  // Add custom question
  const addCustomQuestion = useCallback(() => {
    if (!customQuestionText.trim()) return;

    const customId = `custom-${Date.now()}`;
    const customQuestion: SelectedQuestion = {
      id: customId,
      text: customQuestionText.trim(),
      type: 'EXTRACTIVE',
      isCustom: true,
    };

    onQuestionsChange([...selectedQuestions, customQuestion]);
    setCustomQuestionText('');
  }, [customQuestionText, selectedQuestions, onQuestionsChange]);

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '4px',
  };

  const questionItemStyle = (selected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px',
    backgroundColor: selected ? '#eff6ff' : '#f9fafb',
    borderRadius: '8px',
    cursor: 'pointer',
    border: selected ? '2px solid #3b82f6' : '2px solid transparent',
    transition: 'all 0.2s ease',
    minHeight: '48px',
  });

  const checkboxStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    marginTop: '2px',
    flexShrink: 0,
    cursor: 'pointer',
  };

  const questionTextStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#374151',
    lineHeight: '1.5',
    flex: 1,
  };

  const addCustomStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
    minHeight: '48px',
  };

  const addButtonStyle: React.CSSProperties = {
    padding: '12px 16px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: customQuestionText.trim() ? 'pointer' : 'not-allowed',
    opacity: customQuestionText.trim() ? 1 : 0.5,
    minHeight: '48px',
    minWidth: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const customTagStyle: React.CSSProperties = {
    fontSize: '10px',
    backgroundColor: '#ddd6fe',
    color: '#6d28d9',
    padding: '2px 6px',
    borderRadius: '4px',
    marginLeft: '8px',
  };

  const removeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    padding: '4px',
    fontSize: '14px',
  };

  // Get custom questions from selected
  const customQuestions = selectedQuestions.filter((q) => q.isCustom);

  return (
    <div className={`question-selector ${className}`} style={containerStyle}>
      {/* Default Questions */}
      {defaultAsSelected.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>
            {language === 'ja' ? 'デフォルトの質問' : 'Default Questions'}
          </div>
          {defaultAsSelected.map((question) => (
            <label
              key={question.id}
              style={questionItemStyle(isSelected(question.id))}
              onClick={() => toggleQuestion(question)}
            >
              <input
                type="checkbox"
                checked={isSelected(question.id)}
                onChange={() => {}}
                style={checkboxStyle}
              />
              <span style={questionTextStyle}>{question.text}</span>
            </label>
          ))}
        </div>
      )}

      {/* Optional Questions */}
      {optionalAsSelected.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>
            {language === 'ja' ? 'オプションの質問' : 'Optional Questions'}
          </div>
          {optionalAsSelected.map((question) => (
            <label
              key={question.id}
              style={questionItemStyle(isSelected(question.id))}
              onClick={() => toggleQuestion(question)}
            >
              <input
                type="checkbox"
                checked={isSelected(question.id)}
                onChange={() => {}}
                style={checkboxStyle}
              />
              <span style={questionTextStyle}>{question.text}</span>
            </label>
          ))}
        </div>
      )}

      {/* Custom Questions */}
      {customQuestions.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>
            {language === 'ja' ? 'カスタム質問' : 'Custom Questions'}
          </div>
          {customQuestions.map((question) => (
            <div key={question.id} style={questionItemStyle(true)}>
              <input
                type="checkbox"
                checked={true}
                onChange={() => toggleQuestion(question as DefaultQuestion, true)}
                style={checkboxStyle}
              />
              <span style={questionTextStyle}>
                {question.text}
                <span style={customTagStyle}>Custom</span>
              </span>
              <button
                type="button"
                style={removeButtonStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  onQuestionsChange(selectedQuestions.filter((q) => q.id !== question.id));
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Custom Question */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          {language === 'ja' ? 'カスタム質問を追加' : 'Add Custom Question'}
        </div>
        <div style={addCustomStyle}>
          <input
            type="text"
            value={customQuestionText}
            onChange={(e) => setCustomQuestionText(e.target.value)}
            placeholder={language === 'ja' ? '質問を入力...' : 'Enter your question...'}
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomQuestion();
              }
            }}
          />
          <button
            type="button"
            style={addButtonStyle}
            onClick={addCustomQuestion}
            disabled={!customQuestionText.trim()}
          >
            +
          </button>
        </div>
      </div>

      {/* Selected Count */}
      <div
        style={{
          fontSize: '12px',
          color: '#6b7280',
          textAlign: 'right',
        }}
      >
        {language === 'ja'
          ? `${selectedQuestions.length}個の質問を選択中`
          : `${selectedQuestions.length} question(s) selected`}
      </div>
    </div>
  );
}
