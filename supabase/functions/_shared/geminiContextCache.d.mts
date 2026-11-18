export interface GeminiContextCacheOptions {
  geminiApiKey: string;
  catalogVersion: number;
  catalogFingerprint: string;
  systemInstructionParts: Array<{ text: string }>;
  model?: string;
  signal?: AbortSignal;
  purpose: 'NEED_SERVICE' | 'WORKER_CAPABILITY';
  fetcher?: typeof fetch;
}

export function getOrCreateGeminiContextCache(options: GeminiContextCacheOptions): Promise<string | null>;
export function clearActiveGeminiCacheHandles(): void;
