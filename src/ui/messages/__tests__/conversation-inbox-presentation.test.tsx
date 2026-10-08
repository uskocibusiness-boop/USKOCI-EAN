import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
// The text size decides the layout (`useLayoutClass`), and Jest's own window is a doubled text size, so each case says which one it is at.
let mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => mockWindow;
    if (key === 'FlatList') return (p: any) => require('react').createElement('List', p, p.ListHeaderComponent,
      p.data.length ? p.data.map((item: any) => require('react').createElement('Row', { key: p.keyExtractor(item) }, p.renderItem({ item }))) : p.ListEmptyComponent,
      p.ListFooterComponent);
    return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../system/StateView', () => ({ StateView: 'StateView' }));
jest.mock('../../system/ConversationArt', () => ({ ConversationArt: 'ConversationArt' }));
import { sys } from '../../system/tokens';
import { ListSkeleton } from '../../notifications/ListSkeleton';
import { ConversationInboxPresentation, conversationInboxRows, conversationPreview, conversationStamp, conversationTitle,
  type ConversationInboxRow } from '../ConversationInboxPresentation';

/**
 * The Poruke list (proposal J2, team T3c; the owner's phone, 8 Oct 2026): one row per conversation, a tap opens THAT conversation, a
 * group says it is a group, the time is Serbian time, and every line of a row is ONE line. What the server's projection does not carry
 * (an unread mark for a private conversation, how many people a group has, that a Dogovor is closed) is not drawn unless a reader supplies it.
 */
const NOW = new Date('2026-10-07T12:00:00Z');                       // 14:00 in Belgrade, a Wednesday
const A = '10000000-0000-4000-8000-0000000000a1', B = '10000000-0000-4000-8000-0000000000b1', C = '10000000-0000-4000-8000-0000000000c1';
/** What a test says about a conversation; `last` is the kind of its last message, and the optional extras are what the projection does not carry. */
type RowOptions = { id: string; at: string; preview?: string | null; mine?: boolean; last?: 'TEXT' | 'PHOTO' | 'VOICE'; name?: string | null; task?: string;
  unreadMessageCount?: number | null; closed?: boolean; memberCount?: number };
const row = (options: RowOptions): ConversationInboxRow => {
  const { id, at, preview = 'Dolazim.', mine = false, last = 'TEXT', name = 'Jovana', task = 'Sastavljanje IKEA ormara', unreadMessageCount = null, closed, memberCount } = options;
  return { kind: 'AGREEMENT', id, routeAgreementId: id, task: { id: '90000000-0000-4000-8000-000000000001', title: task },
    counterpart: name === null ? null : { profileId: '80000000-0000-4000-8000-000000000001', displayName: name },
    lastMessage: { id: '70000000-0000-4000-8000-000000000001', createdAt: at, mine, kind: last, preview }, unreadMessageCount,
    ...(closed !== undefined ? { closed } : {}), ...(memberCount !== undefined ? { memberCount } : {}) };
};
const group = (options: RowOptions): ConversationInboxRow =>
  ({ ...row({ name: null, unreadMessageCount: 0, task: 'Selidba garsonjere u Zemunu', preview: 'Kamion stiže u 18:30', ...options }), kind: 'GROUP' });
const props = (items: readonly ConversationInboxRow[] | null, over: Record<string, unknown> = {}) => ({ items, loading: false, refreshing: false, error: false, paging: false,
  pageError: false, hasMore: false, onOpen: jest.fn(), onRefresh: jest.fn(), onLoadMore: jest.fn(), sada: NOW, ...over });
