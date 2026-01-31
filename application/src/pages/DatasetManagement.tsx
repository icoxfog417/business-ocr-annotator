import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { client } from '../lib/apiClient';
import { useEvaluationModels } from '../hooks/useEvaluationModels';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { useApprovedAnnotationStats } from '../hooks/useApprovedAnnotationStats';
import { exportConfig } from '../config/exportConfig';
import { MobileNavSpacer } from '../components/layout';
import './DatasetManagement.css';

// ---------------------------------------------------------------------------
// Types derived from Amplify schema
// ---------------------------------------------------------------------------
interface DatasetVersion {
  id: string;
  version: string;
  huggingFaceRepoId: string;
  huggingFaceUrl: string;
  annotationCount: number;
  imageCount: number;
  status: string | null;
  createdBy: string;
  createdAt: string;
  finalizedAt: string | null;
}

interface DatasetExportProgress {
  id: string;
  exportId: string;
  version: string;
  lastProcessedAnnotationId: string | null;
  processedCount: number;
  totalCount: number;
  status: string | null;
  errorMessage: string | null;
  startedAt: string;
  updatedAt: string | null;
}

interface EvaluationJob {
  id: string;
  jobId: string;
  datasetVersion: string;
  modelId: string;
  modelName: string | null;
  status: string | null;
  avgAnls: number | null;
  avgIou: number | null;
  totalSamples: number | null;
  wandbRunUrl: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getStatusStyle(status: string | null | undefined): React.CSSProperties {
  switch (status) {
    case 'CREATING':
    case 'IN_PROGRESS':
    case 'RUNNING':
      return { background: '#dbeafe', color: '#1d4ed8' };
    case 'READY':
    case 'COMPLETED':
      return { background: '#dcfce7', color: '#15803d' };
    case 'EVALUATING':
    case 'QUEUED':
      return { background: '#fef9c3', color: '#a16207' };
    case 'FINALIZED':
      return { background: '#e0e7ff', color: '#4338ca' };
    case 'FAILED':
      return { background: '#fee2e2', color: '#dc2626' };
    default:
      return { background: '#f1f5f9', color: '#64748b' };
  }
}

function incrementVersion(latest: string): string {
  const match = latest.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return 'v1.0.0';
  return `v${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatMetric(value: number | null | undefined): string {
  if (value == null) return '-';
  return value.toFixed(3);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function DatasetManagement() {
  const { enabledModels, getModelById } = useEvaluationModels();
  const { isMobile } = useBreakpoint();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const {
    annotationCount: approvedAnnotationCount,
    pendingAnnotationCount,
    totalExportableAnnotationCount,
    totalExportableImageCount,
    refetch: refetchStats,
  } = useApprovedAnnotationStats();

  // Export configuration (preset repo ID based on build environment)
  const { huggingFaceRepoId: presetRepoId, isRepoIdLocked } = exportConfig;

  // Data state
  const [datasetVersions, setDatasetVersions] = useState<DatasetVersion[]>([]);
  const [exportProgresses, setExportProgresses] = useState<DatasetExportProgress[]>([]);
  const [evaluationJobs, setEvaluationJobs] = useState<EvaluationJob[]>([]);
  const [loading, setLoading] = useState(true);

  // Export form
  const [newVersion, setNewVersion] = useState('');
  const [repoId, setRepoId] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Evaluation form
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [selectedDatasetVersion, setSelectedDatasetVersion] = useState('');
  const [isTriggering, setIsTriggering] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Set repo ID from preset when loaded
  useEffect(() => {
    if (presetRepoId && !repoId) {
      setRepoId(presetRepoId);
    }
  }, [presetRepoId, repoId]);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    try {
      const [versionsResult, progressResult, jobsResult] = await Promise.all([
        client.models.DatasetVersion.list(),
        client.models.DatasetExportProgress.list(),
        client.models.EvaluationJob.list(),
      ]);

      const versions = (versionsResult.data as unknown as DatasetVersion[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setDatasetVersions(versions);
      setExportProgresses(progressResult.data as unknown as DatasetExportProgress[]);
      setEvaluationJobs(
        (jobsResult.data as unknown as EvaluationJob[]).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );

      // Auto-fill next version & repoId from latest
      if (versions.length > 0) {
        const latest = versions[0];
        setNewVersion((prev) => prev || incrementVersion(latest.version));
        // Only auto-fill repo ID if not preset via config
        if (!isRepoIdLocked) {
          setRepoId((prev) => prev || latest.huggingFaceRepoId);
        }
      } else {
        setNewVersion((prev) => prev || 'v1.0.0');
      }
    } catch (err) {
      console.error('Failed to fetch dataset data:', err);
    } finally {
      setLoading(false);
    }
  }, [isRepoIdLocked]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------------------------------------------------------------------------
  // Polling
  // -------------------------------------------------------------------------
  useEffect(() => {
    const hasActiveExport = exportProgresses.some((p) => p.status === 'IN_PROGRESS');
    const hasCreatingVersion = datasetVersions.some((v) => v.status === 'CREATING');
    const hasActiveJob = evaluationJobs.some(
      (j) => j.status === 'QUEUED' || j.status === 'RUNNING'
    );

    if (hasActiveExport || hasCreatingVersion || hasActiveJob) {
      const interval = hasActiveExport || hasCreatingVersion ? 5000 : 10000;
      pollingRef.current = setInterval(fetchData, interval);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [datasetVersions, exportProgresses, evaluationJobs, fetchData]);

  // -------------------------------------------------------------------------
  // Export action
  // -------------------------------------------------------------------------
  const handleExport = async (resumeFrom?: string) => {
    setExportError(null);
    setIsExporting(true);
    try {
      // Create DatasetVersion record first (only for new exports)
      let versionId: string;
      if (resumeFrom) {
        // Resuming — find existing version
        const existing = datasetVersions.find((v) => v.version === newVersion);
        versionId = existing?.id ?? '';
      } else {
        const hfUrl = `https://huggingface.co/datasets/${repoId}`;
        const versionRecord = await client.models.DatasetVersion.create({
          version: newVersion,
          huggingFaceRepoId: repoId,
          huggingFaceUrl: hfUrl,
          annotationCount: 0,
          imageCount: 0,
          status: 'CREATING',
          createdBy: 'current-user',
          createdAt: new Date().toISOString(),
        });
        versionId = versionRecord.data?.id ?? '';
      }

