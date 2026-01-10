import { useState } from 'react';
import { Link } from 'react-router-dom';
import { uploadData } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export function FileUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

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

  const uploadFiles = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    try {
      for (const file of files) {
        const key = `images/${Date.now()}-${file.name}`;
        
        console.log('Uploading file:', file.name, 'to key:', key);
        
        // Upload to S3
        const uploadResult = await uploadData({
          key,
          data: file,
          options: {
            contentType: file.type
          }
        }).result;
        
        console.log('Upload successful:', uploadResult);

        // Get image dimensions
        const img = new Image();
        const dimensions = await new Promise<{width: number, height: number}>((resolve) => {
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.src = URL.createObjectURL(file);
        });

        // Save metadata to DynamoDB with new required fields
        console.log('Saving to database...');
        const dbResult = await client.models.Image.create({
          fileName: file.name,
          s3Key: key,
          width: dimensions.width,
          height: dimensions.height,
          documentType: 'OTHER',
          language: 'en',
          status: 'UPLOADED',
          uploadedBy: 'current-user',
          uploadedAt: new Date().toISOString()
        });
        
        console.log('Database result:', dbResult);
        
        if (dbResult.errors) {
          console.error('Database errors:', dbResult.errors);
          throw new Error(dbResult.errors.map(e => e.message).join(', '));
        }
      }
      
      setFiles([]);
      alert('Files uploaded successfully! You can now view them in the gallery.');
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for details.`);
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
      
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragActive ? '#3b82f6' : '#d1d5db'}`,
          borderRadius: '8px',
          padding: '3rem',
          textAlign: 'center',
          backgroundColor: dragActive ? '#eff6ff' : '#f9fafb',
          cursor: 'pointer',
          marginBottom: '1rem'
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
            Drop images here or click to select
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Supports JPEG, PNG (max 20MB per file)
          </div>
        </label>
      </div>

      {files.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h3>Selected Files ({files.length})</h3>
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

      <button
        onClick={uploadFiles}
        disabled={files.length === 0 || uploading}
        style={{
          background: files.length === 0 || uploading ? '#9ca3af' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          fontWeight: '500',
          cursor: files.length === 0 || uploading ? 'not-allowed' : 'pointer'
        }}
      >
        {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}
