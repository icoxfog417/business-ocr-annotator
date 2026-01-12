import { useState, useCallback, useMemo } from 'react';
import type { SelectedQuestion } from '../upload/QuestionSelector';
import { QuestionNavigator } from './QuestionNavigator';
import { ReadButton } from './ReadButton';
import { TouchCanvas } from './TouchCanvas';
import type { TouchMode, BoundingBox } from './TouchCanvas';
import { ModeBadge, DrawBoxButton } from './ModeBadge';
import { FinalizeScreen } from './FinalizeScreen';
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
  onReadText: (box: BoundingBox) => Promise<{
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
      const existing = existingAnnotations.find(ann => ann.question === q.text);
      return {
        questionId: q.id,
        question: q.text,
        answer: existing?.answer || '',
        boundingBox: parseBoundingBox(existing?.boundingBoxes),
        aiAssisted: existing?.aiAssisted || false,
        skipped: false,
      };
    })
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<TouchMode>('view');
  const [isFinalized, setIsFinalized] = useState(false);

  // Direct access - no intermediate variables
  const box = answers[currentIndex]?.boundingBox;
  const answer = answers[currentIndex]?.answer || '';

  // Update answer at specific index
  const updateAnswer = useCallback((index: number, updates: Partial<AnnotationAnswer>) => {
    setAnswers(prev => prev.map((a, i) => i === index ? { ...a, ...updates } : a));
  }, []);

  // Navigation
  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
      setMode('view');
    }
  }, [questions.length]);

  const goNext = useCallback(async () => {
    if (currentIndex < questions.length - 1) {
      goTo(currentIndex + 1);
    } else {
      // Last question - finalize
      await onComplete(answers);
      setIsFinalized(true);
    }
  }, [currentIndex, questions.length, goTo, onComplete, answers]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) goTo(currentIndex - 1);
  }, [currentIndex, goTo]);

  const skip = useCallback(() => {
    updateAnswer(currentIndex, { skipped: true });
    goNext();
  }, [currentIndex, updateAnswer, goNext]);

  // Box created - update current question's box
  const handleBoxCreated = useCallback((newBox: BoundingBox) => {
    updateAnswer(currentIndex, { boundingBox: newBox });
    setMode('view');
  }, [currentIndex, updateAnswer]);

  // Read text from box
  const handleReadText = useCallback(async () => {
    const currentBox = answers[currentIndex]?.boundingBox;
    if (!currentBox) throw new Error('No bounding box');
    return onReadText(currentBox);
  }, [currentIndex, answers, onReadText]);

  const handleTextExtracted = useCallback((text: string, metadata: {
    modelId: string;
    modelProvider: string;
    timestamp: string;
    confidence?: number;
  }) => {
    updateAnswer(currentIndex, {
      answer: text,
      aiAssisted: true,
      aiModelId: metadata.modelId,
      aiModelProvider: metadata.modelProvider,
      aiExtractionTimestamp: metadata.timestamp,
      confidence: metadata.confidence,
    });
  }, [currentIndex, updateAnswer]);

  // Question statuses for progress dots
  const statuses = useMemo<QuestionStatus[]>(() =>
    answers.map((a, i) => {
      if (i === currentIndex) return 'current';
      if (a.skipped) return 'skipped';
      if (a.answer && a.boundingBox) return 'completed';
      return 'pending';
    }),
  [answers, currentIndex]);

  // Summary for finalize screen
  const summary = useMemo(() => ({
    totalQuestions: questions.length,
    answeredQuestions: answers.filter(a => a.answer && !a.skipped).length,
    skippedQuestions: answers.filter(a => a.skipped).length,
    boundingBoxesDrawn: answers.filter(a => a.boundingBox).length,
    aiAssistedCount: answers.filter(a => a.aiAssisted).length,
  }), [questions.length, answers]);

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

  const canGoNext = !!(answers[currentIndex]?.answer) || answers[currentIndex]?.skipped;

  return (
    <div className={`annotation-flow ${className}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Mode Badge (mobile) */}
      {isMobile && <ModeBadge mode={mode} onToggle={() => setMode(m => m === 'view' ? 'draw' : 'view')} language={language} />}

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#f3f4f6' }}>
        <TouchCanvas
          imageSrc={imageSrc}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          boxes={box ? [box] : []}
          selectedBoxIndex={box ? 0 : null}
          mode={mode}
          onModeChange={setMode}
          onBoxCreated={handleBoxCreated}
        />
      </div>

      {/* Controls */}
      <div style={{ padding: 16, backgroundColor: '#fff', borderTop: '1px solid #e5e7eb' }}>
        {/* Question */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
            {language === 'ja' ? '質問' : 'Question'} {currentIndex + 1}/{questions.length}
          </div>
          <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 8, fontSize: 16, fontWeight: 500 }}>
            {questions[currentIndex]?.text}
          </div>
        </div>

        {/* Select Area */}
        <div style={{ marginBottom: 12 }}>
          <DrawBoxButton
            onClick={() => {
              if (box) updateAnswer(currentIndex, { boundingBox: null });
              setMode(mode === 'draw' ? 'view' : 'draw');
            }}
            isDrawMode={mode === 'draw'}
            disabled={false}
            language={language}
          />
          {box && (
            <span style={{ marginLeft: 12, color: '#10b981', fontSize: 14 }}>
              ✓ {language === 'ja' ? '選択済み' : 'Selected'}
            </span>
          )}
        </div>

        {/* Answer */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <input
            type="text"
            value={answer}
            onChange={(e) => updateAnswer(currentIndex, { answer: e.target.value, aiAssisted: false })}
            placeholder={language === 'ja' ? '回答を入力...' : 'Enter answer...'}
            style={{ flex: 1, padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}
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
          currentIndex={currentIndex}
          totalQuestions={questions.length}
          currentQuestion={questions[currentIndex]?.text || ''}
          statuses={statuses}
          onPrevious={goPrev}
          onNext={goNext}
          onSkip={skip}
          onDotClick={goTo}
          canGoPrevious={currentIndex > 0}
          canGoNext={canGoNext}
          isLastQuestion={currentIndex === questions.length - 1}
          language={language}
        />
      </div>
    </div>
  );
}
