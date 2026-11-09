import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { readOwnedResult } from './serverReceipt';
import { decodeHomeAgreementsSummary, decodeHomeAgreementPromptPage, validHomeAgreementPromptRequest,
  type HomeAgreementsSummary, type HomeAgreementPromptPage, type HomeAgreementPromptPageRequest } from './homeAgreementsContract';

const errors = {
  AUTH_REQUIRED: 'Prijavite se da otvorite svoj pregled.',
  ACCOUNT_NOT_OPEN: 'Pregled naloga trenutno nije dostupan.',
  ACCOUNT_CLOSING: 'Nalog je u postupku zatvaranja.',
  HOME_PROMPTS_EXPIRED: 'Osvežite pregled obaveza.',
} as const;

/** Explicit bounded reads only; no fallback to complete history and no automatic
 * pagination/retry. Home owns refresh and the on-demand panel's cursor lifetime. */
export const homeAgreementsClientService = {
  async summary(options: { signal?: AbortSignal } = {}): Promise<HomeAgreementsSummary> {
    const session = sesijaSada(), account = { accountId: session.user?.id ?? '', accountRevision: session.accountRevision };
    const result = await readOwnedResult({ account, signal: options.signal, errors,
      fallback: 'HOME_AGREEMENTS_UNAVAILABLE', invalid: 'HOME_AGREEMENTS_INVALID',
      decode: raw => decodeHomeAgreementsSummary(raw, account.accountId),
      request: signal => supabaseKlijent().rpc('rpc_home_agreements_summary_v1', {}).abortSignal(signal) });
    if (!result.ok) throw new Error(result.kod);
    return result.podatak;
  },
  async promptsPage(request: HomeAgreementPromptPageRequest): Promise<HomeAgreementPromptPage> {
    const session = sesijaSada(), account = { accountId: session.user?.id ?? '', accountRevision: session.accountRevision };
    const asked = { limit: request.limit, cursor: request.cursor ? { ...request.cursor } : null };
    if (!validHomeAgreementPromptRequest(asked, account.accountId)) throw new Error('HOME_PROMPTS_INVALID_PAGE');
    const result = await readOwnedResult({ account, signal: request.signal, errors,
      fallback: 'HOME_PROMPTS_UNAVAILABLE', invalid: 'HOME_PROMPTS_INVALID',
      decode: raw => decodeHomeAgreementPromptPage(raw, asked, account.accountId),
      request: signal => supabaseKlijent().rpc('rpc_home_agreement_prompts_page_v1', {
        p_limit: asked.limit, p_cursor: asked.cursor,
      }).abortSignal(signal) });
    if (!result.ok) throw new Error(result.kod);
    return result.podatak;
  },
};
