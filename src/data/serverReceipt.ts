import type { Ishod } from './ports';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';

export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}
export function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2_147_483_647;
}
export function sameId(value: unknown, expected: string): value is string {
  return uuid(value) && value.toLowerCase() === expected.toLowerCase();
}
export function timestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
export function failure(kod: string, poruka: string): Ishod<never> { return { ok: false, kod, poruka }; }

export type ReceiptOptions<T> = {
  decode: (raw: unknown) => T | null;
  errors: Readonly<Record<string, string>>;
  fallback: string;
  invalid: string;
  write?: boolean;
  /** Closed opt-in for read-only local timeout / SDK no-response; never classifies server rejection. */
  readTransportUnavailable?: string;
};
export type ReceiptAccount = { accountId: string; accountRevision: number };

/** RPC wrapper retains the same server authority and receipt validation. */
export function readReceipt<T>(options: ReceiptOptions<T> & {
  account?: ReceiptAccount;
  rpc: string;
  args: Record<string, unknown>;
}): Promise<Ishod<T>> {
  return readOwnedResult({ ...options, request: () => supabaseKlijent().rpc(options.rpc, options.args) });
}

/** Shared Auth/REST/RPC result fence; not a second business writer. An explicit
 * scope keeps every stage of a multi-request command bound to its original user. */
export async function readOwnedResult<T>(options: ReceiptOptions<T> & {
  request: () => PromiseLike<unknown>;
  account?: ReceiptAccount;
  /** Explicit opt-in for AI evaluation/interviews; ordinary RPCs retain15 seconds. */
  timeoutMs?: 55_000;
}): Promise<Ishod<T>> {
  const owner = sesijaSada();
  const accountId = options.account?.accountId ?? owner.user?.id;
  const accountRevision = options.account?.accountRevision ?? owner.accountRevision;
  if (!accountId) return failure('AUTH_REQUIRED', 'Prijavi se da nastaviš.');
  const current = () => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const changed = () => failure('AUTH_ACCOUNT_CHANGED', 'Nalog je promenjen. Ponovo otvori zadatak.');
  const unconfirmed = () => failure(options.fallback, options.write
    ? 'Ishod radnje nije potvrđen. Osveži prikaz pre ponovnog pokušaja.'
    : 'Podaci trenutno nisu dostupni. Proveri vezu i pokušaj ponovo.');
  if (!current()) return changed();
  const localTimeout = new Error('RPC_RECEIPT_TIMEOUT');
  const transportUnavailable = () => !options.write && options.readTransportUnavailable
    ? failure(options.readTransportUnavailable, 'Veza je prekinuta. Pokušaj ponovo.') : unconfirmed();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // No automatic write replay. A timeout bounds the caller, not server execution.
    const response: unknown = await Promise.race([
      Promise.resolve(options.request()),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(localTimeout), options.timeoutMs ?? 15_000); }),
    ]);
    if (!current()) return changed();
    const result = record(response);
    if (!result || !Object.prototype.hasOwnProperty.call(result, 'error')) return unconfirmed();
    if (result.error !== null) {
      const error = record(result.error);
      const name = error?.message;
      // Never turn arbitrary backend/provider text into a public code or message.
      if (typeof name === 'string' && Object.prototype.hasOwnProperty.call(options.errors, name)) return failure(name, options.errors[name]);
      // PostgREST's own no-response sentinel. HTTP/auth/server errors keep the generic fail-closed path.
      if (result.status === 0 && result.data === null && error?.code === '') return transportUnavailable();
      return unconfirmed();
    }
    const decoded = options.decode(result.data);
    if (decoded === null) return failure(options.invalid, options.write
      ? 'Potvrda radnje nije stigla cela. Osveži prikaz pre ponovnog pokušaja.'
      : 'Podaci nisu stigli u ispravnom obliku. Pokušaj ponovo.');
    return { ok: true, podatak: decoded };
  } catch (error) {
    if (!current()) return changed();
    return error === localTimeout ? transportUnavailable() : unconfirmed();
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
