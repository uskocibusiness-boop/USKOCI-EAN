import type { ServiceHandoff } from './serviceHandoff.mjs';

export type DirectClassificationChoice = {
  service: string;
  modes: ('ON_SITE' | 'REMOTE')[];
  handoff?: ServiceHandoff;
};
/** Caller must inspect current output against fresh catalog evidence and apply
 * typed/intent guards first. This boolean grants no Save or matching authority. */
export declare function canAcceptDirectClassification(input: {
  inspection: {
    statuses: string[];
    reviewProposals: Record<string, any>[];
    invalidPlanCodes: string[];
    issues: Record<string, any>[];
  };
  services: string[];
  purpose: 'WORKER_CAPABILITY' | 'NEED_SERVICE';
  safety: 'ALLOW' | 'CLARIFY' | 'REVIEW' | 'BLOCK';
  expectedServiceModes?: DirectClassificationChoice[];
  taskMode?: 'ON_SITE' | 'REMOTE' | null;
  taskHandoff?: unknown;
}): boolean;
