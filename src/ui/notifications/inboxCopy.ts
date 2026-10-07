import type { InboxItem, InboxPage, InboxRole } from '../../contracts/inbox';

/**
 * Words and small pure rules of the inbox that belong to no screen (T4a, 2026-10-07).
 *
 * WHERE A TAP GOES. The destination itself is decided by the model and the route (`rpc_resolve_activity_event`, then
 * `app/obavestenja.tsx`); nothing here navigates. This only says, under a row and before it is touched, where the tap
 * will land, in the words the owner uses ("zadatak", "Moje prijave", "Dogovor"). It follows what the resolver and the
 * route do today, event by event, and an event this table does not know says nothing: a destination is never invented.
 */
export function inboxDestination(item: Pick<InboxItem, 'eventType' | 'role'>): string | null {
  switch (item.eventType) {
    // The conversation itself, on the message that arrived.
    case 'MESSAGE_RECEIVED': return 'Otvara poruku u Dogovoru';
    // The change that waits for an answer, not the overview.
    case 'AGREEMENT_CHANGE_PROPOSED': return 'Otvara predlog izmene Dogovora';
    // Everything else about a Dogovor lands on its overview, where the next step is stated.
    case 'AGREEMENT_VERSION_CHANGED': case 'AGREEMENT_CHANGE_REJECTED': case 'AGREEMENT_CANCELLED': case 'EXECUTION_STATE_CHANGED':
    case 'COMPLETION_REQUIRED': case 'PRIVATE_ACCESS_GRANTED': case 'RECOVERY_OPENED': case 'REVIEW_RECEIVED':
    case 'RESPONSE_SELECTED':
      return 'Otvara Dogovor';
    case 'OPPORTUNITY_AVAILABLE': return 'Otvara zadatak';
    // A requester's own task: the applications to choose from.
    case 'RESPONSE_RECEIVED': case 'RESPONSE_UPDATED': case 'RESPONSE_WITHDRAWN': return 'Otvara prijave za tvoj zadatak';
    // A worker's own application.
    case 'RESPONSE_VIEWED': case 'RESPONSE_SHORTLISTED': case 'RESPONSE_NOT_SELECTED': case 'RESPONSE_STALE': case 'RESPONSE_EXPIRED':
      return 'Otvara tvoju prijavu';
    // The same event is the owner's task for a requester and the offer for a worker.
    case 'NEED_REVISED': return item.role === 'REQUESTER' ? 'Otvara tvoj zadatak' : 'Otvara tvoju prijavu';
    // A cancelled task is not a place to stand: the person who applied lands on their own applications.
    case 'NEED_CANCELLED': return item.role === 'REQUESTER' ? 'Otvara tvoj zadatak' : 'Otvara tvoje prijave';
    case 'CLARIFICATION_CREATED': case 'CLARIFICATION_ANSWERED': return 'Otvara pitanja o zadatku';
    default: return null;
  }
}

/** Events the person marked read one at a time (a swipe), each with the moment the server gave back. */
export type ReadStamps = Readonly<Record<string, string>>;

/**
 * The page as the person sees it after reading rows one by one: an event the server confirmed as read shows as read, and
 * the count that was above the list goes down by exactly those events (never below zero). The model owns the page and has
 * no call for a single row that is not opened, so the confirmed read lives beside it and is laid over it here. A page that
 * already carries the read (the next refresh) is returned as it is, so nothing is counted twice; with nothing to lay over,
 * the very same object comes back, which keeps a memoised list still.
 */
export function applyLocalReads<S extends { page: InboxPage | null }>(state: S, stamps: ReadStamps): S {
  const page = state.page;
  if (!page) return state;
  let cleared = 0;
  const items = page.items.map(item => {
    const stamp = stamps[item.id];
    if (!stamp || item.readAt) return item;
    cleared += 1;
    return { ...item, readAt: stamp };
  });
  if (cleared === 0) return state;
  return { ...state, page: { ...page, items, unreadCount: Math.max(0, page.unreadCount - cleared) } };
}

/** Whether a row can be marked read on its own: it is unread, and the screen offers the command at all. */
export const canMarkRead = (item: Pick<InboxItem, 'readAt'>, offered: boolean) => offered && !item.readAt;

/** Which set of notifications a tab shows, in the owner's words (also the names of the sets in the notification settings). */
export const INBOX_SET_LABEL: Readonly<Record<'ALL' | InboxRole, string>> = { ALL: 'Sve', REQUESTER: 'Zadaci', WORKER: 'Moje prijave' };