let tree: ReactTestRenderer;
const flat = (style: unknown) => (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
const texts = (node: ReactTestInstance = tree.root) => node.findAll(child => String(child.type) === 'T').flatMap(child => child.children.filter(c => typeof c === 'string')).join(' | ');
const rows = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'button');
const draw = async (p: ReturnType<typeof props>) => { await act(async () => { tree = create(<ConversationInboxPresentation {...p} />); }); };
beforeEach(() => { mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 }; });
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('rows and their words', () => {
  const items = [
    row({ id: A, at: '2026-10-07T11:00:00Z', preview: 'Gotovo, sve je sastavljeno.' }),                  // today 13:00
    row({ id: B, at: '2026-10-06T10:00:00Z', name: 'Teodora', task: 'Bašta — sezonsko orezivanje', preview: 'Može i utorak, javi.', mine: false }),
    row({ id: C, at: '2026-10-03T10:00:00Z', name: 'Ivana', task: 'Prevoz fotelje iz Podbare', preview: 'Hvala!', mine: true }),
  ];

  it('is one row per conversation in the server\'s order, with no day headings between them', async () => {
    await draw(props(items, { titleInHeader: true }));
    expect(rows()).toHaveLength(3);
    expect(tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header')).toHaveLength(0);
    // The first text of a row is the letters of the face; the name follows.
    expect(rows().map(node => texts(node).split(' | ')[1])).toEqual(['Jovana', 'Teodora', 'Ivana']);
  });

  it('writes the stamp at the end of the name\'s line: the clock for today, "Juče", then the date; never both a day and a clock', async () => {
    await draw(props(items));
    expect(texts(rows()[0])).toContain('13:00'); expect(texts(rows()[0])).not.toContain('Danas');
    expect(texts(rows()[1])).toContain('Juče'); expect(texts(rows()[1])).not.toMatch(/\d{2}:\d{2}/);
    expect(texts(rows()[2])).toContain('3. okt'); expect(texts(rows()[2])).not.toMatch(/\d{2}:\d{2}/);
    // The row reads: the person and the time, what was said, and what it is about in grey: three lines, and nothing else (no "when ·" in front of the task).
    expect(texts(rows()[0]).split(' | ').slice(1)).toEqual(['Jovana', '13:00', 'Gotovo, sve je sastavljeno.', 'Sastavljanje IKEA ormara']);
    expect(texts(rows()[1]).split(' | ').slice(1)).toEqual(['Teodora', 'Juče', 'Može i utorak, javi.', 'Bašta — sezonsko orezivanje']);
  });

  it('draws a date as the app writes it, without the zero of the phone\'s own pattern ("3. okt", never "03. okt")', async () => {
    await draw(props([row({ id: A, at: '2026-10-03T10:00:00Z' }), row({ id: B, at: '2026-10-05T10:00:00Z' })]));
    expect(texts(rows()[0])).toContain('3. okt'); expect(texts(rows()[1])).toContain('5. okt');
    expect(texts()).not.toMatch(/\b0\d\. /);
  });

  it('reads the day and the clock in SERBIAN time, not the phone\'s (TZ=UTC here)', async () => {
    // 22:30 UTC on the 6th is 00:30 on the 7th in Belgrade: today, with that clock.
    await draw(props([row({ id: A, at: '2026-10-06T22:30:00Z' })]));
    expect(texts(rows()[0])).toContain('00:30'); expect(texts(rows()[0])).not.toContain('Juče');
    expect(conversationInboxRows([row({ id: A, at: '2026-10-06T21:59:00Z' })], { sada: NOW })[0].moment).toMatchObject({ dan: 'Juče', sat: '23:59' });
    // A caller may still name a zone.
    expect(conversationInboxRows([row({ id: A, at: '2026-10-06T22:30:00Z' })], { sada: NOW, zona: 'UTC' })[0].moment).toMatchObject({ dan: 'Juče', sat: '22:30' });
    expect(conversationStamp(null)).toBeNull();
  });

  it('speaks the whole row as one stop: person, task, last words, day and clock', async () => {
    await draw(props(items));
    expect(rows()[0].props.accessibilityLabel).toBe('Jovana. Sastavljanje IKEA ormara. Gotovo, sve je sastavljeno.. Danas, 13:00');
    expect(rows()[0].props.accessibilityHint).toBe('Otvara razgovor uz ovaj zadatak.');
    expect(rows()[2].props.accessibilityLabel).toContain('Ti: Hvala!');
  });

  it('keeps a caption with a photo or a voice message, writes "Ti: " for mine and invents no sender, duration or status', () => {
    const lastOf = (kind: 'TEXT' | 'PHOTO' | 'VOICE', preview: string | null, mine = false) => row({ id: A, at: '2026-10-07T11:00:00Z', last: kind, preview, mine }).lastMessage;
    expect(conversationPreview(lastOf('PHOTO', 'Evo ormara'))).toBe('Fotografija · Evo ormara');
    expect(conversationPreview(lastOf('PHOTO', null))).toBe('Fotografija');
    expect(conversationPreview(lastOf('VOICE', null, true))).toBe('Ti: Glasovna poruka');
    expect(conversationPreview(lastOf('TEXT', null))).toBe('Tekst poruke nije dostupan');
  });
});

describe('a tap opens that conversation', () => {
  it('hands back the exact row that was tapped, personal or group, so the route can open its Dogovor tab or its group', async () => {
    const personal = row({ id: A, at: '2026-10-07T11:00:00Z' }), shared = group({ id: B, at: '2026-10-07T10:00:00Z' });
    const p = props([personal, shared]);
    await draw(p);
    await act(async () => rows()[0].props.onPress());
    expect(p.onOpen).toHaveBeenLastCalledWith(personal);
    await act(async () => rows()[1].props.onPress());
    expect(p.onOpen).toHaveBeenLastCalledWith(shared);
    expect((p.onOpen.mock.calls[0][0] as ConversationInboxRow)).toBe(personal);
  });

  it('is 64 dp high at the least, and opens nothing while another opening runs (the row is not greyed for it)', async () => {
    const p = props([row({ id: A, at: '2026-10-07T11:00:00Z' })], { openingDisabled: true });
    await draw(p);
    expect(flat(rows()[0].props.style).minHeight).toBeGreaterThanOrEqual(64);
    await act(async () => rows()[0].props.onPress());
    expect(p.onOpen).not.toHaveBeenCalled();
    // Only the row at work, and a conversation that cannot be opened, go grey; the others wait without changing.
    expect(rows()[0].props.accessibilityState).toEqual({ disabled: false });
  });

  it('says it is opening, and says when a conversation is not available or did not open', async () => {
    const item = row({ id: A, at: '2026-10-07T11:00:00Z' });
    await draw(props([item], { openingKey: `AGREEMENT:${A}` }));
    expect(texts()).toContain('Otvaramo razgovor…'); expect(rows()[0].props.accessibilityState).toEqual({ disabled: true });
    await act(async () => tree.update(<ConversationInboxPresentation {...props([item], { unavailableKeys: new Set([`AGREEMENT:${A}`]) })} />));
    expect(texts()).toContain('Razgovor trenutno nije dostupan.');
    await act(async () => tree.update(<ConversationInboxPresentation {...props([item], { openErrorKey: `AGREEMENT:${A}` })} />));
    expect(texts()).toContain('Razgovor nije otvoren. Pokušaj ponovo.');
  });
});

describe('groups', () => {
  it('says "Grupa" with the people it has only when the reader knows how many, and shows no invented sender in the preview', async () => {
    expect(conversationTitle(group({ id: B, at: '2026-10-07T10:00:00Z' }))).toBe('Grupa');
    expect(conversationTitle(group({ id: B, at: '2026-10-07T10:00:00Z', memberCount: 3 }))).toBe('Grupa · 3 osobe');
    expect(conversationTitle(group({ id: B, at: '2026-10-07T10:00:00Z', memberCount: 1 }))).toBe('Grupa · 1 osoba');
    expect(conversationTitle(group({ id: B, at: '2026-10-07T10:00:00Z', memberCount: 5 }))).toBe('Grupa · 5 osoba');
    await draw(props([group({ id: B, at: '2026-10-07T10:00:00Z', memberCount: 3 })]));
    expect(texts(rows()[0])).toContain('Grupa · 3 osobe');
    expect(texts(rows()[0])).toContain('Selidba garsonjere u Zemunu');
    expect(texts(rows()[0])).toContain('Kamion stiže u 18:30');
    expect(texts(rows()[0])).not.toContain('Mina:');
  });

  it('counts unread messages of a group, and only a group', async () => {
    await draw(props([group({ id: B, at: '2026-10-07T10:00:00Z', unreadMessageCount: 3 }), group({ id: C, at: '2026-10-07T09:00:00Z', unreadMessageCount: 0 })]));
    expect(texts(rows()[0])).toContain('3'); expect(rows()[0].props.accessibilityLabel).toContain('3 nepročitana');
    expect(rows()[1].props.accessibilityLabel).not.toContain('nepročitan');
  });

  it('gives a group\'s count the height of its line, so a group is as tall as any other conversation', async () => {
    await draw(props([group({ id: B, at: '2026-10-07T10:00:00Z', unreadMessageCount: 12 })]));
    const count = rows()[0].findAll(node => String(node.type) === 'View' && flat(node.props.style).minWidth === 20)[0];
    expect(flat(count.props.style)).toMatchObject({ height: 20 });
  });
});

describe('what the server does not carry stays undrawn', () => {
  it('a private conversation has no unread mark, even if a number is handed in: the reader says unread is unknown (null)', async () => {
    await draw(props([row({ id: A, at: '2026-10-07T11:00:00Z', unreadMessageCount: 4 })]));
    expect(rows()[0].props.accessibilityLabel).not.toContain('nepročitan');
    expect(texts(rows()[0])).not.toMatch(/\b4\b/);
  });

  it('a Dogovor the projection does not say is closed is not called closed', async () => {
    await draw(props([row({ id: A, at: '2026-10-07T11:00:00Z' })]));
    expect(rows()[0].props.accessibilityLabel).not.toContain('zatvoren');
  });

  it('a closed Dogovor, when a reader supplies it, stands under "Završeni" and says so aloud, with no lock and no arrow: the set says it is over', async () => {
    await draw(props([row({ id: A, at: '2026-10-03T10:00:00Z', closed: true, name: 'Ivana', task: 'Prevoz fotelje iz Podbare', preview: 'Hvala!' })]));
    // The row says its Dogovor is closed, so the list is told in two sets and this one is under "Završeni" (opened here).
    expect(rows()).toHaveLength(0);
    await act(async () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Završeni')[0].props.onPress());
    expect(tree.root.findAllByProps({ testID: 'conversation-lock' })).toHaveLength(0);
    expect(rows()[0].props.accessibilityLabel).toBe('Ivana. Prevoz fotelje iz Podbare. Dogovor je zatvoren. Hvala!. 3. okt, 12:00');
    // A closed conversation is still opened by a tap: it can be read.
    expect(rows()[0].props.accessibilityState).toEqual({ disabled: false });
  });
});

describe('the states of the list', () => {
  it('shows the first read, a failure that can be tried again, and an empty inbox with the way to the Dogovori', async () => {
    await draw(props(null, { loading: true }));
    // The rows that are coming, in their geometry (a face in its slot, three lines), and one sentence a screen reader hears.
    expect(tree.root.findAllByType(ListSkeleton)).toHaveLength(1); expect(tree.root.findByType(ListSkeleton).props).toMatchObject({ face: true });
    expect(texts()).toContain('Učitavamo razgovore…');
    await act(async () => tree.update(<ConversationInboxPresentation {...props(null, { error: true })} />));
    expect(tree.root.findAllByType('StateView' as never)[0].props).toMatchObject({ kind: 'error', title: 'Razgovori nisu učitani' });
    const onAgreements = jest.fn();
    await act(async () => tree.update(<ConversationInboxPresentation {...props([], { onAgreements })} />));
    // The state of the system (one green way forward), not a screen of its own.
    // The first encounter ("Predmet vrata", the owner's pick of 2026-10-08): the two panels at the size of a door.
    expect(tree.root.findAllByType('StateView' as never)[0].props).toMatchObject({ kind: 'empty', hero: true, art: 'chat', title: 'Još nema razgovora', body: 'Čim nastane Dogovor, ovde je razgovor.' });
    await act(async () => tree.root.findAllByType('StateView' as never)[0].props.primary.onPress());
    expect(onAgreements).toHaveBeenCalledTimes(1);
  });

  it('keeps the rows that were read when a refresh fails, and says so', async () => {
    await draw(props([row({ id: A, at: '2026-10-07T11:00:00Z' })], { error: true }));
    expect(rows()).toHaveLength(1);
    expect(texts()).toContain('Razgovori nisu osveženi.');
  });

  it('offers older conversations and tries again after a failed page', async () => {
    const p = props([row({ id: A, at: '2026-10-07T11:00:00Z' })], { hasMore: true });
    await draw(p);
    await act(async () => tree.root.findByProps({ label: 'Učitaj starije razgovore' }).props.onPress());
    expect(p.onLoadMore).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<ConversationInboxPresentation {...props([row({ id: A, at: '2026-10-07T11:00:00Z' })], { hasMore: true, pageError: true })} />));
    expect(texts()).toContain('Stariji razgovori nisu učitani. Pokušaj ponovo da nastaviš.');
  });
});

