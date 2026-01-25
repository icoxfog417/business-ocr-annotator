import React from 'react';

interface AnnotationSummary {
  totalQuestions: number;
  answeredQuestions: number;
  skippedQuestions: number;
  unanswerableQuestions: number;
  boundingBoxesDrawn: number;
  aiAssistedCount: number;
}

interface FinalizeScreenProps {
  summary: AnnotationSummary;
  onUploadNext: () => void;
  onBackToGallery: () => void;
  className?: string;
  language?: string;
}

/**
 * Finalization screen shown after completing all questions.
 * Shows summary and provides navigation options.
 */
export function FinalizeScreen({
  summary,
  onUploadNext,
  onBackToGallery,
  className = '',
  language = 'en',
}: FinalizeScreenProps) {
  const labels = {
    en: {
      title: 'Annotation Complete!',
      questionsAnswered: 'Questions answered',
      questionsSkipped: 'Questions skipped',
      questionsUnanswerable: 'No answer (not on document)',
      boundingBoxes: 'Bounding boxes drawn',
      aiAssisted: 'AI-assisted answers',
      uploadNext: 'Upload Next Image',
      backToGallery: 'Back to Gallery',
      thankYou: 'Thank you for your contribution!',
    },
    ja: {
      title: 'アノテーション完了！',
      questionsAnswered: '回答済みの質問',
      questionsSkipped: 'スキップした質問',
      questionsUnanswerable: '該当なし（書類に記載なし）',
      boundingBoxes: '描画したバウンディングボックス',
      aiAssisted: 'AI支援の回答',
      uploadNext: '次の画像をアップロード',
      backToGallery: 'ギャラリーに戻る',
      thankYou: 'ご協力ありがとうございます！',
    },
    zh: {
      title: '标注完成！',
      questionsAnswered: '已回答的问题',
      questionsSkipped: '跳过的问题',
      questionsUnanswerable: '无答案（文档中没有）',
      boundingBoxes: '绘制的边界框',
      aiAssisted: 'AI辅助的答案',
      uploadNext: '上传下一张图片',
      backToGallery: '返回图库',
      thankYou: '感谢您的贡献！',
    },
    ko: {
      title: '주석 완료!',
      questionsAnswered: '답변한 질문',
      questionsSkipped: '건너뛴 질문',
      questionsUnanswerable: '해당없음 (문서에 없음)',
      boundingBoxes: '그린 바운딩 박스',
      aiAssisted: 'AI 지원 답변',
      uploadNext: '다음 이미지 업로드',
      backToGallery: '갤러리로 돌아가기',
      thankYou: '기여해 주셔서 감사합니다!',
    },
  };

  const t = labels[language as keyof typeof labels] || labels.en;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    textAlign: 'center',
    minHeight: '400px',
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '64px',
    marginBottom: '16px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '8px',
  };

  const thankYouStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '24px',
  };

  const summaryContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginBottom: '32px',
    width: '100%',
    maxWidth: '400px',
  };

  const statCardStyle: React.CSSProperties = {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 700,
    color: '#3b82f6',
    marginBottom: '4px',
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
  };

  const buttonsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    maxWidth: '300px',
  };

  const primaryButtonStyle: React.CSSProperties = {
    padding: '16px 32px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    padding: '12px 24px',
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '48px',
  };

  return (
    <div className={`finalize-screen ${className}`} style={containerStyle}>
      <div style={iconStyle}>✅</div>
      <h2 style={titleStyle}>{t.title}</h2>
      <p style={thankYouStyle}>{t.thankYou}</p>

      <div style={summaryContainerStyle}>
        <div style={statCardStyle}>
          <div style={statValueStyle}>{summary.answeredQuestions}</div>
          <div style={statLabelStyle}>{t.questionsAnswered}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#6b7280' }}>{summary.unanswerableQuestions}</div>
          <div style={statLabelStyle}>{t.questionsUnanswerable}</div>
        </div>
        <div style={statCardStyle}>
          <div style={statValueStyle}>{summary.skippedQuestions}</div>
          <div style={statLabelStyle}>{t.questionsSkipped}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#6366f1' }}>{summary.aiAssistedCount}</div>
          <div style={statLabelStyle}>{t.aiAssisted}</div>
        </div>
      </div>

      <div style={buttonsContainerStyle}>
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={onUploadNext}
        >
          <span>📷</span>
          {t.uploadNext}
        </button>
        <button
          type="button"
          style={secondaryButtonStyle}
          onClick={onBackToGallery}
        >
          {t.backToGallery}
        </button>
      </div>
    </div>
  );
}
