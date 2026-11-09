import { calendarInstant } from '../lib/calendarTime';
import { positiveInteger, record, sameId, timestamp, uuid } from './serverReceipt';

export type HomeAgreementPrompt = {
  id: string; needId: string; version: number; title: string;
  reason: 'CHANGE' | 'TERM'; changeId: string | null; createdAt: string;
};
export type HomeNextAgreement = {
  id: string; needId: string; version: number; title: string; role: 'narucilac' | 'uskocer';
  counterpartProfileId: string; counterpartName: string | null; startAt: string; endAt: string | null;
};
export type HomeAgreementsSummary = {
  schemaVersion: 1; accountId: string; asOf: string;
  counts: { hasAny: boolean; active: number; upcoming: number; withoutExactTerm: number; awaitingFinish: number; remainingThisWeek: number };
  next: HomeNextAgreement | null;
  ratings: { due: number; agreementId: string | null };
  prompts: { total: number; changes: number; terms: number; items: HomeAgreementPrompt[] };
};
/** Position uses immutable creation time/id. Current prompt eligibility is live,
 * never an implied snapshot across requests. A new visit starts at cursor=null. */
export type HomeAgreementPromptCursor = {
  schemaVersion: 1; accountId: string; viewAt: string; at: string; id: string;
};
export type HomeAgreementPromptPageRequest = { limit: number; cursor: HomeAgreementPromptCursor | null; signal?: AbortSignal };
export type HomeAgreementPromptPage = {
  schemaVersion: 1; accountId: string; asOf: string; viewAt: string;
  counts: { total: number; remaining: number };
  items: HomeAgreementPrompt[]; hasMore: boolean; nextCursor: HomeAgreementPromptCursor | null;
};
export const HOME_AGREEMENT_PROMPT_PAGE_LIMIT = 20;

