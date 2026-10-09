import { NEED_FACT_SCHEMA_V2 } from '../contracts/needFactsV2';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { readOwnedResult, record, sameId, timestamp, uuid } from './serverReceipt';

export type OpenIntake = { id: string; createdAt: string };
export type OpenIntakePage = { rows: OpenIntake[]; next: OpenIntake | null };
export const OPEN_INTAKE_PAGE_SIZE = 20;
const FIELDS = ['id', 'account_id', 'purpose', 'status', 'fact_schema_version', 'bound_need_id', 'created_at'] as const;

/** Metadata only: no prompts, addresses or message bodies on Home. Existing SELECT RLS still owns access.
 * Keep PostgreSQL's microseconds in the cursor; Date.toISOString() would skip rows born in the same millisecond. */
export async function listOpenIntakes(before: OpenIntake | null = null): Promise<OpenIntakePage> {
  if (before && (!uuid(before.id) || !timestamp(before.createdAt))) throw new Error('Ponovo otvori započete razgovore.');
  const session = sesijaSada();
  const account = session.user ? { accountId: session.user.id, accountRevision: session.accountRevision } : undefined;
  const result = await readOwnedResult({ account, errors: {}, fallback: 'AI_INTAKE_LIST_UNAVAILABLE', invalid: 'AI_INTAKE_LIST_INVALID',
    request: () => {
      let query = supabaseKlijent().from('ai_conversations').select(FIELDS.join(','))
        .eq('account_id', account!.accountId).eq('purpose', 'NEED_INTAKE').eq('status', 'OPEN')
        .eq('fact_schema_version', NEED_FACT_SCHEMA_V2).is('bound_need_id', null)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(OPEN_INTAKE_PAGE_SIZE + 1);
      // uuid/timestamp above accept no PostgREST punctuation: this raw filter cannot change its structure.
      if (before) query = query.or(`created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`);
      return query;
    },
    decode(raw): OpenIntakePage | null {
      if (!account || !Array.isArray(raw) || raw.length > OPEN_INTAKE_PAGE_SIZE + 1) return null;
      const rows: OpenIntake[] = [], seen = new Set<string>();
      for (const value of raw) {
        const row = record(value);
        if (!row || Object.keys(row).length !== FIELDS.length || !FIELDS.every(key => Object.hasOwn(row, key))
          || !uuid(row.id) || !sameId(row.account_id, account.accountId) || row.purpose !== 'NEED_INTAKE'
          || row.status !== 'OPEN' || row.fact_schema_version !== NEED_FACT_SCHEMA_V2 || row.bound_need_id !== null
          || !timestamp(row.created_at) || seen.has(row.id.toLowerCase())) return null;
        seen.add(row.id.toLowerCase()); rows.push({ id: row.id, createdAt: row.created_at });
      }
      const page = rows.slice(0, OPEN_INTAKE_PAGE_SIZE);
      return { rows: page, next: rows.length > OPEN_INTAKE_PAGE_SIZE ? page[page.length - 1] : null };
    },
  });
  if (!result.ok) throw new Error(result.poruka);
  return result.podatak;
}
