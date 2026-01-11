import { useState, useEffect } from 'react';
import { signOut } from 'aws-amplify/auth';
import { Link } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface Stats {
  images: number;
  annotations: number;
  datasets: number;
  aiAnnotations: number;
  humanAnnotations: number;
  approvedAnnotations: number;
  pendingAnnotations: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    images: 0,
    annotations: 0,
    datasets: 0,
    aiAnnotations: 0,
    humanAnnotations: 0,
    approvedAnnotations: 0,
    pendingAnnotations: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [imagesResult, annotationsResult] = await Promise.all([
          client.models.Image.list(),
          client.models.Annotation.list(),
        ]);

        const annotations = annotationsResult.data;
        const aiAnnotations = annotations.filter((a) => a.generatedBy === 'AI').length;
        const humanAnnotations = annotations.filter((a) => a.generatedBy === 'HUMAN').length;
        const approvedAnnotations = annotations.filter(
          (a) => a.validationStatus === 'APPROVED'
        ).length;
        const pendingAnnotations = annotations.filter(
          (a) => a.validationStatus === 'PENDING' || !a.validationStatus
        ).length;

        setStats({
          images: imagesResult.data.length,
          annotations: annotations.length,
          datasets: 0,
          aiAnnotations,
          humanAnnotations,
          approvedAnnotations,
          pendingAnnotations,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    fetchStats();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header
        style={{
          background: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '1.25rem 2rem',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M7 7h10" />
                <path d="M7 12h10" />
                <path d="M7 17h7" />
              </svg>
            </div>
            <h1 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0f172a', margin: 0 }}>
              Business OCR Annotator
            </h1>
          </div>

          <button
            onClick={handleSignOut}
            style={{
              padding: '0.5rem 1.25rem',
              background: 'white',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2.5rem 2rem' }}>
        {/* Welcome Section */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.5rem',
            }}
          >
            Welcome back
          </h2>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>
            Manage your OCR annotation projects and datasets
          </p>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem',
            marginBottom: '2.5rem',
          }}
        >
          <Link
            to="/upload"
            style={{
              textDecoration: 'none',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = '#3b82f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0f172a', margin: 0 }}>
                Upload Images
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                Add new business documents
              </p>
            </div>
          </Link>

          <Link
            to="/gallery"
            style={{
              textDecoration: 'none',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = '#6366f1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                background: 'rgba(99, 102, 241, 0.1)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0f172a', margin: 0 }}>
                Image Gallery
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                View and manage images
              </p>
            </div>
          </Link>
        </div>

        {/* Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2.5rem',
          }}
        >
          {/* Images Card */}
          <div
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.75rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = '#3b82f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>
                Total Images
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#0f172a' }}>{stats.images}</div>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {stats.images === 0 ? 'No images uploaded yet' : 'Images in database'}
            </p>
          </div>

          {/* Annotations Card */}
          <div
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.75rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = '#6366f1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>
                Annotations
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#0f172a' }}>{stats.annotations}</div>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {stats.annotations === 0 ? 'Ready to annotate' : 'Annotations created'}
            </p>
          </div>

          {/* Datasets Card */}
          <div
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.75rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = '#22c55e';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>
                Datasets
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#0f172a' }}>{stats.datasets}</div>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Coming in Sprint 3
            </p>
          </div>
        </div>

        {/* AI Annotation Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2.5rem',
          }}
        >
          {/* AI Annotations */}
          <div
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              borderRadius: '12px',
              padding: '1.5rem',
              color: 'white',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🤖</span>
              <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>AI Generated</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700' }}>{stats.aiAnnotations}</div>
          </div>

          {/* Human Annotations */}
          <div
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)',
              borderRadius: '12px',
              padding: '1.5rem',
              color: 'white',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>✍️</span>
              <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Human Created</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700' }}>{stats.humanAnnotations}</div>
          </div>

          {/* Approved */}
          <div
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '12px',
              padding: '1.5rem',
              color: 'white',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>✓</span>
              <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Approved</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700' }}>{stats.approvedAnnotations}</div>
          </div>

          {/* Pending */}
          <div
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              borderRadius: '12px',
              padding: '1.5rem',
              color: 'white',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⏳</span>
              <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Pending Review</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700' }}>{stats.pendingAnnotations}</div>
          </div>
        </div>

        {/* Status Card */}
        <div
          style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                background: 'rgba(34, 197, 94, 0.1)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#0f172a',
                  marginBottom: '0.75rem',
                }}
              >
                Sprint 0 Complete
              </h3>
              <p style={{ color: '#64748b', lineHeight: '1.7', marginBottom: '1.25rem' }}>
                Foundation successfully deployed. The platform is ready for core features.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '4px',
                      height: '4px',
                      background: '#3b82f6',
                      borderRadius: '50%',
                    }}
                  />
                  <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    Image upload & management
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '4px',
                      height: '4px',
                      background: '#3b82f6',
                      borderRadius: '50%',
                    }}
                  />
                  <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    Manual annotation tools
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '4px',
                      height: '4px',
                      background: '#3b82f6',
                      borderRadius: '50%',
                    }}
                  />
                  <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    AI-powered annotation
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '4px',
                      height: '4px',
                      background: '#3b82f6',
                      borderRadius: '50%',
                    }}
                  />
                  <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    Dataset export
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