const keys = (value: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const sameInstant = (a: unknown, b: unknown) => timestamp(a) && timestamp(b) && calendarInstant(a) === calendarInstant(b);
const before = (a: { at: string; id: string }, b: { at: string; id: string }) => {
  const aa = calendarInstant(a.at)!, bb = calendarInstant(b.at)!;
  return aa > bb || aa === bb && a.id.toLowerCase() > b.id.toLowerCase();
};

function prompt(value: unknown, asOf: string): HomeAgreementPrompt | null {
  const row = record(value);
  if (!row || !keys(row, ['id', 'needId', 'version', 'title', 'reason', 'changeId', 'createdAt'])
    || !uuid(row.id) || !uuid(row.needId) || !positiveInteger(row.version) || typeof row.title !== 'string'
    || !['CHANGE', 'TERM'].includes(row.reason as string)
    || (row.reason === 'CHANGE' ? !uuid(row.changeId) : row.changeId !== null)
    || !timestamp(row.createdAt) || calendarInstant(row.createdAt)! > calendarInstant(asOf)!) return null;
  return { ...row } as HomeAgreementPrompt;
}

function cursor(value: unknown, accountId: string): value is HomeAgreementPromptCursor {
  const row = record(value);
  return !!row && keys(row, ['schemaVersion', 'accountId', 'viewAt', 'at', 'id']) && row.schemaVersion === 1
    && sameId(row.accountId, accountId) && uuid(row.id) && timestamp(row.viewAt) && timestamp(row.at)
    && calendarInstant(row.at)! <= calendarInstant(row.viewAt)!;
}

export function validHomeAgreementPromptRequest(value: HomeAgreementPromptPageRequest, accountId: string): boolean {
  return uuid(accountId) && Number.isInteger(value.limit) && value.limit >= 1 && value.limit <= 30
    && (value.cursor === null || cursor(value.cursor, accountId));
}

/** Counts and featured row come from one statement over all my Agreements.
 * A first ACTIVE page cannot manufacture this contract. Private terms, addresses
 * and phones are intentionally absent from this Home-only projection. */
export function decodeHomeAgreementsSummary(raw: unknown, accountId: string): HomeAgreementsSummary | null {
  const data = record(raw), c = record(data?.counts), ratings = record(data?.ratings), prompts = record(data?.prompts);
  if (!uuid(accountId) || !data || !keys(data, ['schemaVersion', 'accountId', 'asOf', 'counts', 'next', 'ratings', 'prompts'])
    || data.schemaVersion !== 1 || !sameId(data.accountId, accountId) || !timestamp(data.asOf)
    || !c || !keys(c, ['hasAny', 'active', 'upcoming', 'withoutExactTerm', 'awaitingFinish', 'remainingThisWeek'])
    || typeof c.hasAny !== 'boolean' || !['active', 'upcoming', 'withoutExactTerm', 'awaitingFinish', 'remainingThisWeek'].every(key => count(c[key]))
    || !ratings || !keys(ratings, ['due', 'agreementId']) || !count(ratings.due)
    || (ratings.due === 1 ? !uuid(ratings.agreementId) : ratings.agreementId !== null)
    || !prompts || !keys(prompts, ['total', 'changes', 'terms', 'items'])
    || !['total', 'changes', 'terms'].every(key => count(prompts[key])) || !Array.isArray(prompts.items)) return null;
  const counts = c as HomeAgreementsSummary['counts'];
  const totals = prompts as unknown as HomeAgreementsSummary['prompts'];
  if (counts.upcoming > counts.active || counts.withoutExactTerm + counts.awaitingFinish > counts.active
    || counts.upcoming + counts.awaitingFinish > counts.active || counts.remainingThisWeek > Math.max(0, counts.upcoming - 1)
    || !counts.hasAny && (counts.active > 0 || ratings.due > 0)
    || totals.total !== totals.changes + totals.terms || totals.total > counts.active
    || totals.items.length !== Math.min(4, totals.total)) return null;

  let next: HomeNextAgreement | null = null;
  if (data.next !== null) {
    const row = record(data.next);
    if (!row || !keys(row, ['id', 'needId', 'version', 'title', 'role', 'counterpartProfileId', 'counterpartName', 'startAt', 'endAt'])
      || !uuid(row.id) || !uuid(row.needId) || !positiveInteger(row.version) || typeof row.title !== 'string'
      || !['narucilac', 'uskocer'].includes(row.role as string) || !uuid(row.counterpartProfileId)
      || !(row.counterpartName === null || typeof row.counterpartName === 'string')
      || !timestamp(row.startAt) || !(row.endAt === null || timestamp(row.endAt))) return null;
    const start = calendarInstant(row.startAt)!, end = row.endAt === null ? null : calendarInstant(row.endAt)!;
    if (end === null ? start < calendarInstant(data.asOf)! : end <= start || end <= calendarInstant(data.asOf)!) return null;
    next = { ...row } as HomeNextAgreement;
  }
  if ((next === null) !== (counts.upcoming === 0)) return null;

  const items: HomeAgreementPrompt[] = [], seen = new Set<string>();
  for (const value of totals.items) {
    const row = prompt(value, data.asOf), last = items.at(-1);
    if (!row || seen.has(row.id.toLowerCase())) return null;
    if (last && (last.reason === 'TERM' && row.reason === 'CHANGE'
      || last.reason === row.reason && !before({ at: last.createdAt, id: last.id }, { at: row.createdAt, id: row.id }))) return null;
    seen.add(row.id.toLowerCase()); items.push(row);
  }
  if (items.filter(row => row.reason === 'CHANGE').length > totals.changes
    || items.filter(row => row.reason === 'TERM').length > totals.terms) return null;
  return { schemaVersion: 1, accountId: data.accountId, asOf: data.asOf, counts: { ...counts }, next,
    ratings: { due: ratings.due, agreementId: ratings.agreementId as string | null },
    prompts: { total: totals.total, changes: totals.changes, terms: totals.terms, items } };
}

export function decodeHomeAgreementPromptPage(raw: unknown, request: HomeAgreementPromptPageRequest,
  accountId: string): HomeAgreementPromptPage | null {
  if (!validHomeAgreementPromptRequest(request, accountId)) return null;
  const data = record(raw), c = record(data?.counts);
  if (!data || !keys(data, ['schemaVersion', 'accountId', 'asOf', 'viewAt', 'counts', 'items', 'hasMore', 'nextCursor'])
    || data.schemaVersion !== 1 || !sameId(data.accountId, accountId) || !timestamp(data.asOf) || !timestamp(data.viewAt)
    || calendarInstant(data.viewAt)! > calendarInstant(data.asOf)!
    || calendarInstant(data.asOf)! - calendarInstant(data.viewAt)! > 1_800_000_000n
    || request.cursor && !sameInstant(data.viewAt, request.cursor.viewAt)
    || !c || !keys(c, ['total', 'remaining']) || !count(c.total) || !count(c.remaining) || c.remaining > c.total
    || request.cursor === null && c.remaining !== c.total
    || !Array.isArray(data.items) || data.items.length !== Math.min(request.limit, c.remaining)
    || typeof data.hasMore !== 'boolean' || data.hasMore !== (c.remaining > request.limit)) return null;
  const items: HomeAgreementPrompt[] = [];
  let position = request.cursor ? { at: request.cursor.at, id: request.cursor.id } : null;
  for (const value of data.items) {
    const row = prompt(value, data.viewAt);
    if (!row || position && !before(position, { at: row.createdAt, id: row.id })) return null;
    position = { at: row.createdAt, id: row.id }; items.push(row);
  }
  let nextCursor: HomeAgreementPromptCursor | null = null;
  if (data.hasMore) {
    if (!position || !cursor(data.nextCursor, accountId) || !sameInstant(data.nextCursor.viewAt, data.viewAt)
      || !sameId(data.nextCursor.id, position.id) || !sameInstant(data.nextCursor.at, position.at)) return null;
    nextCursor = { ...data.nextCursor };
  } else if (data.nextCursor !== null) return null;
  return { schemaVersion: 1, accountId: data.accountId, asOf: data.asOf, viewAt: data.viewAt,
    counts: { total: c.total, remaining: c.remaining }, items, hasMore: data.hasMore, nextCursor };
}