describe('the face', () => {
  it('is a 48 disc for a person and the group picture for a group; a photo the screen supplies replaces the initials', async () => {
    await draw(props([row({ id: A, at: '2026-10-07T11:00:00Z', name: 'Jovana Jovanović' }), group({ id: B, at: '2026-10-07T10:00:00Z' })]));
    // The face stands on the edge of the screen: its slot is its own width.
    expect(flat(rows()[0].findAll(node => String(node.type) === 'View' && node.props.accessible === false)[0].props.style)).toMatchObject({ width: 48, height: 48 });
    expect(tree.root.findAllByProps({ kind: 'users', size: 48 }).length).toBeGreaterThan(0);
    await act(async () => tree.update(<ConversationInboxPresentation {...props([row({ id: A, at: '2026-10-07T11:00:00Z' })], { renderAvatar: () => React.createElement('Photo') })} />));
    expect(tree.root.findAllByType('Photo' as never)).toHaveLength(1);
  });

  it('decorates only: a screen reader hears the person once, in the row\'s one label', async () => {
    await draw(props([row({ id: A, at: '2026-10-07T11:00:00Z' })]));
    const face = rows()[0].findAll(node => String(node.type) === 'View' && node.props.accessible === false)[0];
    expect(face.props.accessible).toBe(false); expect(face.props.accessibilityElementsHidden).toBe(true);
    expect(sys.touch.min).toBe(44);
    expect(flat(rows()[0].props.style).minHeight).toBeGreaterThanOrEqual(sys.touch.min);
  });
});

