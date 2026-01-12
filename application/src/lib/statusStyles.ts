export type ImageStatus = 'UPLOADED' | 'PROCESSING' | 'ANNOTATING' | 'VALIDATED';

export interface StatusStyle {
  backgroundColor: string;
  color: string;
}

export const getStatusStyle = (status?: string): StatusStyle => {
  switch (status) {
    case 'PROCESSING':
      return { backgroundColor: '#fef3c7', color: '#92400e' };
    case 'UPLOADED':
      return { backgroundColor: '#d1fae5', color: '#065f46' };
    case 'ANNOTATING':
      return { backgroundColor: '#dbeafe', color: '#1e40af' };
    case 'VALIDATED':
      return { backgroundColor: '#d1fae5', color: '#065f46' };
    default:
      return { backgroundColor: '#f3f4f6', color: '#374151' };
  }
};

export const getProcessingOpacity = (status?: string): number => {
  return status === 'PROCESSING' ? 0.6 : 1;
};
