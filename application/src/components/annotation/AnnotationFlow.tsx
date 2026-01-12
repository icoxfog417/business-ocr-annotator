import React, { useState, useCallback, useMemo } from 'react';
import type { SelectedQuestion } from '../upload/QuestionSelector';
import { QuestionNavigator } from './QuestionNavigator';
import { ReadButton } from './ReadButton';
import { TouchCanvas } from './TouchCanvas';
import type { TouchMode, BoundingBox } from './TouchCanvas';
import { ModeBadge, DrawBoxButton } from './ModeBadge';
import { FloatingZoomControls } from './ZoomControlsMobile';
import { FinalizeScreen } from './FinalizeScreen';
import {
  useKeyboardShortcuts,
  createAnnotationShortcuts,
} from '../../hooks/useKeyboardShortcuts';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { QuestionStatus } from './ProgressDots';

export interface AnnotationAnswer {
  questionId: string;
  question: string;
  answer: string;
  boundingBox: BoundingBox | null;
  aiAssisted: boolean;
  aiModelId?: string;
  aiModelProvider?: string;
  aiExtractionTimestamp?: string;
  confidence?: number;
  skipped: boolean;
}

interface AnnotationFlowProps {
  imageId?: string; // Reserved for future use
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  questions: SelectedQuestion[];
  language: string;
  onComplete: (answers: AnnotationAnswer[]) => Promise<void>;
  onReadText: (box: BoundingBox) => Promise<{
    text: string;
    modelId: string;
    confidence?: number;
  }>;
  onUploadNext: () => void;
  onBackToGallery: () => void;
  className?: string;
}

/**
 * Container managing question-by-question annotation flow.
 * Enforces box-first workflow and manages state.
 */
