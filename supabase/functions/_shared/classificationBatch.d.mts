import type { CatalogSnapshot, ClassificationPurpose, ClassificationScope } from './classificationEngine.mjs';
export type BatchEntry = {
  purpose: ClassificationPurpose;
  service: string;
  mode?: ClassificationScope | null;
  plan: { action: string; catalogVersion: number; reason: string;
    categoryId?: string; parentId?: string | null; proposedPath?: string[] };
};
export declare function reviewClassificationBatch(
 entries: BatchEntry[], snapshot: CatalogSnapshot, options?: { maxServices?: number }
): {
 accepted:boolean;status:string;catalogVersion?:number;items:Array<{
  index:number;status:string;candidateCategoryId:string|null
 }>;capabilityAuthority:string;notificationAuthority:string;
 commitAuthority:string;requiresOwnerReview:boolean;requiresAtomicBatch:boolean;
};
