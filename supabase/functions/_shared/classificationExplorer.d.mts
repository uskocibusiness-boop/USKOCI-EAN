import type { CatalogSnapshot, RpcClient } from './classificationEngine.mjs';
export declare const taxonomyToolDeclaration: {
  name: string; description: string; parameters: Record<string, unknown>;
};
export type ClassificationExplorer = {
  readonly catalogVersion: number; readonly catalogFingerprint: string;
  readonly queryCount: number; readonly evidenceBytes: number;
  canTryDirectReply(): boolean;
  prompt(): string;
  execute(args: Record<string, unknown>, context?: { signal?: AbortSignal }): Promise<unknown>;
  verify(raw: unknown, options?: { services?: string[]; categoryIds?: string[] }): Promise<CatalogSnapshot>;
};
export declare function createClassificationExplorer(rpc: RpcClient, options?: {
  signal?: AbortSignal; seedServices?: string[]; seedCategoryIds?: string[];
  pageSize?: number; maxPageBytes?: number; maxEvidenceBytes?: number; maxQueries?: number;
}): Promise<ClassificationExplorer>;
