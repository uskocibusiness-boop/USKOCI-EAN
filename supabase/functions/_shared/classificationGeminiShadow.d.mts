import type { CatalogSnapshot, ClassificationPurpose } from './classificationEngine.mjs';
import type { ServiceHandoff } from './serviceHandoff.mjs';
export type ClassificationIssue = {
  service: string | null;
  mode: 'ON_SITE' | 'REMOTE' | 'UNCONFIRMED' | null;
  code: string;
  action: string | null;
  resolution: 'ASK_USER' | 'RETRY' | 'PENDING' | 'UNSUPPORTED';
  question: string | null;
};
export type ClassificationInspection = { output: unknown; statuses: string[]; invalidPlanCodes: string[]; issues: ClassificationIssue[]; reviewProposals: Array<{
  service: string; mode: 'ON_SITE' | 'REMOTE'; action: 'REUSE_EXISTING' | 'CREATE_CHILD' | 'CREATE_NEW_BRANCH' | 'EXTEND_MODE';
  categoryId: string; parentId: string; proposedPath: string[];
  reason: string; catalogVersion: number;
  handoff?: ServiceHandoff;
}> };
export declare function withGeminiClassificationShadowSchema<T extends { type: string; properties: Record<string, unknown>; required?: string[] }>(baseSchema: T, purpose?: ClassificationPurpose): T;
export declare function geminiClassificationShadowInstruction(purpose?: ClassificationPurpose, phase?: 'direct' | 'research'): string;
export declare function inspectGeminiClassificationShadow(
  raw: unknown, snapshot: CatalogSnapshot | null, purpose: ClassificationPurpose,
): ClassificationInspection;
/** Syntax-only check; never category/owner/Save authority. */
export declare function isValidClassificationPlanShape(plan: unknown): boolean;

/** Advisory only; never mutates the response, grants Save, or makes a provider call. */
export declare function classificationTurnFeedback(
  inspection: Pick<ClassificationInspection, 'reviewProposals'> & Partial<Pick<ClassificationInspection, 'issues'>>,
  options?: { purpose?: ClassificationPurpose; services?: string[]; readyForReview?: boolean;
    preservedServices?: string[]; catalogAvailable?: boolean },
): { state: 'CLEAR' | 'ASK_USER' | 'RETRY' | 'PENDING' | 'UNSUPPORTED'; canOfferReview: boolean;
  questions: string[]; notice: string | null; issues: ClassificationIssue[] };

/** Advisory coverage summary; never grants worker consent or matching eligibility. */
export declare function workerServicesMissingScope(skills: unknown, reviewProposals: unknown): {
  count: number; labels: string[];
};
/** Owner-facing finish-only guidance; no profile Save or capability write. */
export declare function workerFinishReviewMessage(skills: unknown, reviewProposals: unknown, catalogAvailable: boolean, mayOfferBio?: boolean): string;
