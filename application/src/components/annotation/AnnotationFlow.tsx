import { useState, useCallback, useMemo, useEffect } from 'react';
import type { SelectedQuestion } from '../upload/QuestionSelector';
import { QuestionNavigator } from './QuestionNavigator';
import { ReadButton } from './ReadButton';
import { TouchCanvas } from './TouchCanvas';
import type { TouchMode, BoundingBox } from './TouchCanvas';
import { ModeBadge, DrawBoxButton, NoAnswerButton } from './ModeBadge';
import { FinalizeScreen } from './FinalizeScreen';
import { useBreakpoint } from '../../hooks/useBreakpoint';

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
  isUnanswerable: boolean; // True if marked as "No Answer" (document lacks this info)
}

interface AnnotationFlowProps {
  imageId?: string;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  questions: SelectedQuestion[];
  existingAnnotations?: Array<{
    question: string;
    answer: string;
    boundingBoxes: string | number[][];
    aiAssisted?: boolean;
  }>;
  language: string;
  onComplete: (answers: AnnotationAnswer[]) => Promise<void>;
  onReadText: (box: BoundingBox, question: string) => Promise<{
    text: string;
    modelId: string;
    confidence?: number;
  }>;
  onUploadNext: () => void;
  onBackToGallery: () => void;
  className?: string;
}

