import { useMemo } from 'react';
import {
  EVALUATION_CONFIG,
  type EvaluationModel,
  type EvaluationConfig,
  type MetricsConfig,
} from '../../amplify/shared/evaluation-config';

// Re-export types for convenience
export type { EvaluationModel, EvaluationConfig, MetricsConfig };

const config = EVALUATION_CONFIG;

// ============================================================================
// Standalone utility functions (for use outside of React components)
// ============================================================================

/**
 * Get all enabled model IDs
 */
export function getEnabledModelIds(): string[] {
  return config.models.filter((m) => m.enabled).map((m) => m.id);
}

/**
 * Get metrics configuration
 */
export function getMetricsConfig(): MetricsConfig {
  return config.metrics;
}

/**
 * Get a model by its ID (e.g., "claude-3-5-sonnet")
 */
export function getModelById(id: string): EvaluationModel | undefined {
  return config.models.find((m) => m.id === id);
}

/**
 * Get a model by its Bedrock model ID
 */
export function getModelByBedrockId(bedrockModelId: string): EvaluationModel | undefined {
  return config.models.find((m) => m.bedrockModelId === bedrockModelId);
}

/**
 * Get the full evaluation config
 */
export function getEvaluationConfig(): EvaluationConfig {
  return config;
}

// ============================================================================
// React Hook (wraps utility functions with memoization)
// ============================================================================

/**
 * Hook to load evaluation models from JSON config.
 * Returns all models and utility functions for filtering.
 * Uses the standalone utility functions internally to avoid duplication.
 */
export function useEvaluationModels() {
  const allModels = useMemo(() => config.models, []);

  const enabledModels = useMemo(() => config.models.filter((m) => m.enabled), []);

  const metrics = useMemo(() => config.metrics, []);

  // Wrap standalone functions in useMemo for stable references
  const memoizedGetModelById = useMemo(() => getModelById, []);
  const memoizedGetModelByBedrockId = useMemo(() => getModelByBedrockId, []);

  return {
    /** All models defined in config */
    allModels,
    /** Only enabled models */
    enabledModels,
    /** Metrics configuration (ANLS/IoU thresholds) */
    metrics,
    /** Find model by its id (e.g., "claude-3-5-sonnet") */
    getModelById: memoizedGetModelById,
    /** Find model by its Bedrock model ID */
    getModelByBedrockId: memoizedGetModelByBedrockId,
    /** Config version */
    version: config.version,
  };
}
