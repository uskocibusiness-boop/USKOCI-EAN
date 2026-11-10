import { AI_CREDITS_UNAVAILABLE, AI_CREDITS_UNAVAILABLE_COPY } from '../contracts/aiAvailability';
import { sesijaSada } from '../store/sesija';
import { requestAiTurnStream, type AiTurnStreamOptions } from './aiNeedTurnStream';
import type { Ishod } from './ports';
import { readPublicSupabaseConfig } from './publicSupabaseConfig';
import { failure, readOwnedResult, record, sameId, uuid } from './serverReceipt';

const STATES = ['PREPARED', 'ABSENT', 'CLOSED', 'READ_ONLY', 'EXPIRED', 'STALE', 'ERASED', 'NOT_ADMITTED', 'UNAVAILABLE'] as const;
export type AiPreparedRecovery = Readonly<{
  schemaVersion: 'AI_PREPARED_RECOVERY_V1'; conversationId: string; clientRequestId: string;
  state: typeof STATES[number]; canResume: boolean; authoritative: true;
}>;
type Endpoint = 'uskoci-ai-interview' | 'uskoci-worker-interview';

/** Capability metadata only. A read never returns or recreates the saved prompt. */
export function decodeAiPreparedRecovery(raw: unknown, conversationId: string, clientRequestId: string): AiPreparedRecovery | null {
  const value = record(raw);
  const keys = ['schemaVersion', 'conversationId', 'clientRequestId', 'state', 'canResume', 'authoritative'];
  if (!value || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
    || value.schemaVersion !== 'AI_PREPARED_RECOVERY_V1' || !sameId(value.conversationId, conversationId)
    || !sameId(value.clientRequestId, clientRequestId) || !STATES.includes(value.state as typeof STATES[number])
    || typeof value.canResume !== 'boolean' || value.authoritative !== true
    || (value.canResume && value.state !== 'PREPARED')) return null;
  return value as AiPreparedRecovery;
}

/** Both existing interview owners share bounded transport, while keeping their own final receipt decoder. */
async function preparedRequest<T>(endpoint: Endpoint, mode: 'CHECK_PREPARED' | 'RESUME_PREPARED',
  conversationId: string, clientRequestId: string, decode: (raw: unknown) => T | null,
  stream?: AiTurnStreamOptions): Promise<Ishod<T>> {
  const session = sesijaSada(), config = readPublicSupabaseConfig();
  if (!session.user || !session.session?.access_token || !config?.url || !config.anonKey)
    return failure('AUTH_REQUIRED', 'Prijavite se da nastavite.');
  if (!uuid(conversationId) || !uuid(clientRequestId)) return failure('AI_TURN_IDENTITY_INVALID', 'Ponovo otvorite razgovor.');
  const account = { accountId: session.user.id, accountRevision: session.accountRevision };
  const current = () => sesijaSada().user?.id === account.accountId && sesijaSada().accountRevision === account.accountRevision;
  const resume = mode === 'RESUME_PREPARED', deadline = Date.now() + (resume ? 55_000 : 15_000);
  return readOwnedResult({ account, signal: stream?.signal, write: resume, ...(resume ? { timeoutMs: 55_000 as const } : {}),
    errors: { AUTH_REQUIRED: 'Prijavite se da nastavite.', AI_SERVICE_UNAVAILABLE: 'AI trenutno nije dostupan.',
      [AI_CREDITS_UNAVAILABLE]: AI_CREDITS_UNAVAILABLE_COPY },
    fallback: 'AI_PREPARED_RECOVERY_NOT_CONFIRMED', invalid: 'AI_PREPARED_RECOVERY_INVALID_RESPONSE', decode,
    request: signal => requestAiTurnStream({ endpoint, preparedMode: mode, conversationId, clientRequestId,
      text: '', url: config.url, anonKey: config.anonKey, accessToken: session.session!.access_token,
      deadline, current, signal, onText: resume ? stream?.onText ?? (() => {}) : () => {} }),
  });
}

export const checkAiPreparedRecovery = (endpoint: Endpoint, conversationId: string, clientRequestId: string) =>
  preparedRequest(endpoint, 'CHECK_PREPARED', conversationId, clientRequestId,
    raw => decodeAiPreparedRecovery(raw, conversationId, clientRequestId));

export const resumeAiPreparedRecovery = <T>(endpoint: Endpoint, conversationId: string, clientRequestId: string,
  decode: (raw: unknown) => T | null, stream: AiTurnStreamOptions) =>
  preparedRequest(endpoint, 'RESUME_PREPARED', conversationId, clientRequestId, decode, stream);