// Parse bounding box from various formats to {x, y, width, height}
function parseBoundingBox(boxes: string | number[][] | null | undefined): BoundingBox | null {
  if (!boxes) return null;

  const parsed = typeof boxes === 'string' ? JSON.parse(boxes) : boxes;
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const first = parsed[0];
  if (!Array.isArray(first) || first.length !== 4) return null;

  const [x0, y0, x1, y1] = first;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function AnnotationFlow({
  imageSrc,
  imageWidth,
  imageHeight,
  questions,
  existingAnnotations = [],
  language,
  onComplete,
  onReadText,
  onUploadNext,
  onBackToGallery,
  className = '',
}: AnnotationFlowProps) {
  const { isMobile } = useBreakpoint();

  // Initialize answers from questions + existing annotations
  const [answers, setAnswers] = useState<AnnotationAnswer[]>(() =>
    questions.map((q) => {
      const existing = existingAnnotations.find((ann) => ann.question === q.text);
      return {
        questionId: q.id,
        question: q.text,
        answer: existing?.answer || '',
        boundingBox: parseBoundingBox(existing?.boundingBoxes),
        aiAssisted: existing?.aiAssisted || false,
        skipped: false,
        isUnanswerable: false,
      };
    })
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<TouchMode>('view');
  const [isFinalized, setIsFinalized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Direct access
  const box = answers[currentIndex]?.boundingBox;
  const answer = answers[currentIndex]?.answer || '';

  // Update answer at specific index
  const updateAnswer = useCallback((index: number, updates: Partial<AnnotationAnswer>) => {
    setAnswers((prev) => prev.map((a, i) => (i === index ? { ...a, ...updates } : a)));
  }, []);

  // Navigation
  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < questions.length) {
        setCurrentIndex(index);
        setMode('view');
      }
    },
    [questions.length]
  );

  const canGoNext =
    !!(answers[currentIndex]?.answer) ||
    answers[currentIndex]?.skipped ||
    answers[currentIndex]?.isUnanswerable;

  const goNext = useCallback(async () => {
    if (currentIndex < questions.length - 1) {
      goTo(currentIndex + 1);
    } else if (canGoNext && !isSubmitting) {
      setIsSubmitting(true);
      await onComplete(answers);
      setIsFinalized(true);
    }
  }, [currentIndex, questions.length, goTo, onComplete, answers, canGoNext, isSubmitting]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) goTo(currentIndex - 1);
  }, [currentIndex, goTo]);

  const skip = useCallback(() => {
    const updatedAnswers = answers.map((a, i) =>
      i === currentIndex ? { ...a, skipped: true } : a
    );
    setAnswers(updatedAnswers);

    // Navigate or finalize with updated answers
    if (currentIndex < questions.length - 1) {
      goTo(currentIndex + 1);
    } else if (!isSubmitting) {
      setIsSubmitting(true);
      onComplete(updatedAnswers).then(() => setIsFinalized(true));
    }
  }, [currentIndex, answers, questions.length, goTo, isSubmitting, onComplete]);

  // Mark current question as unanswerable (document doesn't have this info)
  const markUnanswerable = useCallback(() => {
    const updatedAnswers = answers.map((a, i) =>
      i === currentIndex
        ? { ...a, isUnanswerable: true, answer: '', boundingBox: null, skipped: false }
        : a
    );
    setAnswers(updatedAnswers);

    // Navigate or finalize
    if (currentIndex < questions.length - 1) {
      goTo(currentIndex + 1);
    } else if (!isSubmitting) {
      setIsSubmitting(true);
      onComplete(updatedAnswers).then(() => setIsFinalized(true));
    }
  }, [currentIndex, answers, questions.length, goTo, isSubmitting, onComplete]);

  const toggleDrawMode = useCallback(() => {
    if (box) updateAnswer(currentIndex, { boundingBox: null });
    setMode((m) => (m === 'draw' ? 'view' : 'draw'));
  }, [box, currentIndex, updateAnswer]);

  // Box created
  const handleBoxCreated = useCallback(
    (newBox: BoundingBox) => {
      updateAnswer(currentIndex, { boundingBox: newBox });
      setMode('view');
    },
    [currentIndex, updateAnswer]
  );

  // Box updated (moved or resized)
  const handleBoxUpdated = useCallback(
    (_index: number, updatedBox: BoundingBox) => {
      updateAnswer(currentIndex, { boundingBox: updatedBox });
    },
    [currentIndex, updateAnswer]
  );

  // Read text from box
  const handleReadText = useCallback(async () => {
    const currentBox = answers[currentIndex]?.boundingBox;
    if (!currentBox) throw new Error('No bounding box');
    const currentQuestion = questions[currentIndex]?.text || '';
    return onReadText(currentBox, currentQuestion);
  }, [currentIndex, answers, questions, onReadText]);

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
      updateAnswer(currentIndex, {
        answer: text,
        aiAssisted: true,
        aiModelId: metadata.modelId,
        aiModelProvider: metadata.modelProvider,
        aiExtractionTimestamp: metadata.timestamp,
        confidence: metadata.confidence,
      });
    },
    [currentIndex, updateAnswer]
  );

  // Keyboard shortcuts (desktop only)
  useEffect(() => {
    if (isMobile || isFinalized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          if (canGoNext) goNext();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'd':
        case 'D':
          toggleDrawMode();
          break;
        case 's':
        case 'S':
          skip();
          break;
        case 'Escape':
          if (mode === 'draw') setMode('view');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, isFinalized, canGoNext, goNext, goPrev, toggleDrawMode, skip, mode]);

  // Summary for finalize screen
  const summary = useMemo(
    () => ({
      totalQuestions: questions.length,
      answeredQuestions: answers.filter((a) => a.answer && !a.skipped && !a.isUnanswerable).length,
      skippedQuestions: answers.filter((a) => a.skipped).length,
      unanswerableQuestions: answers.filter((a) => a.isUnanswerable).length,
      boundingBoxesDrawn: answers.filter((a) => a.boundingBox).length,
      aiAssistedCount: answers.filter((a) => a.aiAssisted).length,
    }),
    [questions.length, answers]
  );

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

  // Responsive layout: column on mobile, row on desktop
  return (
    <div
      className={`annotation-flow ${className}`}
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        height: '100%',
      }}
    >
      {/* Mode Badge (mobile only) */}
      {isMobile && (
        <ModeBadge
          mode={mode}
          onToggle={() => setMode((m) => (m === 'view' ? 'draw' : 'view'))}
          language={language}
        />
      )}

      {/* Canvas area */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#f3f4f6',
          minHeight: isMobile ? '50vh' : 'auto',
        }}
      >
        <TouchCanvas
          imageSrc={imageSrc}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          boxes={box ? [box] : []}
          selectedBoxIndex={box ? 0 : null}
          mode={mode}
          onModeChange={setMode}
          onBoxCreated={handleBoxCreated}
          onBoxUpdated={handleBoxUpdated}
        />
      </div>

      {/* Controls panel */}
      <div
        style={{
          width: isMobile ? '100%' : 400,
          padding: 16,
          backgroundColor: '#fff',
          borderTop: isMobile ? '1px solid #e5e7eb' : 'none',
          borderLeft: isMobile ? 'none' : '1px solid #e5e7eb',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Back button (desktop) */}
        {!isMobile && (
          <button
            onClick={onBackToGallery}
            style={{
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              cursor: 'pointer',
              marginBottom: 16,
              alignSelf: 'flex-start',
            }}
          >
            ← Back to Gallery
          </button>
        )}

        {/* Question */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
            {language === 'ja' ? '質問' : 'Question'} {currentIndex + 1}/{questions.length}
          </div>
          <div
            style={{
              padding: 12,
              backgroundColor: '#f9fafb',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            {questions[currentIndex]?.text}
          </div>
        </div>

        {/* Select Area or No Answer */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
          <DrawBoxButton
            onClick={toggleDrawMode}
            isDrawMode={mode === 'draw'}
            disabled={false}
            language={language}
          />
          <NoAnswerButton onClick={markUnanswerable} language={language} />
          {box && (
            <span style={{ color: '#10b981', fontSize: 14 }}>
              ✓ {language === 'ja' ? '選択済み' : 'Selected'}
            </span>
          )}
          {!isMobile && (
            <span style={{ color: '#9ca3af', fontSize: 12 }}>(D)</span>
          )}
        </div>

        {/* Answer */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
          <textarea
            value={answer}
            onChange={(e) => {
              const newValue = e.target.value;
              // Only reset aiAssisted if text actually changed
              if (newValue !== answer) {
                updateAnswer(currentIndex, { answer: newValue, aiAssisted: false });
              }
            }}
            placeholder={language === 'ja' ? '回答を入力...' : 'Enter answer...'}
            rows={3}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontSize: 14,
              resize: 'vertical',
              minHeight: 60,
              fontFamily: 'inherit',
            }}
          />
          <ReadButton
            onRead={handleReadText}
            onTextExtracted={handleTextExtracted}
            disabled={!box}
            hasBox={!!box}
            language={language}
          />
        </div>

        {/* Navigation */}
        <QuestionNavigator
          onPrevious={goPrev}
          onNext={goNext}
          onSkip={skip}
          canGoPrevious={currentIndex > 0}
          canGoNext={canGoNext}
          isLastQuestion={currentIndex === questions.length - 1}
          language={language}
        />

        {/* Keyboard shortcuts hint (desktop) */}
        {!isMobile && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              backgroundColor: '#f9fafb',
              borderRadius: 8,
              fontSize: 12,
              color: '#6b7280',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Keyboard Shortcuts</div>
            <div>← → Navigate • D Draw • S Skip • Esc Cancel</div>
          </div>
        )}
      </div>
    </div>
  );
}
