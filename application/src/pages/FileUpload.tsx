import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { uploadData } from 'aws-amplify/storage';
import { client } from '../lib/apiClient';
import { LANGUAGES, DOCUMENT_TYPES, type DocumentTypeCode } from '../lib/constants';
import { ContributorGatedButton } from '../components/consent';
import { QuestionSelector, CameraCapture, type SelectedQuestion } from '../components/upload';
import { MobileNavSpacer } from '../components/layout';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useDefaultQuestions } from '../hooks/useDefaultQuestions';

export function FileUpload() {
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [language, setLanguage] = useState('ja');
  const [documentType, setDocumentType] = useState<DocumentTypeCode>('RECEIPT');
  const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>([]);
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);

  // Load default questions when document type or language changes
  const { defaultQuestions } = useDefaultQuestions(documentType, language);

  // Update selected questions when document type or language changes
  useEffect(() => {
    if (defaultQuestions.length > 0) {
      setSelectedQuestions(
        defaultQuestions.map((q) => ({
          id: q.id,
          text: q.text,
          type: q.type,
          isCustom: false,
        }))
      );
    }
  }, [defaultQuestions]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/') && file.size <= 20 * 1024 * 1024
    );
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        file => file.type.startsWith('image/') && file.size <= 20 * 1024 * 1024
      );
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle camera capture (mobile)
  const handleCameraCapture = (file: File) => {
    setFiles((prev) => [...prev, file]);
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const uploadedImageIds: string[] = [];

    try {
      for (const file of files) {
        // Upload to images/original/ folder for 3-tier storage
        const fileId = `${Date.now()}-${file.name}`;
        const s3KeyOriginal = `images/original/${fileId}`;

        console.log('Uploading file:', file.name, 'to path:', s3KeyOriginal);

        // Upload to S3 original folder
        const uploadResult = await uploadData({
          path: s3KeyOriginal,
          data: file,
          options: {
            contentType: file.type,
          },
        }).result;

        console.log('Upload successful:', uploadResult);

        // Get image dimensions
        const img = new Image();
        const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.src = URL.createObjectURL(file);
        });

        // Save metadata to DynamoDB with 3-tier storage fields
        // Status is PROCESSING until the process-image Lambda completes
        console.log('Saving to database...');
        const dbResult = await client.models.Image.create({
          fileName: file.name,
          s3KeyOriginal: s3KeyOriginal,
          // s3KeyCompressed and s3KeyThumbnail will be set by process-image Lambda
          width: dimensions.width,
          height: dimensions.height,
          originalSize: file.size,
          documentType: documentType,
          language: language,
          status: 'PROCESSING',
          uploadedBy: 'current-user',
          uploadedAt: new Date().toISOString(),
        });

        console.log('Database result:', dbResult);

        if (dbResult.errors) {
          console.error('Database errors:', dbResult.errors);
          throw new Error(dbResult.errors.map((e) => e.message).join(', '));
        }

        if (dbResult.data?.id) {
          uploadedImageIds.push(dbResult.data.id);
        }

        // Note: The process-image Lambda should be triggered automatically
        // via S3 event trigger or can be invoked manually
        // For now, we'll rely on S3 trigger or manual invocation
        console.log('Image uploaded. Compression will be handled by process-image Lambda.');
      }

      setFiles([]);

      // If only one image uploaded, navigate directly to annotation with questions
      if (uploadedImageIds.length === 1) {
        console.log('Navigating with selectedQuestions:', selectedQuestions);
        navigate(`/annotate/${uploadedImageIds[0]}`, {
          state: { questions: selectedQuestions },
        });
      } else {
        // Multiple images: go to gallery
        alert(
          'Files uploaded successfully! Images are being processed. You can view them in the gallery.'
        );
        navigate('/gallery');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert(
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for details.`
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link
          to="/"
          style={{
            background: '#6b7280',
            color: 'white',
            textDecoration: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontSize: '0.875rem'
          }}
        >
          ← Back to Dashboard
        </Link>
      </div>
      
      <h1>Upload Images</h1>

      {/* Mobile Camera Capture */}
      {isMobile && (
        <div style={{ marginBottom: '1.5rem' }}>
          <CameraCapture onCapture={handleCameraCapture} language={language} maxSizeMB={20} />
          <div
            style={{
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '0.875rem',
              marginTop: '1rem',
              marginBottom: '1rem',
            }}
          >
            — or —
          </div>
        </div>
      )}

      {/* Desktop Drag & Drop */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragActive ? '#3b82f6' : '#d1d5db'}`,
          borderRadius: '8px',
          padding: isMobile ? '2rem' : '3rem',
          textAlign: 'center',
          backgroundColor: dragActive ? '#eff6ff' : '#f9fafb',
          cursor: 'pointer',
          marginBottom: '1rem',
        }}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          id="file-input"
        />
        <label htmlFor="file-input" style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '0.5rem' }}>
            {isMobile ? 'Tap to select files' : 'Drop images here or click to select'}
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Supports JPEG, PNG (max 20MB per file)
          </div>
        </label>
      </div>

      {files.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h3>Selected Files ({files.length})</h3>
          
          {/* Language Selection */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Document Language:
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                fontSize: '1rem',
                minWidth: '200px'
              }}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Document Type Selection */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Document Type:
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentTypeCode)}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                fontSize: '1rem',
                minWidth: '200px',
              }}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Question Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={() => setShowQuestionSelector(!showQuestionSelector)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'none',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
                width: '100%',
                justifyContent: 'space-between',
              }}
            >
              <span>
                {language === 'ja' ? '質問を選択' : 'Select Questions'} ({selectedQuestions.length})
              </span>
              <span style={{ transform: showQuestionSelector ? 'rotate(180deg)' : 'none' }}>▼</span>
            </button>

            {showQuestionSelector && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '1rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                }}
              >
                <QuestionSelector
                  documentType={documentType}
                  language={language}
                  selectedQuestions={selectedQuestions}
                  onQuestionsChange={setSelectedQuestions}
                />
              </div>
            )}
          </div>

          {/* File List */}
          {files.map((file, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                marginBottom: '0.5rem'
              }}
            >
              <div>
                <div style={{ fontWeight: '500' }}>{file.name}</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  cursor: 'pointer'
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <ContributorGatedButton
        onClick={uploadFiles}
        disabled={files.length === 0 || uploading}
        language={language}
        style={{
          background: files.length === 0 || uploading ? '#9ca3af' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          fontWeight: '500',
          cursor: files.length === 0 || uploading ? 'not-allowed' : 'pointer',
          minHeight: '48px',
        }}
      >
        {uploading
          ? language === 'ja'
            ? 'アップロード中...'
            : 'Uploading...'
          : language === 'ja'
            ? `${files.length}件のファイルをアップロード`
            : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
      </ContributorGatedButton>

      <MobileNavSpacer />
    </div>
  );
}
