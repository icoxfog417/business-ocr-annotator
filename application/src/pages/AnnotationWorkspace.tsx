import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import { getUrl } from 'aws-amplify/storage';
import type { Schema } from '../../amplify/data/resource';
import { CanvasAnnotator } from '../components/CanvasAnnotator';
import {
  type BoundingBox,
  type CanvasBoundingBox,
  type AIAnnotationResult,
  canvasToHuggingFace,
  huggingFaceToCanvas,
} from '../types';

const client = generateClient<Schema>();

interface Annotation {
  id: string;
  question: string;
  answer: string;
  boundingBoxes: BoundingBox[];
  validationStatus?: string;
  generatedBy?: string;
  confidence?: number;
}

interface ImageData {
  id: string;
  fileName: string;
  // 3-tier storage keys
  s3KeyOriginal: string;
  s3KeyCompressed?: string;
  s3KeyThumbnail?: string;
  uploadedAt: string;
  language: string;
  documentType?: string;
  width: number;
  height: number;
  status?: string;
}

const LANGUAGES = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
];

export function AnnotationWorkspace() {
  const { imageId } = useParams<{ imageId: string }>();
  const [image, setImage] = useState<ImageData | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [canvasBoxes, setCanvasBoxes] = useState<CanvasBoundingBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string>('');
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newLanguage, setNewLanguage] = useState('ja');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AIAnnotationResult[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>(
    'ALL'
  );
  const [finalizing, setFinalizing] = useState(false);

  const fetchImageAndAnnotations = useCallback(async () => {
    if (!imageId) return;

    try {
      const { data: imageData } = await client.models.Image.get({ id: imageId });
      if (imageData) {
        setImage({
          id: imageData.id,
          fileName: imageData.fileName,
          s3KeyOriginal: imageData.s3KeyOriginal,
          s3KeyCompressed: imageData.s3KeyCompressed ?? undefined,
          s3KeyThumbnail: imageData.s3KeyThumbnail ?? undefined,
          uploadedAt: imageData.uploadedAt,
          language: imageData.language,
          documentType: imageData.documentType ?? undefined,
          width: imageData.width,
          height: imageData.height,
          status: imageData.status ?? undefined,
        });
        setNewLanguage(imageData.language);
        // Use compressed image for annotation workspace if available, otherwise use original
        const imageKey = imageData.s3KeyCompressed || imageData.s3KeyOriginal;
        const urlResult = await getUrl({ path: imageKey });
        setImageUrl(urlResult.url.toString());
      }

      const { data: annotationsData } = await client.models.Annotation.list({
        filter: { imageId: { eq: imageId } },
      });
      const fetchedAnnotations = annotationsData.map((a) => {
        const boxes =
          typeof a.boundingBoxes === 'string'
            ? JSON.parse(a.boundingBoxes)
            : (a.boundingBoxes as BoundingBox[]);
        return {
          id: a.id,
          question: a.question,
          answer: a.answer,
          boundingBoxes: boxes,
          validationStatus: a.validationStatus ?? undefined,
          generatedBy: a.generatedBy ?? undefined,
          confidence: a.confidence ?? undefined,
        };
      });
      setAnnotations(fetchedAnnotations);
      setCanvasBoxes([]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [imageId]);

  useEffect(() => {
    fetchImageAndAnnotations();
  }, [fetchImageAndAnnotations]);

  const generateAnnotations = async () => {
    if (!image || !imageId) return;

    setGenerating(true);
    setAiSuggestions([]);

    try {
      // Call Lambda function via fetch (using Lambda function URL or API Gateway)
      // For now, we'll use the Amplify client to invoke the function
      // Use compressed image for AI processing if available, otherwise use original
      const s3KeyForProcessing = image.s3KeyCompressed || image.s3KeyOriginal;
      const response = await fetch(
        `${window.location.origin}/api/generate-annotation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageId,
            s3Key: s3KeyForProcessing,
            language: image.language,
            documentType: image.documentType || 'OTHER',
            width: image.width,
            height: image.height,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate annotations');
      }

      const result = await response.json();

      if (result.success && result.annotations) {
        setAiSuggestions(result.annotations);
      } else {
        alert('Failed to generate annotations: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to generate annotations:', error);
      // For demo/development: generate mock suggestions
      const mockSuggestions: AIAnnotationResult[] = [
        {
          question: 'What is the total amount?',
          answer: '¥1,234',
          boundingBox: [
            Math.round(image.width * 0.6),
            Math.round(image.height * 0.8),
            Math.round(image.width * 0.9),
            Math.round(image.height * 0.85),
          ],
          confidence: 0.95,
        },
        {
          question: 'What is the date?',
          answer: '2026-01-11',
          boundingBox: [
            Math.round(image.width * 0.1),
            Math.round(image.height * 0.1),
            Math.round(image.width * 0.4),
            Math.round(image.height * 0.15),
          ],
          confidence: 0.88,
        },
      ];
      setAiSuggestions(mockSuggestions);
      alert(
        'Using mock data (Lambda not available). In production, this will call the AI model.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const adoptSuggestion = async (suggestion: AIAnnotationResult) => {
    if (!imageId) return;

    try {
      const newAnnotation = await client.models.Annotation.create({
        imageId,
        question: suggestion.question,
        answer: suggestion.answer,
        language: newLanguage,
        boundingBoxes: JSON.stringify([suggestion.boundingBox]),
        questionType: 'EXTRACTIVE',
        validationStatus: 'PENDING',
        generatedBy: 'AI',
        confidence: suggestion.confidence,
        modelVersion: 'nvidia.nemotron-nano-12b-v2',
        createdBy: 'current-user',
        createdAt: new Date().toISOString(),
      });

      if (newAnnotation.data) {
        const annotation = {
          id: newAnnotation.data.id,
          question: newAnnotation.data.question,
          answer: newAnnotation.data.answer,
          boundingBoxes:
            typeof newAnnotation.data.boundingBoxes === 'string'
              ? JSON.parse(newAnnotation.data.boundingBoxes)
              : (newAnnotation.data.boundingBoxes as BoundingBox[]),
          validationStatus: newAnnotation.data.validationStatus ?? undefined,
          generatedBy: newAnnotation.data.generatedBy ?? undefined,
          confidence: newAnnotation.data.confidence ?? undefined,
        };
        setAnnotations((prev) => [...prev, annotation]);
        setAiSuggestions((prev) => prev.filter((s) => s !== suggestion));
      }
    } catch (error) {
      console.error('Failed to adopt suggestion:', error);
      alert('Failed to save annotation');
    }
  };

  const rejectSuggestion = (suggestion: AIAnnotationResult) => {
    setAiSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  const addAnnotation = async () => {
    if (!newQuestion.trim() || !newAnswer.trim() || !imageId || !selectedBoxId) {
      return;
    }

    const selectedBox = canvasBoxes.find((box) => box.id === selectedBoxId);
    if (!selectedBox) return;

    try {
      const bbox = canvasToHuggingFace(selectedBox);

      const newAnnotation = await client.models.Annotation.create({
        imageId,
        question: newQuestion,
        answer: newAnswer,
        language: newLanguage,
        boundingBoxes: JSON.stringify([bbox]),
        questionType: 'EXTRACTIVE',
        validationStatus: 'PENDING',
        generatedBy: 'HUMAN',
        createdBy: 'current-user',
        createdAt: new Date().toISOString(),
      });

      if (newAnnotation.errors) {
        alert(
          'Failed to save annotation: ' +
            newAnnotation.errors.map((e) => e.message).join(', ')
        );
        return;
      }

      if (newAnnotation.data) {
        const annotation = {
          id: newAnnotation.data.id,
          question: newAnnotation.data.question,
          answer: newAnnotation.data.answer,
          boundingBoxes:
            typeof newAnnotation.data.boundingBoxes === 'string'
              ? JSON.parse(newAnnotation.data.boundingBoxes)
              : (newAnnotation.data.boundingBoxes as BoundingBox[]),
          validationStatus: newAnnotation.data.validationStatus ?? undefined,
          generatedBy: 'HUMAN',
        };
        setAnnotations((prev) => [...prev, annotation]);

        setCanvasBoxes((prev) =>
          prev.map((box) =>
            box.id === selectedBoxId ? { ...box, id: newAnnotation.data!.id } : box
          )
        );
        setSelectedBoxId(newAnnotation.data.id);

        setNewQuestion('');
        setNewAnswer('');
        alert('Annotation saved!');
      }
    } catch (error) {
      console.error('Failed to create annotation:', error);
      alert(
        'Failed to create annotation: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  };

  const updateValidationStatus = async (
    annotationId: string,
    status: 'APPROVED' | 'REJECTED'
  ) => {
    try {
      await client.models.Annotation.update({
        id: annotationId,
        validationStatus: status,
        validatedBy: 'current-user',
        validatedAt: new Date().toISOString(),
      });

      setAnnotations((prev) =>
        prev.map((a) => (a.id === annotationId ? { ...a, validationStatus: status } : a))
      );
    } catch (error) {
      console.error('Failed to update validation status:', error);
    }
  };

  const deleteAnnotation = async (annotationId: string) => {
    try {
      await client.models.Annotation.delete({ id: annotationId });
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
      setCanvasBoxes((prev) => prev.filter((box) => box.id !== annotationId));
      if (selectedBoxId === annotationId) {
        setSelectedBoxId('');
      }
    } catch (error) {
      console.error('Failed to delete annotation:', error);
    }
  };

  const handleCanvasBoxChange = (boxes: CanvasBoundingBox[]) => {
    setCanvasBoxes(boxes);
  };

  const handleBoxSelect = (boxId: string) => {
    setSelectedBoxId(boxId);
    const annotation = annotations.find((a) => a.id === boxId);
    if (annotation) {
      setNewQuestion(annotation.question);
      setNewAnswer(annotation.answer);
    }
  };

  const showAnnotationBox = (annotationId: string) => {
    const annotation = annotations.find((a) => a.id === annotationId);
    if (annotation) {
      const box = huggingFaceToCanvas(annotation.boundingBoxes[0], annotation.id);
      setCanvasBoxes([box]);
      setSelectedBoxId(annotation.id);
      setNewQuestion(annotation.question);
      setNewAnswer(annotation.answer);
    }
  };

  // Finalize all annotations (mark image as VALIDATED)
  const finalizeAnnotations = async () => {
    if (!imageId || !image) return;

    const unapprovedCount = annotations.filter(
      (a) => a.validationStatus !== 'APPROVED'
    ).length;

    if (unapprovedCount > 0) {
      const confirmFinalize = window.confirm(
        `There are ${unapprovedCount} annotations that are not approved. Do you want to approve them all and finalize?`
      );
      if (!confirmFinalize) return;

      // Approve all pending annotations
      setFinalizing(true);
      try {
        for (const annotation of annotations) {
          if (annotation.validationStatus !== 'APPROVED') {
            await client.models.Annotation.update({
              id: annotation.id,
              validationStatus: 'APPROVED',
              validatedBy: 'current-user',
              validatedAt: new Date().toISOString(),
            });
          }
        }
        setAnnotations((prev) =>
          prev.map((a) => ({ ...a, validationStatus: 'APPROVED' }))
        );
      } catch (error) {
        console.error('Failed to approve annotations:', error);
        setFinalizing(false);
        return;
      }
    }

    // Update image status to VALIDATED
    setFinalizing(true);
    try {
      await client.models.Image.update({
        id: imageId,
        status: 'VALIDATED',
        updatedAt: new Date().toISOString(),
      });
      setImage((prev) => (prev ? { ...prev, status: 'VALIDATED' } : null));
      alert('Annotations finalized successfully!');
    } catch (error) {
      console.error('Failed to finalize:', error);
      alert('Failed to finalize annotations');
    } finally {
      setFinalizing(false);
    }
  };

  // Re-open annotations (mark image as ANNOTATING)
  const reopenAnnotations = async () => {
    if (!imageId || !image) return;

    try {
      await client.models.Image.update({
        id: imageId,
        status: 'ANNOTATING',
        updatedAt: new Date().toISOString(),
      });
      setImage((prev) => (prev ? { ...prev, status: 'ANNOTATING' } : null));
      alert('Annotations re-opened for editing');
    } catch (error) {
      console.error('Failed to re-open:', error);
      alert('Failed to re-open annotations');
    }
  };

  // Filter annotations based on status
  const filteredAnnotations =
    statusFilter === 'ALL'
      ? annotations
      : annotations.filter((a) => (a.validationStatus || 'PENDING') === statusFilter);

  // Calculate status counts for display
  const statusCounts = {
    total: annotations.length,
    pending: annotations.filter(
      (a) => !a.validationStatus || a.validationStatus === 'PENDING'
    ).length,
    approved: annotations.filter((a) => a.validationStatus === 'APPROVED').length,
    rejected: annotations.filter((a) => a.validationStatus === 'REJECTED').length,
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (!image) {
    return <div style={{ padding: '2rem' }}>Image not found</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Image Viewer */}
      <div style={{ flex: 1, padding: '1rem', backgroundColor: '#f9fafb' }}>
        <div
          style={{
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            onClick={() => window.history.back()}
            style={{
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
            }}
          >
            ← Back to Gallery
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={generateAnnotations}
              disabled={generating || image.status === 'VALIDATED'}
              style={{
                background:
                  generating || image.status === 'VALIDATED' ? '#9ca3af' : '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '0.5rem 1rem',
                cursor:
                  generating || image.status === 'VALIDATED' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {generating ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '16px',
                      height: '16px',
                      border: '2px solid #fff',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  Generating...
                </>
              ) : (
                <>🤖 Generate AI Annotations</>
              )}
            </button>

            {/* Finalize / Re-open Button */}
            {image.status === 'VALIDATED' ? (
              <button
                onClick={reopenAnnotations}
                style={{
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                }}
              >
                Re-open for Editing
              </button>
            ) : (
              <button
                onClick={finalizeAnnotations}
                disabled={finalizing || annotations.length === 0}
                style={{
                  background:
                    finalizing || annotations.length === 0 ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.5rem 1rem',
                  cursor:
                    finalizing || annotations.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {finalizing ? 'Finalizing...' : 'Finalize Annotations'}
              </button>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', height: 'calc(100vh - 120px)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              marginBottom: '0.5rem',
            }}
          >
            <h2 style={{ margin: 0 }}>{image.fileName}</h2>
            {/* Image Status Badge */}
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontWeight: '600',
                backgroundColor:
                  image.status === 'VALIDATED'
                    ? '#d1fae5'
                    : image.status === 'PROCESSING'
                      ? '#dbeafe'
                      : image.status === 'ANNOTATING'
                        ? '#fef3c7'
                        : '#f3f4f6',
                color:
                  image.status === 'VALIDATED'
                    ? '#065f46'
                    : image.status === 'PROCESSING'
                      ? '#1e40af'
                      : image.status === 'ANNOTATING'
                        ? '#92400e'
                        : '#374151',
              }}
            >
              {image.status || 'UPLOADED'}
            </span>
          </div>
          {imageUrl && (
            <CanvasAnnotator
              imageUrl={imageUrl}
              boundingBoxes={canvasBoxes}
              onBoundingBoxChange={handleCanvasBoxChange}
              selectedBoxId={selectedBoxId}
              onBoxSelect={handleBoxSelect}
            />
          )}
        </div>
      </div>

      {/* Annotation Panel */}
      <div
        style={{
          width: '420px',
          padding: '1rem',
          borderLeft: '1px solid #e5e7eb',
          backgroundColor: 'white',
          overflowY: 'auto',
        }}
      >
        {/* AI Suggestions */}
        {aiSuggestions.length > 0 && (
          <div
            style={{
              marginBottom: '2rem',
              padding: '1rem',
              backgroundColor: '#f5f3ff',
              borderRadius: '8px',
              border: '1px solid #c4b5fd',
            }}
          >
            <h4 style={{ margin: '0 0 1rem 0', color: '#7c3aed' }}>
              🤖 AI Suggestions ({aiSuggestions.length})
            </h4>
            {aiSuggestions.map((suggestion, index) => (
              <div
                key={index}
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  marginBottom: '0.75rem',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                  Q: {suggestion.question}
                </div>
                <div style={{ color: '#374151', marginBottom: '0.5rem' }}>
                  A: {suggestion.answer}
                </div>
                {suggestion.confidence && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Confidence: {Math.round(suggestion.confidence * 100)}%
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => adoptSuggestion(suggestion)}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Adopt
                  </button>
                  <button
                    onClick={() => rejectSuggestion(suggestion)}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Annotation Header with Status Filter */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ margin: 0 }}>
            Annotations ({statusFilter === 'ALL' ? annotations.length : filteredAnnotations.length}
            {statusFilter !== 'ALL' && ` / ${annotations.length}`})
          </h3>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED')
            }
            style={{
              padding: '0.375rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}
          >
            <option value="ALL">All ({statusCounts.total})</option>
            <option value="PENDING">Pending ({statusCounts.pending})</option>
            <option value="APPROVED">Approved ({statusCounts.approved})</option>
            <option value="REJECTED">Rejected ({statusCounts.rejected})</option>
          </select>
        </div>

        {/* Status Summary */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              borderRadius: '4px',
            }}
          >
            Pending: {statusCounts.pending}
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              backgroundColor: '#d1fae5',
              color: '#065f46',
              borderRadius: '4px',
            }}
          >
            Approved: {statusCounts.approved}
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: '4px',
            }}
          >
            Rejected: {statusCounts.rejected}
          </span>
        </div>

        {/* Add New Annotation */}
        <div
          style={{
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
          }}
        >
          <h4>Add Manual Annotation</h4>
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}
            >
              Question:
            </label>
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="What is the total amount?"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}
            >
              Answer:
            </label>
            <input
              type="text"
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="¥1,234"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}
            >
              Language:
            </label>
            <select
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
              }}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={addAnnotation}
            disabled={!newQuestion.trim() || !newAnswer.trim() || !selectedBoxId}
            style={{
              background:
                !newQuestion.trim() || !newAnswer.trim() || !selectedBoxId
                  ? '#9ca3af'
                  : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '0.5rem 1rem',
              cursor:
                !newQuestion.trim() || !newAnswer.trim() || !selectedBoxId
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            Add Annotation
          </button>
          {!selectedBoxId && (
            <div
              style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem' }}
            >
              Draw a bounding box on the image first
            </div>
          )}
        </div>

        {/* Existing Annotations */}
        <div>
          {filteredAnnotations.map((annotation) => (
            <div
              key={annotation.id}
              onClick={() => showAnnotationBox(annotation.id)}
              style={{
                padding: '1rem',
                border:
                  selectedBoxId === annotation.id
                    ? '2px solid #3b82f6'
                    : '1px solid #e5e7eb',
                borderRadius: '8px',
                marginBottom: '1rem',
                backgroundColor:
                  selectedBoxId === annotation.id ? '#eff6ff' : 'white',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.5rem',
                }}
              >
                <div style={{ fontWeight: '500' }}>Q: {annotation.question}</div>
                {annotation.generatedBy === 'AI' && (
                  <span
                    style={{
                      fontSize: '0.625rem',
                      padding: '0.125rem 0.375rem',
                      backgroundColor: '#f5f3ff',
                      color: '#7c3aed',
                      borderRadius: '4px',
                    }}
                  >
                    🤖 AI
                  </span>
                )}
              </div>
              <div style={{ marginBottom: '0.5rem', color: '#374151' }}>
                A: {annotation.answer}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  marginBottom: '0.5rem',
                }}
              >
                Box: [{annotation.boundingBoxes[0].join(', ')}]
              </div>

              {/* Validation Status */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.125rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor:
                      annotation.validationStatus === 'APPROVED'
                        ? '#d1fae5'
                        : annotation.validationStatus === 'REJECTED'
                          ? '#fee2e2'
                          : '#fef3c7',
                    color:
                      annotation.validationStatus === 'APPROVED'
                        ? '#065f46'
                        : annotation.validationStatus === 'REJECTED'
                          ? '#991b1b'
                          : '#92400e',
                  }}
                >
                  {annotation.validationStatus || 'PENDING'}
                </span>
                {annotation.confidence && (
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {Math.round(annotation.confidence * 100)}% conf
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {annotation.validationStatus !== 'APPROVED' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateValidationStatus(annotation.id, 'APPROVED');
                    }}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Approve
                  </button>
                )}
                {annotation.validationStatus !== 'REJECTED' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateValidationStatus(annotation.id, 'REJECTED');
                    }}
                    style={{
                      background: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✗ Reject
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAnnotation(annotation.id);
                  }}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
