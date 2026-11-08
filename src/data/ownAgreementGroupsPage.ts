import type { DogovorProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import { record, sameId, uuid } from './serverReceipt';
import { agreementSearchQuery, agreementGroupMatchesSearch } from '../ui/agreements/agreementSearch';
import { normalizedPlaceText } from '../ui/location/placeText';
import { agreementTaskKey, isActiveAgreementTask, awaitsMyConfirmation, filterHistory } from '../ui/agreements/agreementListModel';

export type OwnAgreementView = {
  section: 'active' | 'history'; role: 'all' | 'narucilac' | 'uskocer';
  outcome: 'all' | 'completed' | 'cancelled'; confirmationOnly: boolean; query: string;
};
export type OwnAgreementGroup = {
  key: string; needId: string; role: 'narucilac' | 'uskocer'; rank: number; sortAt: string; items: DogovorProjekcija[];
};
export type OwnAgreementCursor = {
  rank: number; at: string; id: string; role: 'narucilac' | 'uskocer'; viewAt: string; view: OwnAgreementView;
};
export type OwnAgreementCounts = {
  matching: number; attention: number; confirmation: number; active: number; activeAttention: number; history: number;
  hasAny: boolean; hasBothRoles: boolean; historyInActive: boolean;
  /** Client binding: a cached view cannot borrow another view's counts. */
  viewKey: string;
};
export type OwnAgreementPageRequest = { view: OwnAgreementView; limit: number; cursor: OwnAgreementCursor | null; signal?: AbortSignal };
export type OwnAgreementPage = {
  items: OwnAgreementGroup[]; hasMore: boolean; counts: OwnAgreementCounts | null; cursor: OwnAgreementCursor | null; asOf: string;
};
export const OWN_AGREEMENT_PAGE_LIMIT = 20;

/** One scope per visible view; changing a filter cannot reuse a foreign cursor. */
export function ownAgreementView(input: OwnAgreementView): OwnAgreementView {
  return { section: input.section, role: input.role, outcome: input.section === 'history' ? input.outcome : 'all',
    confirmationOnly: input.section === 'active' && input.confirmationOnly, query: agreementSearchQuery(input.query) };
}
export const ownAgreementScope = (view: OwnAgreementView): string => JSON.stringify([
  view.section, view.role, view.outcome, view.confirmationOnly, view.query,
]);
export function ownAgreementViewFromScope(scope: string): OwnAgreementView {
  const [section, role, outcome, confirmationOnly, query] = JSON.parse(scope);
  const view = { section, role, outcome, confirmationOnly, query };
  if (!validView(view) || ownAgreementScope(view) !== scope) throw new Error('AGREEMENT_PAGE_INVALID_REQUEST');
  return view;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
const VIEW_KEYS = ['section', 'role', 'outcome', 'confirmationOnly', 'query'] as const;
function validView(value: unknown): value is OwnAgreementView {
  const view = record(value);
  return !!view && exactKeys(view, VIEW_KEYS) && ['active', 'history'].includes(view.section as string)
    && ['all', 'narucilac', 'uskocer'].includes(view.role as string) && ['all', 'completed', 'cancelled'].includes(view.outcome as string)
    && typeof view.confirmationOnly === 'boolean' && typeof view.query === 'string' && view.query.length <= 480
    && normalizedPlaceText(view.query) === view.query
    && (view.section !== 'active' || view.outcome === 'all') && (view.section !== 'history' || !view.confirmationOnly);
}
function validCursor(value: unknown, view: OwnAgreementView): value is OwnAgreementCursor {
  const cursor = record(value);
  return !!cursor && exactKeys(cursor, ['rank', 'at', 'id', 'role', 'viewAt', 'view'])
    && Number.isInteger(cursor.rank) && (cursor.rank as number) >= 0 && (cursor.rank as number) <= 6
    && (view.section !== 'history' || cursor.rank === 0)
    && typeof cursor.at === 'string' && calendarInstant(cursor.at) !== null && uuid(cursor.id)
    && ['narucilac', 'uskocer'].includes(cursor.role as string)
    && typeof cursor.viewAt === 'string' && calendarInstant(cursor.viewAt) !== null
    && validView(cursor.view) && ownAgreementScope(cursor.view) === ownAgreementScope(view);
}
export function isOwnAgreementPageRequest(value: OwnAgreementPageRequest): boolean {
  return validView(value.view) && Number.isInteger(value.limit) && value.limit >= 1 && value.limit <= 30
    && (value.cursor === null || validCursor(value.cursor, value.view));
}
type Position = Pick<OwnAgreementCursor, 'rank' | 'at' | 'id' | 'role'>;
/** Same keyset as SQL: active attention/day then accepted instant; history newest first. */
function compare(a: Position, b: Position, section: OwnAgreementView['section']): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const aa = calendarInstant(a.at)!, bb = calendarInstant(b.at)!;
  if (aa !== bb) return (aa < bb ? -1 : 1) * (section === 'history' ? -1 : 1);
  const aid = a.id.toLowerCase(), bid = b.id.toLowerCase();
  return aid !== bid ? aid < bid ? -1 : 1 : a.role === b.role ? 0 : a.role < b.role ? -1 : 1;
}

/** Execute the normal Agreement mapper, then validate complete groups and ownership.
 * Unknown/malformed pages fail, never become a shorter successful history. */
export function decodeOwnAgreementPage(raw: unknown, request: OwnAgreementPageRequest, accountId: string,
  map: (document: any, accountId: string) => DogovorProjekcija): OwnAgreementPage | null {
  if (!isOwnAgreementPageRequest(request) || !uuid(accountId)) return null;
  const data = record(raw);
  if (!data || !validView(data.view) || ownAgreementScope(data.view) !== ownAgreementScope(request.view)
    || typeof data.viewAt !== 'string' || calendarInstant(data.viewAt) === null
    || typeof data.asOf !== 'string' || calendarInstant(data.asOf) === null
    || calendarInstant(data.viewAt)! > calendarInstant(data.asOf)!
    || request.cursor && calendarInstant(data.viewAt) !== calendarInstant(request.cursor.viewAt)
    || !Array.isArray(data.groups) || data.groups.length > request.limit || typeof data.hasMore !== 'boolean'
    || data.hasMore && data.groups.length !== request.limit) return null;
  let counts: OwnAgreementCounts | null = null;
  if (!request.cursor) {
    const c = record(data.counts);
    const numbers = ['matching', 'attention', 'confirmation', 'active', 'activeAttention', 'history'] as const;
    const flags = ['hasAny', 'hasBothRoles', 'historyInActive'] as const;
    if (!c || !exactKeys(c, [...numbers, ...flags])
      || !numbers.every(key => Number.isSafeInteger(c[key]) && (c[key] as number) >= 0)
      || !flags.every(key => typeof c[key] === 'boolean')) return null;
    counts = { ...c, viewKey: ownAgreementScope(request.view) } as OwnAgreementCounts;
    if (counts.attention > counts.matching || counts.confirmation > counts.matching || counts.activeAttention > counts.active
      || counts.matching > (request.view.section === 'active' ? counts.active : counts.history)
      || !counts.hasAny && (counts.active + counts.history > 0 || counts.hasBothRoles || counts.historyInActive)
      || counts.matching < data.groups.length || data.hasMore !== (counts.matching > data.groups.length)) return null;
  } else if (data.counts !== null) return null;
  const seen = new Set<string>(), groups = new Set<string>(), items: OwnAgreementGroup[] = [];
  let previous: Position | null = request.cursor, cursor: OwnAgreementCursor | null = null;
  for (const value of data.groups) {
    const group = record(value);
    if (!group || !uuid(group.needId) || !['narucilac', 'uskocer'].includes(group.role as string)
      || !Number.isInteger(group.rank) || (group.rank as number) < 0 || (group.rank as number) > 6
      || request.view.section === 'history' && group.rank !== 0
      || typeof group.sortAt !== 'string' || calendarInstant(group.sortAt) === null
      || !Array.isArray(group.items) || !group.items.length
      || request.view.role !== 'all' && group.role !== request.view.role) return null;
    const position = { rank: group.rank as number, at: group.sortAt, id: group.needId as string, role: group.role as OwnAgreementGroup['role'] };
    if (previous && compare(previous, position, request.view.section) >= 0) return null;
    previous = position;
    const key = JSON.stringify(['task', group.needId, group.role]);
    if (groups.has(key)) return null;
    groups.add(key);
    const members: DogovorProjekcija[] = [];
    let memberPosition: { at: bigint; id: string } | null = null;
    for (const member of group.items) {
      const row = record(member);
      if (!row || !uuid(row.id) || seen.has((row.id as string).toLowerCase()) || !sameId(row.needId, group.needId)
        || !uuid(row.applicationId) || typeof row.ratingDue !== 'boolean'
        || !['CONFIRMED', 'AWAITING_REQUESTER', 'COMPLETED', 'CANCELLED', 'SUPERSEDED'].includes(row.status as string)
        || !uuid(row.requesterAccountId) || !uuid(row.workerAccountId)
        || (group.role === 'narucilac' ? !sameId(row.requesterAccountId, accountId)
          : !sameId(row.workerAccountId, accountId) || sameId(row.requesterAccountId, accountId))) return null;
      const at = calendarInstant(row.sortAt), id = (row.id as string).toLowerCase();
      if (at === null || memberPosition && (at > memberPosition.at || at === memberPosition.at && id >= memberPosition.id)) return null;
      memberPosition = { at, id }; seen.add(id);
      let mapped: DogovorProjekcija;
      try { mapped = map(row, accountId); } catch { return null; }
      if (agreementTaskKey(mapped) !== key) return null;
      members.push(mapped.stanje === 'COMPLETED' ? { ...mapped, ocenaMoguca: row.ratingDue,
        stanjeProvereOcene: row.ratingDue ? 'DUE' : 'NOT_DUE' } : mapped);
    }
    const item: OwnAgreementGroup = { key, needId: position.id, role: position.role, rank: position.rank, sortAt: position.at, items: members };
    if (isActiveAgreementTask(item) !== (request.view.section === 'active')
      || request.view.confirmationOnly && !members.some(awaitsMyConfirmation)
      || !filterHistory(members, request.view.outcome).length
      || !agreementGroupMatchesSearch(item, request.view.query, request.view.outcome)) return null;
    items.push(item);
    cursor = { ...position, viewAt: data.viewAt, view: request.view };
  }
  return { items, hasMore: data.hasMore, counts, cursor, asOf: data.asOf };
}
