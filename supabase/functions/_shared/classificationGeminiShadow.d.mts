import type { CatalogSnapshot, ClassificationPurpose } from './classificationEngine.mjs';
export declare function withGeminiClassificationShadowSchema<T extends { type: string; properties: Record<string, unknown>; required?: string[] }>(baseSchema: T, purpose?: ClassificationPurpose): T;
export declare function geminiClassificationShadowInstruction(purpose?: ClassificationPurpose): string;
export declare function inspectGeminiClassificationShadow(
  raw: unknown, snapshot: CatalogSnapshot, purpose: ClassificationPurpose,
): { output: unknown; statuses: string[]; reviewProposals: Array<{
  service: string; mode: 'ON_SITE' | 'REMOTE'; action: 'REUSE_EXISTING' | 'CREATE_CHILD';
  categoryId: string; parentId: string; proposedPath: string[];
  reason: string; catalogVersion: number;
}> };

/** Advisory coverage summary; never grants worker consent or matching eligibility. */
export declare function workerServicesMissingScope(skills: unknown, reviewProposals: unknown): {
  count: number; labels: string[];
};
/** Owner-facing finish-only guidance; no profile Save or capability write. */
export declare function workerFinishReviewMessage(skills: unknown, reviewProposals: unknown, catalogAvailable: boolean): string;
