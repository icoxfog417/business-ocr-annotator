import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import { getUrl } from 'aws-amplify/storage';
import type { Schema } from '../../amplify/data/resource';
import { CanvasAnnotator } from '../components/CanvasAnnotator';
import type { BoundingBox } from '../types';

const client = generateClient<Schema>();

interface CanvasBoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Annotation {
  id: string;
  question: string;
  answer: string;
  boundingBoxes: BoundingBox[]; // Changed to array
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
        const urlResult = await getUrl({ key: imageData.s3Key });
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
          boundingBoxes: boxes
        };
      });
      setAnnotations(fetchedAnnotations);
      
      // Convert to canvas boxes (use first bounding box for each annotation)
      const boxes = fetchedAnnotations.map(a => ({
        id: a.id,
        x: a.boundingBoxes[0][0],
        y: a.boundingBoxes[0][1],
        width: a.boundingBoxes[0][2] - a.boundingBoxes[0][0],
        height: a.boundingBoxes[0][3] - a.boundingBoxes[0][1]
      }));
      setCanvasBoxes(boxes);
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
      // Convert canvas box to HuggingFace format [x0, y0, x1, y1]
      const bbox: BoundingBox = [
        Math.round(selectedBox.x),
        Math.round(selectedBox.y),
        Math.round(selectedBox.x + selectedBox.width),
        Math.round(selectedBox.y + selectedBox.height)
      ];

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
        const annotation = {
          id: newAnnotation.data.id,
          question: newAnnotation.data.question,
          answer: newAnnotation.data.answer,
          boundingBoxes: typeof newAnnotation.data.boundingBoxes === 'string' 
            ? JSON.parse(newAnnotation.data.boundingBoxes) 
            : newAnnotation.data.boundingBoxes as BoundingBox[]
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
        
        <div style={{ textAlign: 'center' }}>
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
          {annotations.map((annotation) => (
            <div
              key={annotation.id}
              style={{
                padding: '1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                marginBottom: '1rem',
                backgroundColor: 'white'
              }}
            >
              <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>
                Q: {annotation.question}
              </div>
              <div style={{ marginBottom: '0.5rem', color: '#374151' }}>
                A: {annotation.answer}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                Box: [{annotation.boundingBoxes[0].join(', ')}]
              </div>
              <button
                onClick={() => deleteAnnotation(annotation.id)}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
