import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUrl } from 'aws-amplify/storage';
import { client } from '../lib/apiClient';
import { listAllItems } from '../lib/paginatedList';
import { getStatusStyle, getProcessingOpacity } from '../lib/statusStyles';
import { MobileNavSpacer } from '../components/layout';

interface ImageWithUrl {
  id: string;
  fileName: string;
  s3KeyOriginal: string;
  s3KeyThumbnail?: string;
  s3KeyCompressed?: string;
  uploadedAt: string;
  status?: string;
  url?: string;
}

export function ImageGallery() {
  const [images, setImages] = useState<ImageWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const data = await listAllItems<{
        id: string;
        fileName: string;
        s3KeyOriginal: string;
        s3KeyThumbnail?: string | null;
        s3KeyCompressed?: string | null;
        uploadedAt: string;
        status?: string | null;
      }>('Image');
      console.log('Fetched images from database:', data);

      const imagesWithUrls = await Promise.all(
        data.map(async (image) => {
          try {
            // Prefer thumbnail for gallery view, fall back to original
            const s3Key = image.s3KeyThumbnail || image.s3KeyOriginal;
            console.log('Getting URL for s3Key:', s3Key);
            const urlResult = await getUrl({ path: s3Key });
            console.log('Generated URL:', urlResult.url.toString());
            return {
              id: image.id,
              fileName: image.fileName,
              s3KeyOriginal: image.s3KeyOriginal,
              s3KeyThumbnail: image.s3KeyThumbnail ?? undefined,
              s3KeyCompressed: image.s3KeyCompressed ?? undefined,
              uploadedAt: image.uploadedAt,
              status: image.status ?? undefined,
              url: urlResult.url.toString()
            };
          } catch (error) {
            console.error('Failed to get URL for image:', image.s3KeyOriginal, error);
            return {
              id: image.id,
              fileName: image.fileName,
              s3KeyOriginal: image.s3KeyOriginal,
              s3KeyThumbnail: image.s3KeyThumbnail ?? undefined,
              s3KeyCompressed: image.s3KeyCompressed ?? undefined,
              uploadedAt: image.uploadedAt,
              status: image.status ?? undefined
            };
          }
        })
      );
      console.log('Images with URLs:', imagesWithUrls);
      // Sort by uploadedAt descending (newest first)
      imagesWithUrls.sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
      setImages(imagesWithUrls);
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteImage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this image and all its annotations?')) return;
    
    try {
      // Delete all annotations for this image first (with pagination)
      const annotations = await listAllItems<{ id: string }>('Annotation', {
        filter: { imageId: { eq: id } },
      });

      // Delete in batches of 25 to avoid API rate limiting
      const BATCH_SIZE = 25;
      for (let i = 0; i < annotations.length; i += BATCH_SIZE) {
        const batch = annotations.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((ann) => client.models.Annotation.delete({ id: ann.id })));
      }
      
      // Then delete the image
      await client.models.Image.delete({ id });
      setImages(prev => prev.filter(img => img.id !== id));
    } catch (error) {
      console.error('Failed to delete image:', error);
      alert('Failed to delete image');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading images...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: window.innerWidth < 768 ? '1rem' : '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link
          to="/"
          style={{
            background: '#6b7280',
            color: 'white',
            textDecoration: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontSize: '0.875rem',
            marginRight: '1rem'
          }}
        >
          ← Back to Dashboard
        </Link>
      </div>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        flexDirection: window.innerWidth < 768 ? 'column' : 'row',
        gap: window.innerWidth < 768 ? '1rem' : '0'
      }}>
        <h1 style={{ margin: 0 }}>Image Gallery ({images.length})</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={fetchImages}
            style={{
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
          <Link
            to="/upload"
            style={{
              background: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '500'
            }}
          >
            Upload Images
          </Link>
        </div>
      </div>

      {images.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <div style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No images uploaded yet</div>
          <div>Upload some images to get started</div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(250px, 100%), 1fr))',
            gap: '1rem'
          }}
        >
          {images.map((image) => (
            <div
              key={image.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: 'white',
                position: 'relative'
              }}
            >
              {image.url ? (
                <img
                  src={image.url}
                  alt={image.fileName}
                  style={{
                    width: '100%',
                    height: '200px',
                    objectFit: 'cover',
                    opacity: getProcessingOpacity(image.status)
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '200px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280'
                  }}
                >
                  No preview
                </div>
              )}
              {image.status === 'PROCESSING' && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: '12px',
                      height: '12px',
                      border: '2px solid #fff',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                  Processing...
                </div>
              )}
              <div style={{ padding: '1rem' }}>
                <div style={{ fontWeight: '500', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  {image.fileName}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  {new Date(image.uploadedAt).toLocaleDateString()}
                </div>
                {image.status && (
                  <div
                    style={{
                      fontSize: '0.625rem',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '4px',
                      display: 'inline-block',
                      marginBottom: '0.5rem',
                      ...getStatusStyle(image.status)
                    }}
                  >
                    {image.status}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
                  <button
                    onClick={() => navigate(`/annotate/${image.id}`)}
                    disabled={image.status === 'PROCESSING'}
                    style={{
                      background: image.status === 'PROCESSING' ? '#9ca3af' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: window.innerWidth < 768 ? '0.75rem 1rem' : '0.5rem 1rem',
                      fontSize: '0.875rem',
                      cursor: image.status === 'PROCESSING' ? 'not-allowed' : 'pointer',
                      flex: 1,
                      minHeight: window.innerWidth < 768 ? '44px' : 'auto'
                    }}
                  >
                    Annotate
                  </button>
                  <button
                    onClick={() => deleteImage(image.id)}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: window.innerWidth < 768 ? '0.75rem 1rem' : '0.5rem 1rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      minHeight: window.innerWidth < 768 ? '44px' : 'auto'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <MobileNavSpacer />
    </div>
  );
}
