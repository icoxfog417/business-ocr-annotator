/**
 * Export configuration for dataset management.
 *
 * The Hugging Face repo ID is preset based on the build environment.
 * - Production build (npm run build): production repo
 * - Development (npm run dev): development repo
 */

export interface ExportConfig {
  huggingFaceRepoId: string;
  isRepoIdLocked: boolean;
}

// Use Vite's mode to determine environment
// - 'production' when running `npm run build`
// - 'development' when running `npm run dev` or sandbox
const isProduction = import.meta.env.PROD;

export const exportConfig: ExportConfig = {
  huggingFaceRepoId: isProduction
    ? 'icoxfog417/biz-doc-vqa'
    : 'icoxfog417/biz-doc-vqa-test',
  isRepoIdLocked: true, // Always locked - users cannot change
};
