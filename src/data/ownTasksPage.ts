import type { PotrebaProjekcija } from '../contracts/projections';
import type { MarketplaceView, OwnedTaskCounts, OwnTasksScope } from './marketplaceView';
export { ownTasksScope } from './marketplaceView';
export type { OwnTasksScope } from './marketplaceView';
import { record, timestamp, uuid } from './serverReceipt';

/**
 * EX-04 S1 (A09 Moji zadaci). The server's own sets of my tasks, one keyset page at a time: the three tabs (Aktivni, Nacrti, Istorija), all of them,
 * and the tasks that wait for my choice. Every item of a page IS the `rpc_read_task` document the whole-list read returns, so the card, the price
 * basis and the selectable count are the ones `mapNeed` already reads; `sortAt` is the keyset value. Pure and React-free: the pager, the service and
 * the fake source share it.
 */
export type OwnTasksCursor = { at: string; id: string };
export type OwnTasksPageRequest = { scope: OwnTasksScope; limit: number; cursor: OwnTasksCursor | null };
export type OwnTasksPage = {
  items: PotrebaProjekcija[]; hasMore: boolean;
  /** The five counts of the sets, only on the first page of a read; a later page never carries them. */
  counts: OwnedTaskCounts | null;
  /** Where the next page starts: the last item of this one. Null on an empty page. */
  cursor: OwnTasksCursor | null; asOf: string };

/** The server accepts 1..100; thirty cards are a few screens of this list. */
export const OWN_TASKS_PAGE_LIMIT = 30;
/** One validated task document of a page: the `rpc_read_task` document plus the keyset value. */
export type OwnTaskDocument = Record<string, unknown> & { id: string; sortAt: string };
const SCOPES: readonly OwnTasksScope[] = ['ALL', 'ACTIVE', 'DRAFTS', 'HISTORY', 'WAITING'];
export const isOwnTasksScope = (value: unknown): value is OwnTasksScope => SCOPES.includes(value as OwnTasksScope);

/** Search and the price filter are refinements of the loaded set: while one is on, the rest of the set is read so the answer is complete. */
export const ownTasksRefined = (view: Pick<MarketplaceView, 'query' | 'price'>): boolean => view.query.trim() !== '' || view.price !== 'all';

const COUNT_KEYS = ['total', 'active', 'drafts', 'history', 'waiting'] as const;

// PostgreSQL keyset order is (created_at DESC, id DESC). Date.parse truncates
// fractional seconds to milliseconds; compare the remaining microseconds
// separately so two recent writes never swap order or repeat a cursor.
// All accepted server instants have an explicit UTC offset.
const KEYSET_INSTANT = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;
function keysetInstant(value: string): { secondsMs: number; micros: number } {
  const match = KEYSET_INSTANT.exec(value)!; // caller already ran timestamp()
  return { secondsMs: Date.parse(match[1] + match[3]), micros: Number((match[2] ?? '').padEnd(6, '0')) };
}
function strictlyBeforeCursor(next: OwnTasksCursor, previous: OwnTasksCursor): boolean {
  const a = keysetInstant(next.at), b = keysetInstant(previous.at);
  if (a.secondsMs !== b.secondsMs) return a.secondsMs < b.secondsMs;
  if (a.micros !== b.micros) return a.micros < b.micros;
  return next.id.toLowerCase() < previous.id.toLowerCase();
}

/**
 * Strict: anything that does not add up is no answer, never a short or a guessed one. The documents are mapped by the caller's `map` (the one
 * `mapNeed` the whole-list read uses), so an invalid task document makes the page invalid and is never skipped.
 */
export function decodeOwnTasksPage(raw: unknown, request: Pick<OwnTasksPageRequest, 'limit' | 'cursor'>, map: (document: any) => PotrebaProjekcija):
  (OwnTasksPage & { documents: OwnTaskDocument[] }) | null {
  const data = record(raw);
  if (!Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 100
      || (request.cursor !== null && (!record(request.cursor)
        || !timestamp(request.cursor.at) || !uuid(request.cursor.id)))) return null;
  if (!data || !Array.isArray(data.items) || typeof data.hasMore !== 'boolean' || !timestamp(data.asOf) || data.items.length > request.limit
      || (data.hasMore && data.items.length !== request.limit)) return null;
  let counts: OwnedTaskCounts | null = null;
  if (request.cursor === null) {
    const c = record(data.counts);
    if (!c || !COUNT_KEYS.every(key => Number.isSafeInteger(c[key]) && (c[key] as number) >= 0)) return null;
    const n = c as Record<typeof COUNT_KEYS[number], number>;
    // The three tabs partition my tasks, and what waits for my choice is active.
    if (n.active + n.drafts + n.history !== n.total || n.waiting > n.active) return null;
    counts = { total: n.total, active: n.active, waiting: n.waiting, drafts: n.drafts, history: n.history };
  } else if (data.counts !== null && data.counts !== undefined) return null;
  const items: PotrebaProjekcija[] = [], documents: OwnTaskDocument[] = [], seen = new Set<string>();
  let previous: OwnTasksCursor | null = request.cursor;
  for (const value of data.items) {
    const document = record(value);
    if (!document || !uuid(document.id) || !timestamp(document.sortAt) || seen.has(document.id.toLowerCase())) return null;
    const next = { at: document.sortAt, id: document.id };
    if (previous && !strictlyBeforeCursor(next, previous)) return null;
    previous = next;
    seen.add(document.id.toLowerCase());
    let mapped:PotrebaProjekcija;
    try { mapped=map(document); } catch { return null; }
    // The public owner reader's cursor/document identity and the rendered task
    // identity are one authority. A mismatched mapper output must never become
    // an actionable row under a different task ID.
    if(!mapped||!uuid(mapped.id)||mapped.id.toLowerCase()!==document.id.toLowerCase())return null;
    items.push(mapped);
    documents.push(document as OwnTaskDocument);
  }
  // A page that promises more and gives none could never advance.
  if (data.hasMore && items.length === 0) return null;
  const last = documents[documents.length - 1];
  return { items, documents, hasMore: data.hasMore, counts, asOf: data.asOf,
    cursor: last ? { at: last.sortAt, id: last.id } : null };
}
