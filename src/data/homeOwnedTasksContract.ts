import type { PotrebaProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import { readableTitle } from './needDetailPresentation';
import type { OwnedTaskCounts } from './marketplaceView';
import { record, sameId, timestamp, uuid } from './serverReceipt';

export type HomeOwnedTasksSummary = {
  schemaVersion: 1;
  accountId: string;
  asOf: string;
  counts: OwnedTaskCounts;
  /** The six Home carousel rows, already in the whole-list created_at DESC, id DESC order. */
  items: PotrebaProjekcija[];
  /** The first readable draft updated within the existing seven-day prompt window, even if outside the six rows. */
  freshDraft: PotrebaProjekcija | null;
};

const COUNT_KEYS = ['total', 'active', 'drafts', 'history', 'waiting'] as const;
const SUMMARY_KEYS = ['schemaVersion', 'accountId', 'asOf', 'counts', 'items', 'freshDraft'] as const;
const PREVIEW_STATES = ['OBJAVLJENA', 'U_IZBORU', 'DOGOVORENA', 'U_TOKU'] as const;
const DAY_MS = 86_400_000;
const keys = (value: Record<string, unknown>, expected: readonly string[]) =>
  Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const sameInstant = (a: unknown, b: unknown) => timestamp(a) && timestamp(b) && calendarInstant(a) === calendarInstant(b);
const fresh = (updatedAt: string | null | undefined, asOf: string): boolean => {
  if (typeof updatedAt !== 'string') return true;
  const at = Date.parse(updatedAt), now = Date.parse(asOf);
  return !Number.isFinite(at) || !Number.isFinite(now) || now - at <= 7 * DAY_MS;
};
function before(a: { at: string; id: string }, b: { at: string; id: string }): boolean {
  const aa = calendarInstant(a.at), bb = calendarInstant(b.at);
  if (aa === null || bb === null) return false;
  return aa === bb ? a.id.toLowerCase() > b.id.toLowerCase() : aa > bb;
}
function after(a: { at: string; id: string }, b: { at: string; id: string }): boolean {
  const aa = calendarInstant(a.at), bb = calendarInstant(b.at);
  if (aa === null || bb === null) return false;
  return aa === bb ? a.id.toLowerCase() < b.id.toLowerCase() : aa < bb;
}

/** Strict owner-boundary decoder for the bounded Home task summary. The task mapper remains the same one used by rpc_list_my_tasks. */
export function decodeHomeOwnedTasksSummary(raw: unknown, accountId: string,
  map: (document: Record<string, unknown>) => PotrebaProjekcija): HomeOwnedTasksSummary | null {
  const data = record(raw), counts = record(data?.counts);
  if (!uuid(accountId) || !data || !keys(data, SUMMARY_KEYS) || data.schemaVersion !== 1
    || !sameId(data.accountId, accountId) || !timestamp(data.asOf)
    || !counts || !keys(counts, COUNT_KEYS) || !COUNT_KEYS.every(key => count(counts[key]))
    || (counts.active as number) + (counts.drafts as number) + (counts.history as number) !== counts.total
    || (counts.waiting as number) > (counts.active as number)
    || !Array.isArray(data.items) || data.items.length > 6
    || data.items.length > (counts.active as number) + (counts.drafts as number)
    || data.freshDraft !== null && (counts.drafts as number) === 0) return null;

  const mapped = new Map<string, { item: PotrebaProjekcija; at: string }>();
  const items: PotrebaProjekcija[] = [];
  let previous: { at: string; id: string } | null = null;
  for (const value of data.items) {
    const document = record(value);
    if (!document || !uuid(document.id) || !sameInstant(document.sortAt, document.created_at)) return null;
    const position = { at: document.sortAt as string, id: document.id };
    if (previous && !before(previous, position)) return null;
    previous = position;
    let item: PotrebaProjekcija;
    try { item = map(document); } catch { return null; }
    if (!item || !uuid(item.id) || !sameId(item.id, document.id)) return null;
    const eligible = PREVIEW_STATES.includes(item.stanje as typeof PREVIEW_STATES[number])
      || item.stanje === 'NACRT' && !!readableTitle(item.naslov) && fresh(item.azurirano, data.asOf);
    if (!eligible || mapped.has(item.id.toLowerCase())) return null;
    mapped.set(item.id.toLowerCase(), { item, at: position.at });
    items.push(item);
  }

  let freshDraft: PotrebaProjekcija | null = null;
  let freshPosition: { at: string; id: string } | null = null;
  if (data.freshDraft !== null) {
    const document = record(data.freshDraft);
    if (!document || !uuid(document.id) || !sameInstant(document.sortAt, document.created_at)) return null;
    try { freshDraft = map(document); } catch { return null; }
    if (!freshDraft || !sameId(freshDraft.id, document.id) || freshDraft.stanje !== 'NACRT'
      || !readableTitle(freshDraft.naslov) || !fresh(freshDraft.azurirano, data.asOf)) return null;
    freshPosition = { at: document.sortAt as string, id: document.id };
  }

  const firstDraft = items.find(item => item.stanje === 'NACRT');
  const previewDraftCount = items.filter(item => item.stanje === 'NACRT').length;
  if (previewDraftCount > (counts.drafts as number)
    || items.length - previewDraftCount > (counts.active as number)) return null;
  if (firstDraft && (!freshDraft || !sameId(firstDraft.id, freshDraft.id))) return null;
  if (freshDraft && mapped.has(freshDraft.id.toLowerCase())) {
    const preview = mapped.get(freshDraft.id.toLowerCase())!;
    if (preview.at !== freshPosition?.at || preview.item.naslov !== freshDraft.naslov
      || preview.item.azurirano !== freshDraft.azurirano) return null;
  }
  if (!firstDraft && freshDraft && !mapped.has(freshDraft.id.toLowerCase())) {
    const last = items[items.length - 1];
    if (items.length !== 6 || !last) return null;
    const lastPosition = { at: mapped.get(last.id.toLowerCase())!.at, id: last.id };
    if (!after(freshPosition!, lastPosition)) return null;
  }
  if (!freshDraft && items.some(item => item.stanje === 'NACRT')) return null;

  return { schemaVersion: 1, accountId: data.accountId, asOf: data.asOf,
    counts: { total: counts.total as number, active: counts.active as number, drafts: counts.drafts as number,
      history: counts.history as number, waiting: counts.waiting as number }, items, freshDraft };
}
