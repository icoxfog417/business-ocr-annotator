import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getUrl, downloadData } from 'aws-amplify/storage';
import { client } from '../lib/apiClient';
import { AnnotationFlow, type AnnotationAnswer } from '../components/annotation';
import type { SelectedQuestion } from '../components/upload/QuestionSelector';
import { useDefaultQuestions } from '../hooks/useDefaultQuestions';
import { useBreakpoint } from '../hooks/useBreakpoint';
import type { BoundingBox, AIAnnotationResult } from '../types';

interface Annotation {
  id: string;
  question: string;
  answer: string;
  boundingBoxes: BoundingBox[];
  aiAssisted?: boolean;
}

interface ImageData {
  id: string;
  fileName: string;
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

export function AnnotationWorkspace() {
  const { imageId } = useParams<{ imageId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useBreakpoint();

  // Get questions passed from upload flow
  const passedQuestions = (location.state as { questions?: SelectedQuestion[] })?.questions;

  const [image, setImage] = useState<ImageData | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);

  // Load default questions based on image metadata
  const { defaultQuestions, optionalQuestions } = useDefaultQuestions(
    image?.documentType || 'OTHER',
    image?.language || 'ja'
  );

  const fetchImageAndAnnotations = useCallback(async () => {
    if (!imageId) {
      setLoading(false);
      return;
    }

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

        // Get image URL
        const imageKey = imageData.s3KeyCompressed || imageData.s3KeyOriginal;
        try {
          const urlResult = await getUrl({ path: imageKey });
          setImageUrl(urlResult.url.toString());
        } catch {
          // Fallback to original
          if (imageData.s3KeyCompressed) {
            const originalUrl = await getUrl({ path: imageData.s3KeyOriginal });
            setImageUrl(originalUrl.url.toString());
          }
        }
      }

      // Fetch existing annotations
      const { data: annotationsData } = await client.models.Annotation.list({
        filter: { imageId: { eq: imageId } },
      });

      const sortedAnnotations = [...annotationsData].sort(
        (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')
      );

      setAnnotations(
        sortedAnnotations.map((a) => ({
          id: a.id,
          question: a.question,
          answer: a.answer,
          boundingBoxes:
            typeof a.boundingBoxes === 'string'
              ? JSON.parse(a.boundingBoxes)
              : (a.boundingBoxes as BoundingBox[]),
          aiAssisted: a.aiAssisted ?? undefined,
        }))
      );
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [imageId]);

  useEffect(() => {
    fetchImageAndAnnotations();
  }, [fetchImageAndAnnotations]);

  // Build questions list: passed > existing annotations > default questions
  const questions: SelectedQuestion[] = (() => {
    // Priority 1: Questions passed from upload flow
    if (passedQuestions && passedQuestions.length > 0) {
      return passedQuestions;
    }

    // Priority 2: Existing annotations (editing mode from gallery)
    if (annotations.length > 0) {
      return annotations.map((ann) => ({
        id: ann.id,
        text: ann.question,
        type: 'EXTRACTIVE',
        isCustom: false,
      }));
    }

    // Priority 3: Default questions based on document type (only if image is loaded)
    if (image && defaultQuestions.length > 0) {
      return [...defaultQuestions, ...optionalQuestions].map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        isCustom: false,
      }));
    }

    // Fallback: Generic question (only when nothing else available)
    return [
      { id: 'fallback-1', text: 'What is the main content?', type: 'EXTRACTIVE', isCustom: false },
    ];
  })();

  // Save annotations on complete
  const handleComplete = async (answers: AnnotationAnswer[]) => {
    if (!imageId || !image) return;

    for (const answer of answers) {
      if (answer.skipped || !answer.boundingBox) continue;

      const bbox = [
        answer.boundingBox.x,
        answer.boundingBox.y,
        answer.boundingBox.x + answer.boundingBox.width,
        answer.boundingBox.y + answer.boundingBox.height,
      ];

      // Check if updating existing annotation by ID (from gallery edit flow)
      const existingById = annotations.find((a) => a.id === answer.questionId);

      if (existingById) {
        // Update existing annotation
        await client.models.Annotation.update({
          id: existingById.id,
          answer: answer.answer,
          boundingBoxes: JSON.stringify([bbox]),
          aiAssisted: answer.aiAssisted,
          aiModelId: answer.aiModelId,
          aiModelProvider: answer.aiModelProvider,
          aiExtractionTimestamp: answer.aiExtractionTimestamp,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create new annotation
        await client.models.Annotation.create({
          imageId,
          question: answer.question,
          answer: answer.answer,
          language: image.language,
          boundingBoxes: JSON.stringify([bbox]),
          questionType: 'EXTRACTIVE',
          validationStatus: 'PENDING',
          generatedBy: answer.aiAssisted ? 'AI' : 'HUMAN',
          aiAssisted: answer.aiAssisted,
          aiModelId: answer.aiModelId,
          aiModelProvider: answer.aiModelProvider,
          aiExtractionTimestamp: answer.aiExtractionTimestamp,
          confidence: answer.confidence,
          createdBy: 'current-user',
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Update image status
    await client.models.Image.update({
      id: imageId,
      status: 'ANNOTATING',
      updatedAt: new Date().toISOString(),
    });
  };

  // Read text from bounding box using AI
  const handleReadText = async (
    box: { x: number; y: number; width: number; height: number },
    question: string
  ) => {
    if (!image) throw new Error('Image not loaded');

    const imageKey = image.s3KeyCompressed || image.s3KeyOriginal;
    const { body } = await downloadData({ path: imageKey }).result;
    const blob = await body.blob();

    // Crop and encode image region
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    const img = new Image();
    const blobUrl = URL.createObjectURL(blob);

    const { base64, width: cropWidth, height: cropHeight } = await new Promise<{
      base64: string;
      width: number;
      height: number;
    }>((resolve, reject) => {
      img.onload = () => {
        URL.revokeObjectURL(blobUrl);

        const scaleX = img.width / image.width;
        const scaleY = img.height / image.height;

        const cropX = Math.max(0, Math.floor(box.x * scaleX));
        const cropY = Math.max(0, Math.floor(box.y * scaleY));
        const w = Math.max(1, Math.floor(box.width * scaleX));
        const h = Math.max(1, Math.floor(box.height * scaleY));

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, cropX, cropY, w, h, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve({ base64: dataUrl.split(',')[1], width: w, height: h });
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Failed to load image'));
      };
      img.src = blobUrl;
    });

    const result = await client.queries.generateAnnotation({
      imageId: imageId!,
      imageBase64: base64,
      imageFormat: 'jpeg',
      language: image.language,
      documentType: image.documentType || 'OTHER',
      width: cropWidth,
      height: cropHeight,
      question: question,
    });

    if (result.errors?.length) {
      throw new Error(result.errors[0].message);
    }

    let data = result.data as
      | { success?: boolean; annotations?: AIAnnotationResult[]; error?: string }
      | string
      | null;

    if (data === null) {
      return { text: 'Sample extracted text', modelId: 'fallback', confidence: 0.5 };
    }

    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    if (data && typeof data === 'object' && data.success && data.annotations?.length) {
      return {
        text: data.annotations[0].answer,
        modelId: 'anthropic.claude-3-5-sonnet',
        confidence: data.annotations[0].confidence,
      };
    }

    throw new Error((data as { error?: string })?.error || 'AI extraction failed');
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!image || !imageUrl) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>Image not found</h2>
        <button onClick={() => navigate('/gallery')}>Back to Gallery</button>
      </div>
    );
  }

  return (
    <div
      style={{
        height: isMobile ? 'calc(100vh - 60px - env(safe-area-inset-bottom, 0px))' : '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AnnotationFlow
        imageId={imageId}
        imageSrc={imageUrl}
        imageWidth={image.width}
        imageHeight={image.height}
        questions={questions}
        existingAnnotations={annotations}
        language={image.language}
        onComplete={handleComplete}
        onReadText={handleReadText}
        onUploadNext={() => navigate('/upload')}
        onBackToGallery={() => navigate('/gallery')}
      />
    </div>
  );
}
