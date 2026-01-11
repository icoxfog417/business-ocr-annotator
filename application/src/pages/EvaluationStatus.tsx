import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

// W&B project configuration
const WANDB_PROJECT = 'business-ocr-sandbox'; // Use 'biz-doc-vqa' for production
const WANDB_ENTITY = 'your-entity'; // TODO: Get from environment

interface EvaluationJobData {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  modelName: string;
  datasetVersion: string;
  startedAt?: string;
  completedAt?: string;
  exactMatchRate?: number;
  f1Score?: number;
  avgIoU?: number;
  sampleCount?: number;
  wandbRunUrl?: string;
  errorMessage?: string;
  triggeredBy: string;
  triggerType: 'SCHEDULED' | 'MANUAL';
}

export function EvaluationStatus() {
  const [jobs, setJobs] = useState<EvaluationJobData[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('Amazon Nova Pro');
  const [selectedDatasetVersion, setSelectedDatasetVersion] = useState('latest');

  const availableModels = [
    'Amazon Nova Pro',
    'Claude 3.5 Sonnet',
    'Nemotron Nano 12B'
  ];

  const fetchData = useCallback(async () => {
    try {
      // Fetch recent evaluation jobs
      const jobsResult = await client.models.EvaluationJob.list({
        limit: 20
      });

      // Sort by startedAt descending
      const sortedJobs = (jobsResult.data as EvaluationJobData[]).sort((a, b) => {
        const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return dateB - dateA;
      });
      setJobs(sortedJobs);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch evaluation status:', err);
      setError('Failed to load evaluation status');
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

  const triggerEvaluation = async () => {
    setTriggerLoading(true);
    try {
      await client.models.EvaluationJob.create({
        status: 'QUEUED',
        modelName: selectedModel,
        datasetVersion: selectedDatasetVersion,
        triggeredBy: 'manual-user',
        triggerType: 'MANUAL'
      });

      await fetchData();
    } catch (err) {
      console.error('Failed to trigger evaluation:', err);
      setError('Failed to trigger evaluation');
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

  const formatPercent = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Calculate best metrics for display
  const completedJobs = jobs.filter(j => j.status === 'COMPLETED');
  const bestEM = completedJobs.reduce((best, j) => Math.max(best, j.exactMatchRate ?? 0), 0);
  const bestF1 = completedJobs.reduce((best, j) => Math.max(best, j.f1Score ?? 0), 0);
  const bestIoU = completedJobs.reduce((best, j) => Math.max(best, j.avgIoU ?? 0), 0);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid #e5e7eb',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p style={{ color: '#64748b' }}>Loading evaluation status...</p>
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
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <h1 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0f172a', margin: 0 }}>
                Evaluation Status
              </h1>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              to="/dataset-status"
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
              Dataset Status
            </Link>
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
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2.5rem 2rem' }}>
        {/* Page Title */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
            Model Evaluation
          </h2>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>
            Run evaluations on your VQA dataset and compare model performance
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

        {/* Best Metrics Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {/* Best Exact Match */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>Best EM</span>
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
            <div style={{ fontSize: '2rem', fontWeight: '700', color: bestEM > 0 ? '#15803d' : '#94a3b8' }}>
              {bestEM > 0 ? formatPercent(bestEM) : '-'}
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              Exact Match Rate
            </p>
          </div>

          {/* Best F1 Score */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>Best F1</span>
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
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: bestF1 > 0 ? '#1d4ed8' : '#94a3b8' }}>
              {bestF1 > 0 ? formatPercent(bestF1) : '-'}
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              Token F1 Score
            </p>
          </div>

          {/* Best IoU */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>Best IoU</span>
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
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: bestIoU > 0 ? '#6366f1' : '#94a3b8' }}>
              {bestIoU > 0 ? formatPercent(bestIoU) : '-'}
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              BBox Intersection/Union
            </p>
          </div>

          {/* Total Evaluations */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500' }}>Total</span>
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
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0f172a' }}>
              {completedJobs.length}
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              completed evaluations
            </p>
          </div>
        </div>

        {/* Trigger Evaluation Form */}
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a', marginBottom: '1rem' }}>
            Run New Evaluation
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  color: '#374151',
                  background: 'white'
                }}
              >
                {availableModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Dataset Version
              </label>
              <select
                value={selectedDatasetVersion}
                onChange={(e) => setSelectedDatasetVersion(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  color: '#374151',
                  background: 'white'
                }}
              >
                <option value="latest">latest</option>
                <option value="v0">v0</option>
                <option value="v1">v1</option>
                <option value="v2">v2</option>
              </select>
            </div>
            <button
              onClick={triggerEvaluation}
              disabled={triggerLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.5rem',
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
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
                  Running...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5,3 19,12 5,21 5,3" />
                  </svg>
                  Run Evaluation
                </>
              )}
            </button>
          </div>
        </div>

        {/* Jobs Table */}
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f172a', margin: 0 }}>
            Evaluation History
          </h3>
        </div>

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
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <h4 style={{ color: '#0f172a', fontSize: '1.125rem', fontWeight: '600', margin: '0 0 0.5rem' }}>
                No evaluations yet
              </h4>
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                Build a dataset first, then run an evaluation to measure model performance
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dataset</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EM</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>F1</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>IoU</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>W&B</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '1rem' }}>
                      {getStatusBadge(job.status)}
                    </td>
                    <td style={{ padding: '1rem', color: '#374151', fontSize: '0.875rem', fontWeight: '500' }}>
                      {job.modelName}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.125rem 0.5rem',
                        background: 'rgba(99, 102, 241, 0.1)',
                        color: '#6366f1',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {job.datasetVersion}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: '#374151', fontSize: '0.875rem', textAlign: 'right', fontWeight: job.exactMatchRate ? '600' : '400' }}>
                      {formatPercent(job.exactMatchRate)}
                    </td>
                    <td style={{ padding: '1rem', color: '#374151', fontSize: '0.875rem', textAlign: 'right', fontWeight: job.f1Score ? '600' : '400' }}>
                      {formatPercent(job.f1Score)}
                    </td>
                    <td style={{ padding: '1rem', color: '#374151', fontSize: '0.875rem', textAlign: 'right', fontWeight: job.avgIoU ? '600' : '400' }}>
                      {formatPercent(job.avgIoU)}
                    </td>
                    <td style={{ padding: '1rem', color: '#374151', fontSize: '0.875rem' }}>
                      {formatDate(job.completedAt)}
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
                            color: '#6366f1',
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

        {/* Schedule Info */}
        <div style={{
          marginTop: '2rem',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '1.5rem'
        }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a', marginBottom: '1rem' }}>
            Evaluation Schedule
          </h4>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Automated evaluations run weekly on Sundays at 3:00 AM UTC using the latest dataset version.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <a
              href={`https://wandb.ai/${WANDB_ENTITY}/${WANDB_PROJECT}`}
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
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              View All Runs in W&B
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
