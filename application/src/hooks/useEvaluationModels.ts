import { useMemo } from 'react';
import evaluationModels from '../config/evaluation-models.json';

/**
 * Evaluation model configuration from evaluation-models.json
 */
export interface EvaluationModel {
  id: string;
  name: string;
  provider: 'bedrock' | string;
  bedrockModelId: string;
  enabled: boolean;
}

/**
 * Metrics configuration for evaluation
 */
export interface MetricsConfig {
  primary: string[];
  anlsThreshold: number;
  iouThreshold: number;
}

/**
 * Full evaluation configuration
 */
export interface EvaluationConfig {
  version: string;
  models: EvaluationModel[];
  metrics: MetricsConfig;
}

const config = evaluationModels as EvaluationConfig;

/**
 * Hook to load evaluation models from JSON config.
 * Returns all models and utility functions for filtering.
 */
export function useEvaluationModels() {
  const allModels = useMemo(() => config.models, []);

  const enabledModels = useMemo(() => config.models.filter((m) => m.enabled), []);

  const metrics = useMemo(() => config.metrics, []);

  const getModelById = useMemo(() => {
    return (id: string): EvaluationModel | undefined => {
      return config.models.find((m) => m.id === id);
    };
  }, []);

  const getModelByBedrockId = useMemo(() => {
    return (bedrockModelId: string): EvaluationModel | undefined => {
      return config.models.find((m) => m.bedrockModelId === bedrockModelId);
    };
  }, []);

  return {
    /** All models defined in config */
    allModels,
    /** Only enabled models */
    enabledModels,
    /** Metrics configuration (ANLS/IoU thresholds) */
    metrics,
    /** Find model by its id (e.g., "claude-3-5-sonnet") */
    getModelById,
    /** Find model by its Bedrock model ID */
    getModelByBedrockId,
    /** Config version */
    version: config.version,
  };
}

/**
 * Get all enabled model IDs (for use outside of React components)
 */
export function getEnabledModelIds(): string[] {
  return config.models.filter((m) => m.enabled).map((m) => m.id);
}

/**
 * Get metrics configuration (for use outside of React components)
 */
export function getMetricsConfig(): MetricsConfig {
  return config.metrics;
}

/**
 * Get a model by ID (for use outside of React components)
 */
export function getModelById(id: string): EvaluationModel | undefined {
  return config.models.find((m) => m.id === id);
}

/**
 * Get the full config (for use outside of React components)
 */
export function getEvaluationConfig(): EvaluationConfig {
  return config;
}