// UI/UX pass, 2026-10-08 (F1; composition spec 4.11 and R17): the list tells the active conversations from the finished ones.
describe('Aktivni and Završeni (R17)', () => {
  const rowsOf = [
    row({ id: A, at: '2026-10-07T11:00:00Z', name: 'Jovana' }),
    row({ id: B, at: '2026-10-06T10:00:00Z', name: 'Teodora' }),
    row({ id: C, at: '2026-10-03T10:00:00Z', name: 'Ivana' }),
  ];
  const tab = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label)[0];
  const names = () => rows().map(node => texts(node).split(' | ')[1]);

  it('has one list and no control until every row says whether its Dogovor is closed: nothing is called active or finished on a guess', async () => {
    await draw(props(rowsOf));
    expect(names()).toEqual(['Jovana', 'Teodora', 'Ivana']); expect(tab('Aktivni')).toBeUndefined();
    await act(async () => tree.update(<ConversationInboxPresentation {...props(rowsOf, { closedAgreements: null })} />));
    expect(tab('Aktivni')).toBeUndefined();
    // One row that says and the others that do not is still not every row.
    await act(async () => tree.update(<ConversationInboxPresentation {...props([{ ...rowsOf[0], closed: false }, rowsOf[1]])} />));
    expect(tab('Aktivni')).toBeUndefined(); expect(rows()).toHaveLength(2);
  });

  it('tells the two sets by the Dogovori that are over: "Aktivni" first, the order of the server kept inside each', async () => {
    await draw(props(rowsOf, { closedAgreements: new Set([B]) }));
    expect([tab('Aktivni').props.accessibilityState, tab('Završeni').props.accessibilityState]).toEqual([{ selected: true }, { selected: false }]);
    expect(names()).toEqual(['Jovana', 'Ivana']);
    await act(async () => tab('Završeni').props.onPress());
    expect(names()).toEqual(['Teodora']);
    // A closed conversation is read, not hidden: its row says the Dogovor is closed, and a tap opens it.
    expect(rows()[0].props.accessibilityLabel).toContain('Dogovor je zatvoren');
  });

  it('takes what the row says over what the set says, and a set that is empty says so with the way to the other', async () => {
    await draw(props(rowsOf.map(item => ({ ...item, closed: false })), { closedAgreements: new Set([A, B, C]) }));
    expect(rows()).toHaveLength(3);
    await act(async () => tab('Završeni').props.onPress());
    expect(rows()).toHaveLength(0);
    expect(tree.root.findAllByType('StateView' as never)[0].props).toMatchObject({ kind: 'empty', title: 'Još nema završenih razgovora' });
    await act(async () => tree.update(<ConversationInboxPresentation {...props(rowsOf, { closedAgreements: new Set([A, B, C]) })} />));
    await act(async () => tab('Aktivni').props.onPress());
    expect(tree.root.findAllByType('StateView' as never)[0].props).toMatchObject({ title: 'Nema aktivnih razgovora', body: 'Završene razgovore vidiš pod „Završeni“.' });
    // The Dogovori are the way out of "no conversations at all", not of a set that is empty.
    expect(tree.root.findAllByType('StateView' as never)[0].props.primary).toBeUndefined();
  });

  it('is told by the id of the Dogovor each conversation is about (a group too), and conversationInboxRows says what it did not know', () => {
    const listed = conversationInboxRows([...rowsOf, group({ id: '10000000-0000-4000-8000-0000000000d1', at: '2026-10-05T10:00:00Z' })], { sada: NOW, closedAgreements: new Set([C]) });
    expect(listed.map(item => item.closed)).toEqual([false, false, true, false]);
    expect(conversationInboxRows(rowsOf, { sada: NOW }).map(item => item.closed)).toEqual([undefined, undefined, undefined]);
    expect(conversationInboxRows([{ ...rowsOf[0], closed: true }], { sada: NOW, closedAgreements: new Set() })[0].closed).toBe(true);
  });
});

