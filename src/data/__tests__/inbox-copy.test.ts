import { execFileSync } from 'child_process';
import type { InboxItem, InboxPage } from '../../contracts/inbox';
import { INBOX_SET_LABEL, applyLocalReads, canMarkRead, inboxDestination, inboxTaskTitle, readableServerCopy } from '../../ui/notifications/inboxCopy';

/**
 * The words and the small pure rules of the inbox (T4a, 2026-10-07): where a tap goes, in the owner's vocabulary, and the
 * confirmed one-by-one reads laid over the model's page. Nothing here navigates; the route and the resolver decide that.
 */
const row = (patch: Partial<InboxItem> = {}): InboxItem => ({ id: 'e1', eventType: 'RESPONSE_SELECTED', role: 'WORKER', occurredAt: '2026-10-07T10:00:00Z',
  readAt: null, title: 'Naslov', body: 'Telo', family: 'responses', ...patch });
const page = (items: InboxItem[], unreadCount = items.filter(item => !item.readAt).length): InboxPage => ({ items, hasMore: false, unreadCount, asOf: '2026-10-07T10:00:00Z' });
const state = (items: InboxItem[], unreadCount?: number) => ({ page: page(items, unreadCount), loading: false });

describe('where a tap goes', () => {
  // Every event the server formats a push for (the Edge formatter is the list of event types), executed rather than copied.
  const edge = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { PUSH_EVENT_TYPES } from './supabase/functions/_shared/pushNotificationCopy.mjs';
    process.stdout.write(JSON.stringify(PUSH_EVENT_TYPES));
  `], { cwd: process.cwd(), encoding: 'utf8', timeout: 15000 })) as string[];

  it('says something for each of the 24 events, in the words of the owner and without a role word of the engine', () => {
    expect(edge).toHaveLength(24);
    for (const eventType of edge) for (const role of ['REQUESTER', 'WORKER'] as const) {
      const where = inboxDestination({ eventType, role });
      expect([eventType, role, typeof where]).toEqual([eventType, role, 'string']);
      expect(where).toMatch(/^Otvara /);
      expect(where).not.toMatch(/posao|poslov|Naručilac|Uskočer|server/i);
    }
  });

  it.each([
    ['MESSAGE_RECEIVED', 'WORKER', 'Otvara poruku u Dogovoru'],
    ['AGREEMENT_CHANGE_PROPOSED', 'REQUESTER', 'Otvara predlog izmene Dogovora'],
    ['COMPLETION_REQUIRED', 'REQUESTER', 'Otvara Dogovor'],
    ['REVIEW_RECEIVED', 'WORKER', 'Otvara Dogovor'],
    ['RECOVERY_OPENED', 'REQUESTER', 'Otvara Dogovor'],
    ['RESPONSE_SELECTED', 'WORKER', 'Otvara Dogovor'],
    ['OPPORTUNITY_AVAILABLE', 'WORKER', 'Otvara zadatak'],
    ['RESPONSE_RECEIVED', 'REQUESTER', 'Otvara prijave za tvoj zadatak'],
    ['RESPONSE_SHORTLISTED', 'WORKER', 'Otvara tvoju prijavu'],
    ['NEED_REVISED', 'WORKER', 'Otvara tvoju prijavu'],
    ['NEED_REVISED', 'REQUESTER', 'Otvara tvoj zadatak'],
    ['NEED_CANCELLED', 'WORKER', 'Otvara tvoje prijave'],
    ['NEED_CANCELLED', 'REQUESTER', 'Otvara tvoj zadatak'],
    ['CLARIFICATION_CREATED', 'REQUESTER', 'Otvara pitanja o zadatku'],
    ['CLARIFICATION_ANSWERED', 'WORKER', 'Otvara pitanja o zadatku'],
  ] as const)('%s (%s) says "%s", which is where the route sends it today', (eventType, role, words) => {
    expect(inboxDestination({ eventType, role })).toBe(words);
  });

  it('says nothing for an event it does not know: a destination is never made up', () => {
    expect(inboxDestination({ eventType: 'SOMETHING_NEW', role: 'WORKER' })).toBeNull();
    expect(inboxDestination({ eventType: '', role: 'REQUESTER' })).toBeNull();
  });
});

describe('the names of the sets', () => {
  it('are the three words of the owner, and the settings use the same two', () => {
    // "Zadaci" is the tab of OTHER people's tasks; the set of a requester is "Moji zadaci", as the card on Početna says it (2026-10-08).
    expect(INBOX_SET_LABEL).toEqual({ ALL: 'Sve', REQUESTER: 'Moji zadaci', WORKER: 'Moje prijave' });
  });
});

describe('what was settled one row at a time, laid over the model\'s page', () => {
  it('shows a confirmed row as read, takes it off the count once, and leaves every other row alone', () => {
    const a = row({ id: 'a' }), b = row({ id: 'b' }), c = row({ id: 'c', readAt: '2026-10-07T09:00:00Z' });
    const before = state([a, b, c]);
    const after = applyLocalReads(before, { a: '2026-10-07T10:05:00Z' });
    expect(after.page!.items.map(item => item.readAt)).toEqual(['2026-10-07T10:05:00Z', null, '2026-10-07T09:00:00Z']);
    expect(after.page!.unreadCount).toBe(1);
    expect(after.page!.items[1]).toBe(b); expect(after.page!.items[2]).toBe(c);
    // The model's own state is never changed.
    expect(before.page!.items[0].readAt).toBeNull(); expect(before.page!.unreadCount).toBe(2);
    expect(after.loading).toBe(false);
  });

  it('counts a row once: a page that already carries the read (the next refresh) is not counted again', () => {
    const refreshed = state([row({ id: 'a', readAt: '2026-10-07T10:05:00Z' }), row({ id: 'b' })], 1);
    const after = applyLocalReads(refreshed, { a: '2026-10-07T10:05:00Z' });
    expect(after).toBe(refreshed);
    expect(after.page!.unreadCount).toBe(1);
  });

  it('never takes the count below zero, whatever the server said about rows that are not on this page', () => {
    const after = applyLocalReads(state([row({ id: 'a' }), row({ id: 'b' })], 1), { a: 'x', b: 'y' });
    expect(after.page!.unreadCount).toBe(0);
  });

  it('hands back the very same object when there is nothing to lay over, so a memoised list stays still', () => {
    const untouched = state([row({ id: 'a' })]);
    expect(applyLocalReads(untouched, {})).toBe(untouched);
    expect(applyLocalReads(untouched, { somewhereElse: '2026-10-07T10:05:00Z' })).toBe(untouched);
    const empty = { page: null, loading: true };
    expect(applyLocalReads(empty, { a: 'x' })).toBe(empty);
  });

  it('knows which rows have the command: unread ones, and only where the screen offers it', () => {
    expect(canMarkRead({ readAt: null }, true)).toBe(true);
    expect(canMarkRead({ readAt: '2026-10-07T09:00:00Z' }, true)).toBe(false);
    expect(canMarkRead({ readAt: null }, false)).toBe(false);
  });
});

describe('the task an event is about (R11, R15) and the words the server stored (UI/UX pass, 2026-10-08)', () => {
  it('names the task only when the read does: a title, trimmed and on one line; nothing is made up from the event\'s own words', () => {
    expect(inboxTaskTitle({ title: 'Nova prijava', body: 'Imaš novu prijavu za zadatak.' })).toBeNull();
    expect(inboxTaskTitle({ taskTitle: '  Montaža   police\n u hodniku ' })).toBe('Montaža police u hodniku');
    for (const bad of [undefined, null, '', '   ', 7, {}]) expect(inboxTaskTitle({ taskTitle: bad })).toBeNull();
  });

  it('writes "zadatak" in the lower case in the middle of a sentence, where the server stored it with a capital (the three texts of pkg027c)', () => {
    expect(readableServerCopy('Imaš novu prijavu za Zadatak.')).toBe('Imaš novu prijavu za zadatak.');
    expect(readableServerCopy('Stiglo je anonimno pitanje o Zadatku.')).toBe('Stiglo je anonimno pitanje o zadatku.');
    expect(readableServerCopy('Jedna prijava za tvoj Zadatak je povučena.')).toBe('Jedna prijava za tvoj zadatak je povučena.');
  });

  it('keeps a capital at the start of a sentence, leaves what is already right and every other word alone, and is idempotent', () => {
    for (const same of ['Zadatak je otkazan.', 'Prijava je izmenjena. Zadatak je promenjen.', 'Imaš novu prijavu za zadatak.', 'Nova Prijava za Dogovor.',
      'Otvori Dogovor za detalje zadatka.', 'Zadatak', '']) expect(readableServerCopy(same)).toBe(same);
    const once = readableServerCopy('Tvoj Zadatak i drugi Zadaci');
    expect(once).toBe('Tvoj zadatak i drugi zadaci'); expect(readableServerCopy(once)).toBe(once);
    // A longer word that merely begins like it is not touched.
    expect(readableServerCopy('Pogledaj Zadatkovnik')).toBe('Pogledaj Zadatkovnik');
  });
});
