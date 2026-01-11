import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import { getUrl, downloadData } from 'aws-amplify/storage';
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
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [defaultQuestions, setDefaultQuestions] = useState<string[]>([]);

  // Debug: Show imageId immediately
  console.log('AnnotationWorkspace rendered with imageId:', imageId);

  const getFallbackQuestions = useCallback((documentType: string, language: string): string[] => {
    const questions: Record<string, Record<string, string[]>> = {
      RECEIPT: {
        ja: ['店名は何ですか？', '合計金額はいくらですか？', '日付はいつですか？'],
        en: ['What is the store name?', 'What is the total amount?', 'What is the date?'],
        zh: ['店名是什么？', '总金额是多少？', '日期是什么时候？'],
        ko: ['상점 이름은 무엇입니까?', '총 금액은 얼마입니까?', '날짜는 언제입니까?'],
      },
      INVOICE: {
        ja: ['請求書番号は何ですか？', '請求金額はいくらですか？', '支払期限はいつですか？'],
        en: ['What is the invoice number?', 'What is the invoice amount?', 'When is the due date?'],
        zh: ['发票号码是什么？', '发票金额是多少？', '到期日是什么时候？'],
        ko: ['송장 번호는 무엇입니까?', '송장 금액은 얼마입니까?', '만료일은 언제입니까?'],
      },
    };
    return questions[documentType]?.[language] || questions.RECEIPT[language] || questions.RECEIPT.en;
  }, []);

  const fetchImageAndAnnotations = useCallback(async () => {
    if (!imageId) {
      console.error('No imageId provided');
      setLoading(false);
      return;
    }

    console.log('Fetching image and annotations for:', imageId);
    try {
      const { data: imageData, errors: imageErrors } = await client.models.Image.get({ id: imageId });
      
      if (imageErrors) {
        console.error('Image fetch errors:', imageErrors);
      }
      
      if (imageData) {
        console.log('Image data loaded:', imageData.fileName);
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
        try {
          const urlResult = await getUrl({ path: imageKey });
          setImageUrl(urlResult.url.toString());
        } catch (urlError) {
          console.error('Failed to get image URL:', urlError);
          // Try with original key if compressed fails
          if (imageData.s3KeyCompressed && imageKey === imageData.s3KeyCompressed) {
            try {
              const originalUrlResult = await getUrl({ path: imageData.s3KeyOriginal });
              setImageUrl(originalUrlResult.url.toString());
            } catch (originalError) {
              console.error('Failed to get original image URL:', originalError);
            }
          }
        }
      } else {
        console.error('Image not found:', imageId);
        return;
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
      
      // Convert all annotation bounding boxes to canvas format
      const allCanvasBoxes: CanvasBoundingBox[] = [];
      fetchedAnnotations.forEach((annotation) => {
        annotation.boundingBoxes.forEach((bbox, index) => {
          allCanvasBoxes.push(huggingFaceToCanvas(bbox, `${annotation.id}-${index}`));
        });
      });
      setCanvasBoxes(allCanvasBoxes);
      
      // Load default questions inline (non-blocking)
      if (imageData) {
        const docType = imageData.documentType || 'OTHER';
        const lang = imageData.language;
        client.models.DefaultQuestion.list({
          filter: {
            documentType: { eq: docType as 'RECEIPT' | 'INVOICE' | 'ORDER_FORM' | 'TAX_FORM' | 'CONTRACT' | 'APPLICATION_FORM' | 'OTHER' },
            language: { eq: lang },
          },
        }).then(({ data }) => {
          const questions = data
            .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
            .map(q => q.questionText);
          setDefaultQuestions(questions.length > 0 ? questions : getFallbackQuestions(docType, lang));
        }).catch(() => {
          setDefaultQuestions(getFallbackQuestions(docType, lang));
        });
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [imageId, getFallbackQuestions]);

  useEffect(() => {
    fetchImageAndAnnotations();
  }, [fetchImageAndAnnotations]);

  const getAIAnswer = async () => {
    if (!image || !imageId || !newQuestion.trim()) return;

    setGenerating(true);

    try {
      // Download image using Amplify Storage (avoids CORS issues)
      const imageKey = image.s3KeyCompressed || image.s3KeyOriginal;
      const { body } = await downloadData({ path: imageKey }).result;
      const blob = await body.blob();
      
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:image/...;base64, prefix
        };
        reader.readAsDataURL(blob);
      });

      // Determine image format from blob type or file extension
      const formatMap: Record<string, string> = {
        'image/jpeg': 'jpeg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
      };
      const imageFormat = formatMap[blob.type] || 'jpeg';

      // Call Lambda via GraphQL custom query
      const result = await client.queries.generateAnnotation({
        imageId,
        imageBase64: base64,
        imageFormat,
        language: image.language,
        documentType: image.documentType || 'OTHER',
        width: image.width,
        height: image.height,
        question: newQuestion,
      });

      console.log('GraphQL result:', result);
      
      // Parse JSON if returned as string
      let data = result.data as { success?: boolean; annotations?: AIAnnotationResult[]; error?: string } | string | null;
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      
      if (data && typeof data === 'object' && data.success && data.annotations?.length) {
        const annotation = data.annotations[0];
        setNewAnswer(annotation.answer);
        if (annotation.boundingBox) {
          const boxId = editingAnnotationId || `ai-${Date.now()}`;
          const canvasBox = huggingFaceToCanvas(annotation.boundingBox, boxId);
          setCanvasBoxes((prev) => {
            // Remove any existing box with same ID or previous AI boxes
            const filtered = prev.filter(
              (b) => b.id !== boxId && !b.id.startsWith('ai-')
            );
            return [...filtered, canvasBox];
          });
          setSelectedBoxId(boxId);
        }
      } else {
        const errorMsg = (data && typeof data === 'object') ? data.error : 'Unknown error';
        alert('AI could not generate answer: ' + (errorMsg || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to get AI answer:', error);
      alert('Failed to call AI. Check console for details.');
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
        
        // Add to canvas boxes
        annotation.boundingBoxes.forEach((bbox, index) => {
          const canvasBox = huggingFaceToCanvas(bbox, `${annotation.id}-${index}`);
          setCanvasBoxes((prev) => [...prev, canvasBox]);
        });
        
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

        // Remove the temporary box (AI or manually drawn) after saving
        setCanvasBoxes((prev) => prev.filter((box) => box.id !== selectedBoxId));

        // Clear form for next annotation
        setNewQuestion('');
        setNewAnswer('');
        setSelectedBoxId('');
      }
    } catch (error) {
      console.error('Failed to create annotation:', error);
      alert(
        'Failed to create annotation: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  };

  const updateAnnotation = async () => {
    if (!editingAnnotationId || !newQuestion.trim() || !newAnswer.trim()) return;

    const selectedBox = canvasBoxes.find((box) => box.id === editingAnnotationId);
    if (!selectedBox) return;

    try {
      const bbox = canvasToHuggingFace(selectedBox);

      await client.models.Annotation.update({
        id: editingAnnotationId,
        question: newQuestion,
        answer: newAnswer,
        boundingBoxes: JSON.stringify([bbox]),
        updatedAt: new Date().toISOString(),
      });

      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === editingAnnotationId
            ? { ...a, question: newQuestion, answer: newAnswer, boundingBoxes: [bbox] }
            : a
        )
      );

      // Remove the editing box from canvas and clear form
      setCanvasBoxes((prev) => prev.filter((box) => box.id !== editingAnnotationId));
      setNewQuestion('');
      setNewAnswer('');
      setSelectedBoxId('');
      setEditingAnnotationId(null);
    } catch (error) {
      console.error('Failed to update annotation:', error);
      alert('Failed to update annotation');
    }
  };

  const cancelEdit = () => {
    // Remove the editing box from canvas
    if (editingAnnotationId) {
      setCanvasBoxes((prev) => prev.filter((box) => box.id !== editingAnnotationId));
    }
    setNewQuestion('');
    setNewAnswer('');
    setSelectedBoxId('');
    setEditingAnnotationId(null);
  };

  const deleteAnnotation = async (annotationId: string) => {
    try {
      await client.models.Annotation.delete({ id: annotationId });
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
      // Remove any box associated with this annotation
      setCanvasBoxes((prev) => prev.filter((box) => box.id !== annotationId));
      // Clear form if we were editing this annotation
      if (editingAnnotationId === annotationId) {
        setNewQuestion('');
        setNewAnswer('');
        setSelectedBoxId('');
        setEditingAnnotationId(null);
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
      setCanvasBoxes((prev) => {
        // Keep existing boxes but ensure this one is included
        const others = prev.filter((b) => b.id !== annotation.id);
        return [...others, box];
      });
      setSelectedBoxId(annotation.id);
      setNewQuestion(annotation.question);
      setNewAnswer(annotation.answer);
      setEditingAnnotationId(annotation.id);
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
    return (
      <div style={{ padding: '2rem' }}>
        <p>Loading image: {imageId}</p>
        <p>Loading...</p>
      </div>
    );
  }

  if (!image) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>Image not found</h2>
        <p>The image with ID {imageId} could not be loaded.</p>
        <button onClick={() => window.history.back()}>Go Back</button>
      </div>
    );
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

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Status indicator */}
            {image.status === 'VALIDATED' && (
              <span style={{ fontSize: '0.875rem', color: '#065f46' }}>
                ✓ Finalized
              </span>
            )}
            {/* Finalize Button - always available */}
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
              {finalizing ? 'Finalizing...' : image.status === 'VALIDATED' ? 'Re-finalize' : 'Finalize Annotations'}
            </button>
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

        {/* Default Questions */}
        {defaultQuestions.length > 0 && (
          <div
            style={{
              marginBottom: '2rem',
              padding: '1rem',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #0ea5e9',
            }}
          >
            <h4 style={{ color: '#0369a1', marginBottom: '1rem' }}>
              📋 Default Questions for {image?.documentType || 'Document'}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {defaultQuestions.map((question, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    border: '1px solid #e0f2fe',
                  }}
                >
                  <span style={{ fontSize: '0.875rem' }}>{question}</span>
                  <button
                    onClick={() => setNewQuestion(question)}
                    style={{
                      background: '#0ea5e9',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    Use Question
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="¥1,234"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                }}
              />
              <button
                onClick={getAIAnswer}
                disabled={!newQuestion.trim() || generating}
                style={{
                  background: !newQuestion.trim() || generating ? '#9ca3af' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.5rem 0.75rem',
                  cursor: !newQuestion.trim() || generating ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {generating ? '...' : '🤖 Get AI Answer'}
              </button>
            </div>
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {editingAnnotationId ? (
              <>
                <button
                  onClick={updateAnnotation}
                  disabled={!newQuestion.trim() || !newAnswer.trim()}
                  style={{
                    background:
                      !newQuestion.trim() || !newAnswer.trim() ? '#9ca3af' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.5rem 1rem',
                    cursor:
                      !newQuestion.trim() || !newAnswer.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  Update Annotation
                </button>
                <button
                  onClick={cancelEdit}
                  style={{
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.5rem 1rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
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
            )}
          </div>
          {!selectedBoxId && !editingAnnotationId && (
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

              {/* Confidence */}
              {annotation.confidence && (
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  {Math.round(annotation.confidence * 100)}% confidence
                </div>
              )}

              {/* Action Buttons - Only Delete, click to edit */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Click to edit
                </span>
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