// The owner's phone, 8 Oct 2026: a row was 150 dp high (the name in two lines, the preview in four, the task, a date, a lock). Every line is one.
describe('the words of a row are three lines of one line each', () => {
  const long = 'Dobar dan, javljam se u vezi sa terminom koji smo dogovorili za subotu, mislim da će nam trebati još jedna osoba.';
  const title = 'Prenos troseda i dve fotelje sa trećeg sprata zgrade bez lifta do kombija ispred ulaza';
  // The first of them is the letters of the face (a line of their own); the three lines of the row follow.
  const lines = (node: ReactTestInstance) => node.findAll(child => String(child.type) === 'T' && typeof child.props.numberOfLines === 'number').slice(1);

  it('keeps the name, the preview and the task to one line each, and cuts by the line, not by a count of letters', async () => {
    await draw(props([row({ id: A, at: '2026-10-07T11:00:00Z', name: 'Aleksandra Konstantinović-Radovanović', preview: long, task: title })]));
    expect(lines(rows()[0]).map(node => [node.props.children, node.props.numberOfLines])).toEqual([
      ['Aleksandra Konstantinović-Radovanović', 1], [long, 1], [title, 1]]);
    // Nothing was shortened by the code: the whole text is in the node, and the line does the cutting.
    expect(texts(rows()[0])).toContain(long); expect(texts(rows()[0])).toContain(title);
  });

  it('is heard whole in its one label, however much of it is shown', async () => {
    await draw(props([row({ id: A, at: '2026-10-07T11:00:00Z', preview: long, task: title })]));
    expect(rows()[0].props.accessibilityLabel).toContain(long); expect(rows()[0].props.accessibilityLabel).toContain(title);
  });

  it('has no arrow and no lock: the whole row is the way in', async () => {
    await draw(props([row({ id: A, at: '2026-10-07T11:00:00Z', closed: false })]));
    expect(rows()[0].findAll(node => String(node.type) === 'Glyph')).toHaveLength(0);
    expect(rows()[0].findAllByProps({ testID: 'conversation-lock' })).toHaveLength(0);
  });

  // At a large text size the time has no room beside the name: the name may take two lines, and the time goes before the task.
  it('at a large text size lets the name take two lines and moves the time to the front of the task', async () => {
    mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1.3 };
    await draw(props([row({ id: A, at: '2026-10-07T11:00:00Z', name: 'Aleksandra Konstantinović', preview: 'Gotovo, sve je sastavljeno.', task: 'Sastavljanje IKEA ormara' })]));
    expect(lines(rows()[0]).map(node => [node.props.children, node.props.numberOfLines])).toEqual([
      ['Aleksandra Konstantinović', 2], ['Gotovo, sve je sastavljeno.', 1], ['13:00 · Sastavljanje IKEA ormara', 1]]);
  });
});

// The white dot on the owner's phone (8 Oct 2026): the Android pull spinner, raised by every read the list started by itself.
describe('the pull spinner', () => {
  const list = () => tree.root.findByType('List' as never);
  it('is shown for a pull only, never for a read the screen started on its own', async () => {
    const p = props([row({ id: A, at: '2026-10-07T11:00:00Z' })]);
    await draw(p);
    await act(async () => tree.update(<ConversationInboxPresentation {...p} refreshing />));
    expect(list().props.refreshing).toBe(false);
    await act(async () => tree.update(<ConversationInboxPresentation {...p} refreshing={false} />));
    await act(async () => list().props.onRefresh());
    expect(p.onRefresh).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<ConversationInboxPresentation {...p} refreshing />));
    expect(list().props.refreshing).toBe(true);
    await act(async () => tree.update(<ConversationInboxPresentation {...p} refreshing={false} />));
    expect(list().props.refreshing).toBe(false);
  });
  it('is never shown while the first page is still to come', async () => {
    await draw(props(null, { loading: true }));
    expect(list().props.refreshing).toBe(false);
  });
});
