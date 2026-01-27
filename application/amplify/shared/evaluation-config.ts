/**
 * Shared evaluation configuration types and utilities.
 * Used by both Lambda functions and frontend.
 *
 * Single source of truth: evaluation-models.json in this directory.
 */

import evaluationModels from './evaluation-models.json';

/**
 * Evaluation model configuration
 */
export interface EvaluationModel {
  id: string;
  name: string;
  provider: string;
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

/**
 * The evaluation configuration loaded from JSON
 */
export const EVALUATION_CONFIG: EvaluationConfig = evaluationModels as EvaluationConfig;

// ============================================================================
// Utility functions
// ============================================================================

/**
 * Get all evaluation models
 */
export function getAllModels(): EvaluationModel[] {
  return EVALUATION_CONFIG.models;
}

/**
 * Get all enabled model IDs
 */
export function getEnabledModelIds(): string[] {
  return EVALUATION_CONFIG.models.filter((m) => m.enabled).map((m) => m.id);
}

/**
 * Get all enabled models
 */
export function getEnabledModels(): EvaluationModel[] {
  return EVALUATION_CONFIG.models.filter((m) => m.enabled);
}

/**
 * Get metrics configuration
 */
export function getMetricsConfig(): MetricsConfig {
  return EVALUATION_CONFIG.metrics;
}

/**
 * Get a model by its ID (e.g., "claude-sonnet-4-5")
 */
export function getModelById(id: string): EvaluationModel | undefined {
  return EVALUATION_CONFIG.models.find((m) => m.id === id);
}

/**
 * Get a model by its Bedrock model ID
 */
export function getModelByBedrockId(bedrockModelId: string): EvaluationModel | undefined {
  return EVALUATION_CONFIG.models.find((m) => m.bedrockModelId === bedrockModelId);
}

/**
 * Get the config version
 */
export function getConfigVersion(): string {
  return EVALUATION_CONFIG.version;
}
