import type { classificationTurnFeedback } from './classificationGeminiShadow.mjs';
export declare function withClassificationFeedback<T extends { safety: string; assistantMessage: string; dialogue?: { next: string; questionKey: string } }>(
  turn: T, feedback: ReturnType<typeof classificationTurnFeedback> | null,
  options?: { finishOnly?: boolean; maximum?: number },
): T;
