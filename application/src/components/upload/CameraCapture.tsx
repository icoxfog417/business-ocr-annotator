import React, { useRef, useState, useCallback } from 'react';

interface CameraCaptureProps {
  onCapture: (file: File, preview: string) => void;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  language?: string;
}

/**
 * Mobile camera capture component using HTML5 input.
 * Provides "Take Photo" and "Choose from Gallery" options.
 */
export function CameraCapture({
  onCapture,
  accept = 'image/*',
  maxSizeMB = 20,
  className = '',
  language = 'en',
}: CameraCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const labels = {
    en: {
      takePhoto: 'Take Photo',
      chooseFromGallery: 'Choose from Gallery',
      retake: 'Retake',
      usePhoto: 'Use This Photo',
      fileTooLarge: `File size exceeds ${maxSizeMB}MB limit`,
      invalidFile: 'Please select a valid image file',
    },
    ja: {
      takePhoto: '写真を撮る',
      chooseFromGallery: 'ギャラリーから選択',
      retake: '撮り直す',
      usePhoto: 'この写真を使用',
      fileTooLarge: `ファイルサイズが${maxSizeMB}MBを超えています`,
      invalidFile: '有効な画像ファイルを選択してください',
    },
    zh: {
      takePhoto: '拍照',
      chooseFromGallery: '从相册选择',
      retake: '重拍',
      usePhoto: '使用这张照片',
      fileTooLarge: `文件大小超过${maxSizeMB}MB限制`,
      invalidFile: '请选择有效的图片文件',
    },
    ko: {
      takePhoto: '사진 촬영',
      chooseFromGallery: '갤러리에서 선택',
      retake: '다시 촬영',
      usePhoto: '이 사진 사용',
      fileTooLarge: `파일 크기가 ${maxSizeMB}MB를 초과합니다`,
      invalidFile: '유효한 이미지 파일을 선택하세요',
    },
  };

  const t = labels[language as keyof typeof labels] || labels.en;

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setError(null);

      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError(t.invalidFile);
        return;
      }

      // Validate file size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        setError(t.fileTooLarge);
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewUrl = e.target?.result as string;
        setPreview(previewUrl);
        setSelectedFile(file);
      };
      reader.readAsDataURL(file);

      // Reset input for re-selection
      event.target.value = '';
    },
    [maxSizeMB, t]
  );

  const handleConfirm = useCallback(() => {
    if (selectedFile && preview) {
      onCapture(selectedFile, preview);
      setPreview(null);
      setSelectedFile(null);
    }
  }, [selectedFile, preview, onCapture]);

  const handleRetake = useCallback(() => {
    setPreview(null);
    setSelectedFile(null);
    setError(null);
  }, []);

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };

  const captureButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px 24px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '56px',
    transition: 'all 0.2s ease',
  };

  const galleryButtonStyle: React.CSSProperties = {
    ...captureButtonStyle,
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '2px solid #e5e7eb',
  };

  const previewContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    alignItems: 'center',
  };

  const previewImageStyle: React.CSSProperties = {
    maxWidth: '100%',
    maxHeight: '300px',
    borderRadius: '12px',
    objectFit: 'contain',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  };

  const previewActionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    width: '100%',
  };

  const retakeButtonStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
  };

  const useButtonStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
  };

  const errorStyle: React.CSSProperties = {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '14px',
    textAlign: 'center',
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '24px',
  };

  // Show preview if image is selected
  if (preview) {
    return (
      <div className={`camera-capture ${className}`} style={containerStyle}>
        <div style={previewContainerStyle}>
          <img src={preview} alt="Preview" style={previewImageStyle} />
          <div style={previewActionsStyle}>
            <button type="button" style={retakeButtonStyle} onClick={handleRetake}>
              {t.retake}
            </button>
            <button type="button" style={useButtonStyle} onClick={handleConfirm}>
              {t.usePhoto}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`camera-capture ${className}`} style={containerStyle}>
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={accept}
        capture="environment"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Error message */}
      {error && <div style={errorStyle}>{error}</div>}

      {/* Capture buttons */}
      <div style={buttonContainerStyle}>
        <button
          type="button"
          style={captureButtonStyle}
          onClick={() => cameraInputRef.current?.click()}
        >
          <span style={iconStyle}>📷</span>
          {t.takePhoto}
        </button>

        <button
          type="button"
          style={galleryButtonStyle}
          onClick={() => galleryInputRef.current?.click()}
        >
          <span style={iconStyle}>🖼️</span>
          {t.chooseFromGallery}
        </button>
      </div>
    </div>
  );
}