export function AnnotationFlow({
  imageSrc,
  imageWidth,
  imageHeight,
  questions,
  language,
  onComplete,
  onReadText,
  onUploadNext,
  onBackToGallery,
  className = '',
}: AnnotationFlowProps) {
  const { isMobile } = useBreakpoint();

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnnotationAnswer[]>(() =>
    questions.map((q) => ({
      questionId: q.id,
      question: q.text,
      answer: '',
      boundingBox: null,
      aiAssisted: false,
      skipped: false,
    }))
  );
  const [mode, setMode] = useState<TouchMode>('view');
  const [zoom, setZoom] = useState(1);
  const [, setSelectedBoxIndex] = useState<number | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [, setIsSaving] = useState(false);

  // Current answer
  const currentAnswer = answers[currentIndex];
  const currentQuestion = questions[currentIndex];

  // Question statuses for progress dots
  const statuses = useMemo<QuestionStatus[]>(
    () =>
      answers.map((a, i) => {
        if (i === currentIndex) return 'current';
        if (a.skipped) return 'skipped';
        if (a.answer && a.boundingBox) return 'completed';
        return 'pending';
      }),
    [answers, currentIndex]
  );

  // Update answer for current question
  const updateCurrentAnswer = useCallback(
    (updates: Partial<AnnotationAnswer>) => {
      setAnswers((prev) =>
        prev.map((a, i) => (i === currentIndex ? { ...a, ...updates } : a))
      );
    },
    [currentIndex]
  );

  // Navigation handlers
  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
      setMode('view');
      setSelectedBoxIndex(null);
    }
  }, [questions.length]);

  const goNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      goToQuestion(currentIndex + 1);
    } else {
      setIsFinalized(true);
    }
  }, [currentIndex, questions.length, goToQuestion]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      goToQuestion(currentIndex - 1);
    }
  }, [currentIndex, goToQuestion]);

  const skipQuestion = useCallback(() => {
    updateCurrentAnswer({ skipped: true });
    goNext();
  }, [updateCurrentAnswer, goNext]);

  // Box handlers
  const handleBoxCreated = useCallback(
    (box: BoundingBox) => {
      updateCurrentAnswer({ boundingBox: box });
      setSelectedBoxIndex(0); // Select the new box
    },
    [updateCurrentAnswer]
  );

  const handleBoxUpdated = useCallback(
    (index: number, box: BoundingBox) => {
      if (index === 0) {
        updateCurrentAnswer({ boundingBox: box });
      }
    },
    [updateCurrentAnswer]
  );

  // Read text handler
  const handleReadText = useCallback(async () => {
    if (!currentAnswer.boundingBox) {
      throw new Error('No bounding box selected');
    }
    return onReadText(currentAnswer.boundingBox);
  }, [currentAnswer.boundingBox, onReadText]);

  const handleTextExtracted = useCallback(
    (
      text: string,
      metadata: {
        modelId: string;
        modelProvider: string;
        timestamp: string;
        confidence?: number;
      }
    ) => {
      updateCurrentAnswer({
        answer: text,
        aiAssisted: true,
        aiModelId: metadata.modelId,
        aiModelProvider: metadata.modelProvider,
        aiExtractionTimestamp: metadata.timestamp,
        confidence: metadata.confidence,
      });
    },
    [updateCurrentAnswer]
  );

  // Zoom handlers
  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 4)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.25, 0.5)), []);
  const zoomFit = useCallback(() => setZoom(1), []);

  // Mode toggle
  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'view' ? 'draw' : 'view'));
  }, []);

  // Finalize handler
  const handleFinalize = useCallback(async () => {
    setIsSaving(true);
    try {
      await onComplete(answers);
      setIsFinalized(true);
    } finally {
      setIsSaving(false);
    }
  }, [answers, onComplete]);

  // Keyboard shortcuts
  useKeyboardShortcuts(
    createAnnotationShortcuts({
      onNext: goNext,
      onPrev: goPrev,
      onToggleDraw: toggleMode,
      onRead: currentAnswer.boundingBox ? () => handleReadText() : undefined,
      onSkip: skipQuestion,
      onCancel: () => setMode('view'),
      onFinalize: currentIndex === questions.length - 1 ? handleFinalize : undefined,
    }),
    { enabled: !isFinalized }
  );

  // Summary for finalize screen
  const summary = useMemo(
    () => ({
      totalQuestions: questions.length,
      answeredQuestions: answers.filter((a) => a.answer && !a.skipped).length,
      skippedQuestions: answers.filter((a) => a.skipped).length,
      boundingBoxesDrawn: answers.filter((a) => a.boundingBox).length,
      aiAssistedCount: answers.filter((a) => a.aiAssisted).length,
    }),
    [questions.length, answers]
  );

  // Show finalize screen
  if (isFinalized) {
    return (
      <FinalizeScreen
        summary={summary}
        onUploadNext={onUploadNext}
        onBackToGallery={onBackToGallery}
        language={language}
      />
    );
  }

  // Get boxes for current question only
  const currentBoxes = currentAnswer.boundingBox ? [currentAnswer.boundingBox] : [];

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    position: 'relative',
  };

  const canvasContainerStyle: React.CSSProperties = {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  };

  const controlsStyle: React.CSSProperties = {
    padding: '16px',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #e5e7eb',
  };

  const answerSectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  };

  const stepLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const stepNumberStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
  };

  const answerRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
    minHeight: '48px',
  };

  return (
    <div className={`annotation-flow ${className}`} style={containerStyle}>
      {/* Mode Badge */}
      {isMobile && (
        <ModeBadge mode={mode} onToggle={toggleMode} language={language} />
      )}

      {/* Canvas Area */}
      <div style={canvasContainerStyle}>
        <TouchCanvas
          imageSrc={imageSrc}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          boxes={currentBoxes}
          selectedBoxIndex={currentAnswer.boundingBox ? 0 : null}
          mode={mode}
          onModeChange={setMode}
          onBoxCreated={handleBoxCreated}
          onBoxSelected={setSelectedBoxIndex}
          onBoxUpdated={handleBoxUpdated}
          zoom={zoom}
        />
      </div>

      {/* Controls */}
      <div style={controlsStyle}>
        {/* Answer Section */}
        <div style={answerSectionStyle}>
          {/* Step 1: Question */}
          <div>
            <div style={stepLabelStyle}>
              <span style={stepNumberStyle}>1</span>
              {language === 'ja' ? '質問' : 'Question'}
            </div>
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#f9fafb', 
              borderRadius: '8px', 
              marginTop: '8px',
              fontSize: '16px',
              fontWeight: '500'
            }}>
              {currentQuestion.text}
            </div>
          </div>

          {/* Step 2: Select Area */}
          <div>
            <div style={stepLabelStyle}>
              <span style={stepNumberStyle}>2</span>
              {language === 'ja' ? 'エリアを選択' : 'Select Area'}
            </div>
            <div style={{ marginTop: '8px' }}>
              <DrawBoxButton
                onClick={() => {
                  if (currentAnswer.boundingBox) {
                    // Clear existing box and allow redraw
                    updateCurrentAnswer({ boundingBox: null });
                  }
                  toggleMode();
                }}
                isDrawMode={mode === 'draw'}
                disabled={false}
                language={language}
              />
              {currentAnswer.boundingBox && (
                <span style={{ marginLeft: '12px', color: '#10b981', fontSize: '14px' }}>
                  ✓ {language === 'ja' ? '選択済み' : 'Selected'}
                </span>
              )}
            </div>
          </div>

          {/* Step 3: Answer */}
          <div>
            <div style={stepLabelStyle}>
              <span style={stepNumberStyle}>3</span>
              {language === 'ja' ? '回答' : 'Answer'}
            </div>
            <div style={{ ...answerRowStyle, marginTop: '8px' }}>
              <input
                type="text"
                value={currentAnswer.answer}
                onChange={(e) => updateCurrentAnswer({ answer: e.target.value, aiAssisted: false })}
                placeholder={language === 'ja' ? '回答を入力...' : 'Enter answer...'}
                style={inputStyle}
              />
              <ReadButton
                onRead={handleReadText}
                onTextExtracted={handleTextExtracted}
                disabled={!currentAnswer.boundingBox}
                hasBox={!!currentAnswer.boundingBox}
                language={language}
              />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <QuestionNavigator
          currentIndex={currentIndex}
          totalQuestions={questions.length}
          currentQuestion={currentQuestion.text}
          statuses={statuses}
          onPrevious={goPrev}
          onNext={goNext}
          onSkip={skipQuestion}
          onDotClick={goToQuestion}
          canGoPrevious={currentIndex > 0}
          canGoNext={!!currentAnswer.answer || currentAnswer.skipped}
          isLastQuestion={currentIndex === questions.length - 1}
          language={language}
        />
      </div>
    </div>
  );
}
