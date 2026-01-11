import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

// W&B project configuration
const WANDB_PROJECT = 'business-ocr-sandbox'; // Use 'biz-doc-vqa' for production
const WANDB_ENTITY = 'your-entity'; // TODO: Get from environment

interface DatasetBuildJobData {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt?: string;
  completedAt?: string;
  annotationCount?: number;
  wandbRunUrl?: string;
  wandbArtifactVersion?: string;
  errorMessage?: string;
  triggeredBy: string;
  triggerType: 'SCHEDULED' | 'MANUAL';
}

interface QueueStatsData {
  pendingAnnotations: number;
  totalProcessed: number;
  lastDatasetBuild?: string;
  lastDatasetBuildJobId?: string;
  nextScheduledBuild?: string;
}

export function DatasetStatus() {
  const [jobs, setJobs] = useState<DatasetBuildJobData[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch recent jobs
      const jobsResult = await client.models.DatasetBuildJob.list({
        limit: 10
      });

      // Sort by startedAt descending
      const sortedJobs = (jobsResult.data as DatasetBuildJobData[]).sort((a, b) => {
        const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return dateB - dateA;
      });
      setJobs(sortedJobs);

      // Fetch queue stats
      const statsResult = await client.models.QueueStats.list({
        filter: { statsId: { eq: 'global' } }
      });

      if (statsResult.data.length > 0) {
        setQueueStats(statsResult.data[0] as QueueStatsData);
      } else {
        setQueueStats({
          pendingAnnotations: 0,
          totalProcessed: 0
        });
      }

      setError(null);
    } catch (err) {
      console.error('Failed to fetch dataset status:', err);
      setError('Failed to load dataset status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Poll every 30 seconds for status updates
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const triggerManualBuild = async () => {
    setTriggerLoading(true);
    try {
      // Create a new job record with QUEUED status
      await client.models.DatasetBuildJob.create({
        status: 'QUEUED',
        triggeredBy: 'manual-user',
        triggerType: 'MANUAL'
      });

      // Refresh the job list
      await fetchData();
    } catch (err) {
      console.error('Failed to trigger manual build:', err);
      setError('Failed to trigger manual build');
    } finally {
      setTriggerLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; text: string }> = {
      QUEUED: { bg: 'rgba(234, 179, 8, 0.1)', color: '#b45309', text: 'Queued' },
      RUNNING: { bg: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8', text: 'Running' },
      COMPLETED: { bg: 'rgba(34, 197, 94, 0.1)', color: '#15803d', text: 'Completed' },
      FAILED: { bg: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c', text: 'Failed' }
    };
    const style = styles[status] || styles.QUEUED;

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.25rem 0.75rem',
          background: style.bg,
          color: style.color,
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: '600',
          textTransform: 'uppercase'
        }}
      >
        {status === 'RUNNING' && (
          <span
            style={{
              width: '6px',
              height: '6px',
              background: style.color,
              borderRadius: '50%',
              marginRight: '6px',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}
          />
        )}
        {style.text}
      </span>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p style={{ color: '#64748b' }}>Loading dataset status...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '1.25rem 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M7 7h10" />
                  <path d="M7 12h10" />
                  <path d="M7 17h7" />
                </svg>
              </div>
              <h1 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0f172a', margin: 0 }}>
                Dataset Status
              </h1>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              to="/"
              style={{
                padding: '0.5rem 1rem',
                background: 'white',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                textDecoration: 'none'
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2.5rem 2rem' }}>
        {/* Page Title */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
            W&B Dataset Status
          </h2>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>
            Monitor dataset builds and queue processing for Weights & Biases integration
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            color: '#b91c1c'
          }}>
            {error}
          </div>
        )}

        {/* Queue Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {/* Pending Annotations */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>Pending</span>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'rgba(234, 179, 8, 0.1)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0f172a' }}>
              {queueStats?.pendingAnnotations ?? 0}
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              annotations in queue
            </p>
          </div>

          {/* Total Processed */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>Processed</span>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'rgba(34, 197, 94, 0.1)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0f172a' }}>
              {queueStats?.totalProcessed ?? 0}
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              annotations total
            </p>
          </div>

          {/* Last Build */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>Last Build</span>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a' }}>
              {formatRelativeTime(queueStats?.lastDatasetBuild)}
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {queueStats?.lastDatasetBuild ? formatDate(queueStats.lastDatasetBuild) : 'No builds yet'}
            </p>
          </div>

          {/* Next Scheduled */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>Next Build</span>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'rgba(99, 102, 241, 0.1)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a' }}>
              2:00 AM UTC
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              daily scheduled build
            </p>
          </div>
        </div>

        {/* Actions Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f172a', margin: 0 }}>
            Recent Build Jobs
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <a
              href={`https://wandb.ai/${WANDB_ENTITY}/${WANDB_PROJECT}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.25rem',
                background: 'white',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15,3 21,3 21,9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open W&B
            </a>
            <button
              onClick={triggerManualBuild}
              disabled={triggerLoading || (queueStats?.pendingAnnotations ?? 0) === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.25rem',
                background: (queueStats?.pendingAnnotations ?? 0) > 0 ? '#3b82f6' : '#94a3b8',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: (queueStats?.pendingAnnotations ?? 0) > 0 ? 'pointer' : 'not-allowed',
                opacity: triggerLoading ? 0.7 : 1
              }}
            >
              {triggerLoading ? (
                <>
                  <span style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid white',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Triggering...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5,3 19,12 5,21 5,3" />
                  </svg>
                  Trigger Build Now
                </>
              )}
            </button>
          </div>
        </div>

        {/* Jobs Table */}
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          {jobs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'rgba(99, 102, 241, 0.1)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              </div>
              <h4 style={{ color: '#0f172a', fontSize: '1.125rem', fontWeight: '600', margin: '0 0 0.5rem' }}>
                No build jobs yet
              </h4>
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                Approve annotations and trigger a build to create your first dataset
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Started</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Annotations</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trigger</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>W&B</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '1rem' }}>
                      {getStatusBadge(job.status)}
                    </td>
                    <td style={{ padding: '1rem', color: '#374151', fontSize: '0.875rem' }}>
                      {formatDate(job.startedAt)}
                    </td>
                    <td style={{ padding: '1rem', color: '#374151', fontSize: '0.875rem' }}>
                      {formatDate(job.completedAt)}
                    </td>
                    <td style={{ padding: '1rem', color: '#374151', fontSize: '0.875rem', textAlign: 'right' }}>
                      {job.annotationCount ?? '-'}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.125rem 0.5rem',
                        background: job.triggerType === 'SCHEDULED' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: job.triggerType === 'SCHEDULED' ? '#6366f1' : '#3b82f6',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {job.triggerType === 'SCHEDULED' ? 'Scheduled' : 'Manual'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {job.wandbRunUrl ? (
                        <a
                          href={job.wandbRunUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#3b82f6',
                            fontSize: '0.875rem',
                            textDecoration: 'none'
                          }}
                        >
                          View
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15,3 21,3 21,9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      ) : job.status === 'FAILED' ? (
                        <span style={{ color: '#b91c1c', fontSize: '0.75rem' }} title={job.errorMessage || 'Unknown error'}>
                          Error
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* W&B Quick Links */}
        <div style={{
          marginTop: '2rem',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '1.5rem'
        }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a', marginBottom: '1rem' }}>
            W&B Quick Links
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <a
              href={`https://wandb.ai/${WANDB_ENTITY}/${WANDB_PROJECT}/artifacts`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: '#f8fafc',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '0.875rem',
                textDecoration: 'none'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              Dataset Artifacts
            </a>
            <a
              href={`https://wandb.ai/${WANDB_ENTITY}/${WANDB_PROJECT}/runs`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: '#f8fafc',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '0.875rem',
                textDecoration: 'none'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              All Runs
            </a>
            <a
              href={`https://wandb.ai/${WANDB_ENTITY}/${WANDB_PROJECT}/tables`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: '#f8fafc',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '0.875rem',
                textDecoration: 'none'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M7 7h10" />
                <path d="M7 12h10" />
                <path d="M7 17h10" />
              </svg>
              Dataset Tables
            </a>
          </div>
        </div>
      </main>

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
