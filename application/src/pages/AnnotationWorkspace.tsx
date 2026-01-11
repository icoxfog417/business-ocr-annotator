import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import { getUrl } from 'aws-amplify/storage';
import type { Schema } from '../../amplify/data/resource';
import { CanvasAnnotator } from '../components/CanvasAnnotator';
import {
  type BoundingBox,
  type CanvasBoundingBox,
  canvasToHuggingFace,
  huggingFaceToCanvas,
} from '../types';

const client = generateClient<Schema>();

type ValidationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Annotation {
  id: string;
  question: string;
  answer: string;
  boundingBoxes: BoundingBox[];
  validationStatus: ValidationStatus;
  queuedForDataset: boolean;
  processedAt?: string;
}

interface ImageData {
  id: string;
  fileName: string;
  s3Key: string;
  uploadedAt: string;
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

  const fetchImageAndAnnotations = useCallback(async () => {
    if (!imageId) return;
    
    try {
      // Fetch image
      const { data: imageData } = await client.models.Image.get({ id: imageId });
      if (imageData) {
        setImage(imageData);
        const urlResult = await getUrl({ path: imageData.s3Key });
        setImageUrl(urlResult.url.toString());
      }

      // Fetch annotations
      const { data: annotationsData } = await client.models.Annotation.list({
        filter: { imageId: { eq: imageId } }
      });
      const fetchedAnnotations = annotationsData.map(a => {
        const boxes = typeof a.boundingBoxes === 'string'
          ? JSON.parse(a.boundingBoxes)
          : a.boundingBoxes as BoundingBox[];
        return {
          id: a.id,
          question: a.question,
          answer: a.answer,
          boundingBoxes: boxes,
          validationStatus: (a.validationStatus || 'PENDING') as ValidationStatus,
          queuedForDataset: a.queuedForDataset || false,
          processedAt: a.processedAt || undefined
        };
      });
      setAnnotations(fetchedAnnotations);
      
      // Don't show existing annotation boxes by default - start with empty canvas
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

  const addAnnotation = async () => {
    console.log('Adding annotation:', { newQuestion, newAnswer, imageId, selectedBoxId, canvasBoxes });
    
    if (!newQuestion.trim() || !newAnswer.trim() || !imageId || !selectedBoxId) {
      console.log('Validation failed:', { 
        hasQuestion: !!newQuestion.trim(), 
        hasAnswer: !!newAnswer.trim(), 
        hasImageId: !!imageId, 
        hasSelectedBox: !!selectedBoxId 
      });
      return;
    }

    const selectedBox = canvasBoxes.find(box => box.id === selectedBoxId);
    console.log('Selected box:', selectedBox);
    
    if (!selectedBox) {
      console.log('No selected box found');
      return;
    }

    try {
      // Convert canvas box to HuggingFace format using utility function
      const bbox = canvasToHuggingFace(selectedBox);

      const newAnnotation = await client.models.Annotation.create({
        imageId,
        question: newQuestion,
        answer: newAnswer,
        language: newLanguage,
        boundingBoxes: JSON.stringify([bbox]),
        questionType: 'EXTRACTIVE',
        validationStatus: 'PENDING',
        createdBy: 'current-user',
        createdAt: new Date().toISOString()
      });

      console.log('Annotation created:', newAnnotation);

      if (newAnnotation.errors) {
        console.error('Annotation errors:', newAnnotation.errors);
        alert('Failed to save annotation: ' + newAnnotation.errors.map(e => e.message).join(', '));
        return;
      }

      if (newAnnotation.data) {
        const annotation: Annotation = {
          id: newAnnotation.data.id,
          question: newAnnotation.data.question,
          answer: newAnnotation.data.answer,
          boundingBoxes: typeof newAnnotation.data.boundingBoxes === 'string'
            ? JSON.parse(newAnnotation.data.boundingBoxes)
            : newAnnotation.data.boundingBoxes as BoundingBox[],
          validationStatus: 'PENDING',
          queuedForDataset: false
        };
        setAnnotations(prev => [...prev, annotation]);
        
        // Update canvas box ID to match annotation ID
        setCanvasBoxes(prev => prev.map(box => 
          box.id === selectedBoxId ? { ...box, id: newAnnotation.data!.id } : box
        ));
        setSelectedBoxId(newAnnotation.data.id);
        
        setNewQuestion('');
        setNewAnswer('');
        alert('Annotation saved!');
      }
    } catch (error) {
      console.error('Failed to create annotation:', error);
      alert('Failed to create annotation: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const deleteAnnotation = async (annotationId: string) => {
    try {
      await client.models.Annotation.delete({ id: annotationId });
      setAnnotations(prev => prev.filter(a => a.id !== annotationId));
      setCanvasBoxes(prev => prev.filter(box => box.id !== annotationId));
      if (selectedBoxId === annotationId) {
        setSelectedBoxId('');
      }
    } catch (error) {
      console.error('Failed to delete annotation:', error);
    }
  };

  const updateValidationStatus = async (annotationId: string, status: ValidationStatus) => {
    try {
      await client.models.Annotation.update({
        id: annotationId,
        validationStatus: status,
        validatedBy: 'current-user',
        validatedAt: new Date().toISOString(),
        updatedBy: 'current-user',
        updatedAt: new Date().toISOString()
      });

      setAnnotations(prev => prev.map(a =>
        a.id === annotationId ? { ...a, validationStatus: status } : a
      ));
    } catch (error) {
      console.error('Failed to update validation status:', error);
      alert('Failed to update validation status');
    }
  };

  const queueForDataset = async (annotationIds: string[]) => {
    if (annotationIds.length === 0) return;

    try {
      // Call the custom mutation to queue annotations
      const response = await client.mutations.queueAnnotationsForDataset({
        annotationIds,
        triggeredBy: 'current-user'
      });

      console.log('Queue result:', response);

      if (response.errors) {
        console.error('Queue errors:', response.errors);
        alert('Failed to queue annotations: ' + response.errors.map(e => e.message).join(', '));
        return;
      }

      if (response.data) {
        const result = response.data;

        if (result.queuedCount > 0) {
          // Update local state
          setAnnotations(prev => prev.map(a =>
            annotationIds.includes(a.id)
              ? { ...a, validationStatus: 'APPROVED' as ValidationStatus, queuedForDataset: true }
              : a
          ));
          alert(`Queued ${result.queuedCount} annotation(s) for dataset build`);
        }

        if (result.failedIds && result.failedIds.length > 0) {
          console.warn('Failed to queue:', result.failedIds);
        }
      }
    } catch (error) {
      console.error('Failed to queue annotations:', error);
      alert('Failed to queue annotations for dataset: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleCanvasBoxChange = (boxes: CanvasBoundingBox[]) => {
    setCanvasBoxes(boxes);
  };

  const handleBoxSelect = (boxId: string) => {
    setSelectedBoxId(boxId);
    const annotation = annotations.find(a => a.id === boxId);
    if (annotation) {
      setNewQuestion(annotation.question);
      setNewAnswer(annotation.answer);
    }
  };

  // Show annotation's bounding box on canvas when clicked from list
  const showAnnotationBox = (annotationId: string) => {
    const annotation = annotations.find(a => a.id === annotationId);
    if (annotation) {
      const box = huggingFaceToCanvas(annotation.boundingBoxes[0], annotation.id);
      // Replace canvas boxes with just this annotation's box
      setCanvasBoxes([box]);
      setSelectedBoxId(annotation.id);
      setNewQuestion(annotation.question);
      setNewAnswer(annotation.answer);
    }
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
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => window.history.back()}
            style={{
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '0.5rem 1rem',
              cursor: 'pointer'
            }}
          >
            ← Back to Gallery
          </button>
        </div>
        
        <div style={{ textAlign: 'center', height: 'calc(100vh - 120px)' }}>
          <h2>{image.fileName}</h2>
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
      <div style={{ width: '400px', padding: '1rem', borderLeft: '1px solid #e5e7eb', backgroundColor: 'white' }}>
        <h3>Annotations ({annotations.length})</h3>
        
        {/* Add New Annotation */}
        <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <h4>Add Annotation</h4>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
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
                borderRadius: '4px'
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
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
                borderRadius: '4px'
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Language:
            </label>
            <select
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
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
              background: (!newQuestion.trim() || !newAnswer.trim() || !selectedBoxId) ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '0.5rem 1rem',
              cursor: (!newQuestion.trim() || !newAnswer.trim() || !selectedBoxId) ? 'not-allowed' : 'pointer'
            }}
          >
            Add Annotation
          </button>
          {!selectedBoxId && (
            <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem' }}>
              Draw a bounding box on the image first
            </div>
          )}
        </div>

        {/* Existing Annotations */}
        <div>
          {annotations.map((annotation) => {
            const statusColors: Record<ValidationStatus, { bg: string; text: string; border: string }> = {
              PENDING: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
              APPROVED: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
              REJECTED: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' }
            };
            const statusStyle = statusColors[annotation.validationStatus];

            return (
              <div
                key={annotation.id}
                onClick={() => showAnnotationBox(annotation.id)}
                style={{
                  padding: '1rem',
                  border: selectedBoxId === annotation.id ? '2px solid #3b82f6' : `1px solid ${statusStyle.border}`,
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  backgroundColor: selectedBoxId === annotation.id ? '#eff6ff' : 'white',
                  cursor: 'pointer'
                }}
              >
                {/* Status Badge */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '0.125rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.625rem',
                    fontWeight: '600',
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.text
                  }}>
                    {annotation.validationStatus}
                  </span>
                  {annotation.queuedForDataset && !annotation.processedAt && (
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.625rem',
                      fontWeight: '600',
                      backgroundColor: '#dbeafe',
                      color: '#1e40af'
                    }}>
                      QUEUED
                    </span>
                  )}
                  {annotation.processedAt && (
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.625rem',
                      fontWeight: '600',
                      backgroundColor: '#e0e7ff',
                      color: '#3730a3'
                    }}>
                      IN DATASET
                    </span>
                  )}
                </div>

                <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>
                  Q: {annotation.question}
                </div>
                <div style={{ marginBottom: '0.5rem', color: '#374151' }}>
                  A: {annotation.answer}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  Box: [{annotation.boundingBoxes[0]?.join(', ') || 'N/A'}]
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {/* Approve/Reject buttons for PENDING status */}
                  {annotation.validationStatus === 'PENDING' && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); updateValidationStatus(annotation.id, 'APPROVED'); }}
                        style={{
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); updateValidationStatus(annotation.id, 'REJECTED'); }}
                        style={{
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {/* Queue for Dataset button for APPROVED status (not yet queued) */}
                  {annotation.validationStatus === 'APPROVED' && !annotation.queuedForDataset && !annotation.processedAt && (
                    <button
                      onClick={(e) => { e.stopPropagation(); queueForDataset([annotation.id]); }}
                      style={{
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Queue for Dataset
                    </button>
                  )}

                  {/* Delete button (always available unless processed) */}
                  {!annotation.processedAt && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAnnotation(annotation.id); }}
                      style={{
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
