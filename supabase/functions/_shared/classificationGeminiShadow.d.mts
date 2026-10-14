import type { CatalogSnapshot, ClassificationPurpose } from './classificationEngine.mjs';
export declare function withGeminiClassificationShadowSchema<T extends { type: string; properties: Record<string, unknown>; required?: string[] }>(baseSchema: T): T;
export declare function geminiClassificationShadowInstruction(): string;
export declare function inspectGeminiClassificationShadow(
  raw: unknown, snapshot: CatalogSnapshot, purpose: ClassificationPurpose,
): { output: unknown; statuses: string[] };