      const result = await client.mutations.exportDataset({
        datasetVersionId: versionId,
        datasetVersion: newVersion,
        huggingFaceRepoId: repoId,
        resumeFrom: resumeFrom ?? undefined,
      });

      // Parse response
      if (result.data) {
        const parsed =
          typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
        if (parsed.error) {
          setExportError(parsed.error);
        }
      }

      await fetchData();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Evaluation action
  // -------------------------------------------------------------------------
  const handleTriggerEvaluation = async () => {
    setEvalError(null);
    if (selectedModelIds.length === 0) {
      setEvalError('Select at least one model');
      return;
    }
    if (!selectedDatasetVersion) {
      setEvalError('Select a dataset version');
      return;
    }

    const version = datasetVersions.find((v) => v.version === selectedDatasetVersion);
    if (!version) {
      setEvalError('Invalid dataset version');
      return;
    }

    setIsTriggering(true);
    try {
      const result = await client.mutations.triggerEvaluation({
        datasetVersion: selectedDatasetVersion,
        huggingFaceRepoId: version.huggingFaceRepoId,
        modelIds: selectedModelIds,
      });

      if (result.data) {
        const parsed =
          typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
        if (parsed.error) {
          setEvalError(parsed.error);
        }
      }

      setSelectedModelIds([]);
      await fetchData();
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Failed to trigger evaluation');
    } finally {
      setIsTriggering(false);
    }
  };

  // -------------------------------------------------------------------------
  // Delete version action
  // -------------------------------------------------------------------------
  const handleDeleteVersion = async (version: DatasetVersion) => {
    const confirmMsg = `Delete dataset version "${version.version}"?\n\nThis will remove the version record from the database. The dataset on HuggingFace will not be affected.`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      await client.models.DatasetVersion.delete({ id: version.id });
      await fetchData();
    } catch (err) {
      console.error('Failed to delete version:', err);
      alert('Failed to delete version: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // -------------------------------------------------------------------------
  // Model checkbox toggle
  // -------------------------------------------------------------------------
  const toggleModel = (modelId: string) => {
    setSelectedModelIds((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  };

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const readyVersions = datasetVersions.filter(
    (v) => v.status === 'READY' || v.status === 'FINALIZED'
  );

  const activeExport = exportProgresses.find((p) => p.status === 'IN_PROGRESS');
  const failedExport = exportProgresses.find(
    (p) => p.status === 'FAILED' && p.lastProcessedAnnotationId
  );

  // -------------------------------------------------------------------------
  // Confirmation dialog handlers
  // -------------------------------------------------------------------------
  const handleCreateVersionClick = () => {
    setShowConfirmDialog(true);
  };

  const autoApprovePendingAnnotations = async () => {
    const now = new Date().toISOString();
    const BATCH_SIZE = 25;
    let nextToken: string | null | undefined;

    do {
      const result = await client.models.Annotation.list({
        filter: { validationStatus: { eq: 'PENDING' } },
        ...(nextToken ? { nextToken } : {}),
      });

      const annotations = result.data || [];

      // Process in batches to avoid API rate limiting
      for (let i = 0; i < annotations.length; i += BATCH_SIZE) {
        const batch = annotations.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((annotation) =>
            client.models.Annotation.update({
              id: annotation.id,
              validationStatus: 'APPROVED',
              validatedBy: 'auto-approved-on-export',
              validatedAt: now,
            })
          )
        );
      }

      nextToken = result.nextToken || undefined;
    } while (nextToken);
  };

  const handleConfirmExport = async () => {
    setShowConfirmDialog(false);
    setExportError(null);
    setIsExporting(true);

    // Auto-approve all PENDING annotations before export
    try {
      await autoApprovePendingAnnotations();
    } catch (err) {
      setExportError(
        'Failed to auto-approve annotations: ' +
          (err instanceof Error ? err.message : String(err))
      );
      setIsExporting(false);
      return;
    }

    await handleExport();
    await refetchStats();
  };

  const handleCancelExport = () => {
    setShowConfirmDialog(false);
  };

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (loading || isAdminLoading) {
    return (
      <div className="dm-page">
        <header className="dm-header">
          <div className="dm-header-content">
            <Link to="/" className="dm-back-btn" aria-label="Back to dashboard">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="dm-header-title">Dataset Management</h1>
          </div>
        </header>
        <div className="dm-loading">Loading dataset data...</div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Admin access check
  // -------------------------------------------------------------------------
  if (!isAdmin) {
    return (
      <div className="dm-page">
        <header className="dm-header">
          <div className="dm-header-content">
            <Link to="/" className="dm-back-btn" aria-label="Back to dashboard">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="dm-header-title">Dataset Management</h1>
          </div>
        </header>
        <main className="dm-main">
          <div className="dm-access-denied">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ marginBottom: '1rem', color: '#dc2626' }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            <h2>Access Denied</h2>
            <p>
              This page is restricted to administrators only.
              <br />
              Please contact your administrator if you need access.
            </p>
            <Link to="/" className="dm-btn dm-btn-primary" style={{ marginTop: '1rem' }}>
              Return to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="dm-page">
      {/* Header */}
      <header className="dm-header">
        <div className="dm-header-content">
          <Link to="/" className="dm-back-btn" aria-label="Back to dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="dm-header-title">Dataset Management</h1>
        </div>
      </header>

      <main className="dm-main">
        {/* ================================================================= */}
        {/* Dataset Versions Section                                           */}
        {/* ================================================================= */}
        <section className="dm-section">
          <h2 className="dm-section-title">Dataset Versions</h2>

          {datasetVersions.length === 0 ? (
            <div className="dm-empty">No dataset versions yet. Create your first export below.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="dm-table-wrapper">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Status</th>
                      <th>Annotations</th>
                      <th>Images</th>
                      <th>Created</th>
                      <th>HuggingFace</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasetVersions.map((v) => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 600 }}>{v.version}</td>
                        <td>
                          <span className="dm-badge" style={getStatusStyle(v.status)}>
                            {v.status ?? 'UNKNOWN'}
                          </span>
                        </td>
                        <td>{v.annotationCount}</td>
                        <td>{v.imageCount}</td>
                        <td>{formatDate(v.createdAt)}</td>
                        <td>
                          <a
                            href={v.huggingFaceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dm-hf-link"
                          >
                            {v.huggingFaceRepoId}
                          </a>
                        </td>
                        <td>
                          <button
                            className="dm-delete-btn"
                            onClick={() => handleDeleteVersion(v)}
                            title="Delete version"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="dm-card-list">
                {datasetVersions.map((v) => (
                  <div className="dm-card" key={v.id}>
                    <div className="dm-card-header">
                      <span className="dm-card-version">{v.version}</span>
                      <span className="dm-badge" style={getStatusStyle(v.status)}>
                        {v.status ?? 'UNKNOWN'}
                      </span>
                    </div>
                    <div className="dm-card-row">
                      <span className="dm-card-label">Annotations</span>
                      <span className="dm-card-value">{v.annotationCount}</span>
                    </div>
                    <div className="dm-card-row">
                      <span className="dm-card-label">Images</span>
                      <span className="dm-card-value">{v.imageCount}</span>
                    </div>
                    <div className="dm-card-row">
                      <span className="dm-card-label">Created</span>
                      <span className="dm-card-value">{formatDate(v.createdAt)}</span>
                    </div>
                    <div className="dm-card-actions">
                      <a
                        href={v.huggingFaceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dm-hf-link"
                      >
                        View on HuggingFace
                      </a>
                      <button
                        className="dm-delete-btn"
                        onClick={() => handleDeleteVersion(v)}
                        title="Delete version"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ================================================================= */}
        {/* Export Section                                                      */}
        {/* ================================================================= */}
        <section className="dm-section">
          <h2 className="dm-section-title">Export to HuggingFace</h2>

          {/* Exportable annotations summary */}
          <div className="dm-stats-summary">
            <div className="dm-stat-item">
              <span className="dm-stat-value">{totalExportableAnnotationCount}</span>
              <span className="dm-stat-label">
                Exportable Annotations
                {pendingAnnotationCount > 0 && (
                  <span className="dm-stat-detail">
                    ({approvedAnnotationCount} approved, {pendingAnnotationCount} pending)
                  </span>
                )}
              </span>
            </div>
            <div className="dm-stat-item">
              <span className="dm-stat-value">{totalExportableImageCount}</span>
              <span className="dm-stat-label">Unique Images</span>
            </div>
          </div>

          <div className="dm-form-row">
            <div className="dm-form-group">
              <label className="dm-form-label" htmlFor="export-version">
                Version
              </label>
              <input
                id="export-version"
                className="dm-form-input"
                type="text"
                placeholder="v1.0.0"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                disabled={isExporting}
              />
            </div>
            <div className="dm-form-group">
              <label className="dm-form-label" htmlFor="export-repo">
                HuggingFace Repo ID
                {isRepoIdLocked && (
                  <span className="dm-locked-badge" title="Preset by administrator">
                    (Preset)
                  </span>
                )}
              </label>
              <input
                id="export-repo"
                className={`dm-form-input ${isRepoIdLocked ? 'dm-input-locked' : ''}`}
                type="text"
                placeholder="org/dataset-name"
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
                disabled={isExporting || isRepoIdLocked}
                readOnly={isRepoIdLocked}
              />
            </div>
            <button
              className="dm-btn dm-btn-primary"
              disabled={isExporting || !newVersion || !repoId || totalExportableAnnotationCount === 0}
              onClick={handleCreateVersionClick}
            >
              {isExporting ? 'Exporting...' : 'Create New Version'}
            </button>
          </div>

          {/* Resume button for failed exports */}
          {failedExport && !activeExport && (
            <div style={{ marginTop: '0.5rem' }}>
              <button
                className="dm-btn dm-btn-outline"
                onClick={() => handleExport(failedExport.lastProcessedAnnotationId ?? undefined)}
                disabled={isExporting}
              >
                Resume Failed Export ({failedExport.version} — {failedExport.processedCount}/
                {failedExport.totalCount} processed)
              </button>
            </div>
          )}

          {/* Active export progress */}
          {activeExport && (
            <div className="dm-progress-container">
              <div className="dm-progress-label">
                <span>
                  Exporting {activeExport.version}...
                </span>
                <span>
                  {activeExport.processedCount} / {activeExport.totalCount}
                </span>
              </div>
              <div className="dm-progress-bar">
                <div
                  className="dm-progress-fill"
                  style={{
                    width:
                      activeExport.totalCount > 0
                        ? `${(activeExport.processedCount / activeExport.totalCount) * 100}%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          )}

          {exportError && <div className="dm-error">{exportError}</div>}
        </section>

        {/* ================================================================= */}
        {/* Evaluation Section                                                 */}
        {/* ================================================================= */}
        <section className="dm-section">
          <h2 className="dm-section-title">Model Evaluation</h2>

          {/* Model checkboxes */}
          <div className="dm-form-label" style={{ marginBottom: '0.5rem' }}>
            Select Models
          </div>
          <div className="dm-model-grid">
            {enabledModels.map((model) => (
              <label
                key={model.id}
                className={`dm-model-item ${selectedModelIds.includes(model.id) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  className="dm-model-checkbox"
                  checked={selectedModelIds.includes(model.id)}
                  onChange={() => toggleModel(model.id)}
                  disabled={isTriggering}
                />
                <div>
                  <div className="dm-model-name">{model.name}</div>
                  <div className="dm-model-provider">{model.provider}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Version dropdown + trigger button */}
          <div className="dm-eval-form">
            <div className="dm-form-group">
              <label className="dm-form-label" htmlFor="eval-version">
                Dataset Version
              </label>
              <select
                id="eval-version"
                className="dm-form-select"
                value={selectedDatasetVersion}
                onChange={(e) => setSelectedDatasetVersion(e.target.value)}
                disabled={isTriggering || readyVersions.length === 0}
              >
                <option value="">
                  {readyVersions.length === 0 ? 'No versions available' : 'Select version...'}
                </option>
                {readyVersions.map((v) => (
                  <option key={v.id} value={v.version}>
                    {v.version} ({v.status}) — {v.annotationCount} annotations
                  </option>
                ))}
              </select>
            </div>
            <button
              className="dm-btn dm-btn-success"
              disabled={isTriggering || selectedModelIds.length === 0 || !selectedDatasetVersion}
              onClick={handleTriggerEvaluation}
            >
              {isTriggering ? 'Triggering...' : 'Run Evaluation'}
            </button>
          </div>

          {evalError && <div className="dm-error">{evalError}</div>}

          {/* Jobs table/cards */}
          {evaluationJobs.length > 0 && (
            <div className="dm-jobs-table">
              <h3
                className="dm-section-title"
                style={{ fontSize: '1rem', marginTop: '1.25rem' }}
              >
                Evaluation Jobs
              </h3>

              {/* Desktop table */}
              {!isMobile ? (
                <div className="dm-table-wrapper" style={{ display: 'block' }}>
                  <table className="dm-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Version</th>
                        <th>Status</th>
                        <th>ANLS</th>
                        <th>IoU</th>
                        <th>Samples</th>
                        <th>W&B</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluationJobs.map((job) => {
                        const model = getModelById(job.modelId);
                        return (
                          <tr key={job.id}>
                            <td>{model?.name ?? job.modelId}</td>
                            <td>{job.datasetVersion}</td>
                            <td>
                              <span className="dm-badge" style={getStatusStyle(job.status)}>
                                {job.status ?? 'UNKNOWN'}
                              </span>
                            </td>
                            <td className="dm-metric-inline">{formatMetric(job.avgAnls)}</td>
                            <td className="dm-metric-inline">{formatMetric(job.avgIou)}</td>
                            <td>{job.totalSamples ?? '-'}</td>
                            <td>
                              {job.wandbRunUrl ? (
                                <a
                                  href={job.wandbRunUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="dm-hf-link"
                                >
                                  View
                                </a>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="dm-card-list" style={{ display: 'flex' }}>
                  {evaluationJobs.map((job) => {
                    const model = getModelById(job.modelId);
                    return (
                      <div className="dm-card" key={job.id}>
                        <div className="dm-card-header">
                          <span className="dm-card-version">
                            {model?.name ?? job.modelId}
                          </span>
                          <span className="dm-badge" style={getStatusStyle(job.status)}>
                            {job.status ?? 'UNKNOWN'}
                          </span>
                        </div>
                        <div className="dm-card-row">
                          <span className="dm-card-label">Version</span>
                          <span className="dm-card-value">{job.datasetVersion}</span>
                        </div>
                        <div className="dm-card-row">
                          <span className="dm-card-label">ANLS</span>
                          <span className="dm-card-value">{formatMetric(job.avgAnls)}</span>
                        </div>
                        <div className="dm-card-row">
                          <span className="dm-card-label">IoU</span>
                          <span className="dm-card-value">{formatMetric(job.avgIou)}</span>
                        </div>
                        <div className="dm-card-row">
                          <span className="dm-card-label">Samples</span>
                          <span className="dm-card-value">{job.totalSamples ?? '-'}</span>
                        </div>
                        {job.wandbRunUrl && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <a
                              href={job.wandbRunUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="dm-hf-link"
                            >
                              View on W&B
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        <MobileNavSpacer />
      </main>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="dm-dialog-overlay" onClick={handleCancelExport}>
          <div className="dm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="dm-dialog-title">Create Dataset Version {newVersion}</h3>
            <div className="dm-dialog-content">
              <p>Ready to export the following to HuggingFace:</p>
              <div className="dm-dialog-stats">
                <div className="dm-dialog-stat">
                  <span className="dm-dialog-stat-value">{totalExportableAnnotationCount}</span>
                  <span className="dm-dialog-stat-label">Annotations</span>
                </div>
                <div className="dm-dialog-stat">
                  <span className="dm-dialog-stat-value">{totalExportableImageCount}</span>
                  <span className="dm-dialog-stat-label">Unique Images</span>
                </div>
              </div>
              {pendingAnnotationCount > 0 && (
                <p className="dm-dialog-note">
                  {pendingAnnotationCount} pending annotation
                  {pendingAnnotationCount !== 1 ? 's' : ''} will be auto-approved.
                </p>
              )}
              <div className="dm-dialog-destination">
                <span className="dm-dialog-dest-label">Destination:</span>
                <span className="dm-dialog-dest-value">{repoId}</span>
              </div>
            </div>
            <div className="dm-dialog-actions">
              <button className="dm-btn dm-btn-outline" onClick={handleCancelExport}>
                Cancel
              </button>
              <button
                className="dm-btn dm-btn-primary"
                onClick={handleConfirmExport}
                disabled={totalExportableAnnotationCount === 0}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
