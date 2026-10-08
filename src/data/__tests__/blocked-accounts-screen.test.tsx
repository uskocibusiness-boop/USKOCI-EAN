import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The blocked list's good case — nobody blocked — used to be a bare sentence with nothing to do
// (owner rule, 2026-09-23: an empty state has a sentence and one action). It now says how a block
// happens, since this screen cannot start one, and offers the one thing it can: a re-check.
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002', C = '10000000-0000-4000-8000-000000000003';
const mockSession = { user: { id: A }, accountRevision: 1 };
const mockList = jest.fn(), mockSetBlock = jest.fn(), mockRouter = { back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('../safetyClientService', () => ({ safetyClientService: {
  listMyBlocks: (...args: unknown[]) => mockList(...args), setBlock: (...args: unknown[]) => mockSetBlock(...args) } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
// Focus is an effect as before; each focused effect is also kept, so a test can leave and come back to the screen
// (the way back from /bezbednost) without remounting it.
type MockFocus = { effect: () => void | (() => void); cleanup?: void | (() => void) };
const mockFocused = new Set<MockFocus>();
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(() => {
  const entry: MockFocus = { effect, cleanup: effect() }; mockFocused.add(entry);
  return () => { mockFocused.delete(entry); if (typeof entry.cleanup === 'function') entry.cleanup(); };
}, [effect]) }));
const refocus = () => { for (const entry of mockFocused) { if (typeof entry.cleanup === 'function') entry.cleanup(); entry.cleanup = entry.effect(); } };
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsText: 'T', SettingsScreen: 'Screen', SettingsGroup: 'Group', SettingsRow: 'Row',
  SettingsAction: 'Action', SettingsPersonRow: 'PersonRow' }));
// The empty, loading and error states are the shared StateView, whose words are the same `T` host here.
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import Route from '../../app/(app)/profil/blokirani';
import { poruka } from '../../ui/system/Poruka';

const ok = (items: { targetAccountId: string; displayName: string | null; revision?: number }[], nextCursor: string | null = null) =>
  ({ ok: true, podatak: { accountId: A, authoritative: true, items: items.map(item => ({ revision: 1, ...item, accountId: A, blocked: true })), nextCursor } });
const receipt = (target: string, revision: number) => ({ ok: true, podatak: { accountId: A, targetAccountId: target, blocked: false, revision, authoritative: true, clientRequestId: 'x', idempotentReplay: false } });
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Route />); }); };
const text = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const action = (label: string) => tree.root.findByProps({ label }).props;
const actions = (label: string) => tree.root.findAllByProps({ label });
const people = () => tree.root.findAllByType('PersonRow' as React.ElementType);
const person = (name: string) => people().find(node => node.props.name === name)!;
const confirmButton = () => tree.root.findAll(node => node.props.testID === 'confirm-sheet-confirm')[0];
const askUnblock = async (name: string) => act(async () => person(name).props.action.onPress());
beforeEach(() => { jest.clearAllMocks(); mockRouter.canGoBack.mockReturnValue(true); mockList.mockResolvedValue(ok([])); });
afterEach(async () => { await act(async () => tree?.unmount()); poruka.hide(); });

it('with nobody blocked, says it once and how a block happens; there is no button, the screen is read again by pulling it', async () => {
  await render();
  expect(text()).toContain('Nema blokiranih osoba.');
  expect(text()).toContain('Osobu blokiraš ili prijaviš sa njenog profila, iz zadatka ili iz Dogovora.');
  expect(mockList).toHaveBeenCalledTimes(1);
  // The good case has nothing to press: a "Proveri ponovo" that only looked again was the one action of an empty screen.
  expect(actions('Proveri ponovo')).toHaveLength(0);
  expect(actions('Sledeće osobe')).toHaveLength(0); expect(actions('Početak liste')).toHaveLength(0);
  const pull = () => tree.root.findByType('Screen' as React.ElementType).props.refresh as { onRefresh: () => void; busy: boolean };
  expect(pull().busy).toBe(false);
  await act(async () => pull().onRefresh());
  expect(mockList).toHaveBeenCalledTimes(2);
  // No sentence explaining the screen: the bar says where you are.
  expect(text()).not.toContain('Korisnici koje trenutno blokiraš');
});

it('names each blocked person or says honestly that the name is unknown, and opens them in safety', async () => {
  mockList.mockResolvedValue(ok([{ targetAccountId: B, displayName: 'Marko' }, { targetAccountId: C, displayName: null }]));
  await render();
  expect(text()).not.toContain('Nema blokiranih');
  expect(actions('Proveri ponovo')).toHaveLength(0);
  expect(people().map(node => node.props.name)).toEqual(['Marko', 'Ime nije dostupno']);
  // The letters come from the real name only; an unknown person is drawn, never given letters.
  expect(people().map(node => node.props.initials)).toEqual(['M', null]);
  expect(people().map(node => node.props.action.accessibilityLabel)).toEqual(['Odblokiraj, Marko', 'Odblokiraj, Ime nije dostupno']);
  await act(async () => person('Marko').props.onOpen());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/bezbednost', params: { targetAccountId: B } });
});

it('an empty later page offers the way back to the start, and Back with no history goes to the hub', async () => {
  mockList.mockResolvedValueOnce(ok([{ targetAccountId: B, displayName: 'Marko' }], C)).mockResolvedValue(ok([]));
  await render();
  await act(async () => action('Sledeće osobe').onPress());
  expect(mockList).toHaveBeenLastCalledWith(C);
  expect(text()).toContain('Na ovoj stranici nema više osoba.');
  expect(actions('Početak liste')).toHaveLength(1);
  mockRouter.canGoBack.mockReturnValue(false);
  await act(async () => tree.root.findByType('Screen' as React.ElementType).props.onBack());
  expect(mockRouter.replace).toHaveBeenCalledWith('/profil');
});

// Round-5 fix (2026-09-24): an empty page with more after it is not "nobody blocked", and an empty later page keeps its
// way back to the start even when yet another page follows it.
it('an empty first page with more after it says nothing about nobody; an empty later page keeps "Početak liste"', async () => {
  mockList.mockResolvedValueOnce(ok([], C)).mockResolvedValueOnce(ok([], 'third'));
  await render();
  expect(text()).not.toContain('Nema blokiranih osoba.');
  // Round 5c: not a lone button either; the page says it is empty, and the way on follows (no way back to itself).
  expect(text()).toContain('Na ovoj stranici nema više osoba.');
  expect(actions('Sledeće osobe')).toHaveLength(1); expect(actions('Početak liste')).toHaveLength(0);
  await act(async () => action('Sledeće osobe').onPress());
  expect(mockList).toHaveBeenLastCalledWith(C);
  expect(text()).toContain('Na ovoj stranici nema više osoba.');
  expect(actions('Početak liste')).toHaveLength(1); expect(actions('Sledeće osobe')).toHaveLength(1);
});

// Step 11a (2026-09-24): unblocking happens on the list, asked once, through the same revisioned, idempotent command.
it('"Odblokiraj" asks first; only the confirm sends one unblock of the shown revision, then the same page is read again', async () => {
  mockList.mockResolvedValueOnce(ok([{ targetAccountId: B, displayName: 'Marko', revision: 4 }], null)).mockResolvedValue(ok([]));
  mockSetBlock.mockResolvedValue(receipt(B, 5));
  await render();
  await askUnblock('Marko');
  expect(mockSetBlock).not.toHaveBeenCalled();
  // The question names the person and says in one sentence what follows.
  expect(text()).toContain('Odblokirati Marko?');
  expect(text()).toContain('Odblokiranje ne vraća ranije dozvole za deljenje kontakta ili tačne lokacije.');
  const confirm = confirmButton();
  await act(async () => { confirm.props.onPress(); confirm.props.onPress(); });
  expect(mockSetBlock).toHaveBeenCalledTimes(1);
  expect(mockSetBlock.mock.calls[0][0]).toMatchObject({ targetAccountId: B, blocked: false, expectedRevision: 4 });
  expect(typeof mockSetBlock.mock.calls[0][0].clientRequestId).toBe('string');
  expect(mockList).toHaveBeenLastCalledWith(null);
  // The outcome is said in the one outcome bar, not as a line in the list, and it carries "Vrati".
  expect(poruka.current()).toMatchObject({ text: 'Blokiranje je uklonjeno: Marko.', confirmed: true, action: { label: 'Vrati' } });
  expect(text()).not.toContain('Blokiranje je uklonjeno');
  expect(people()).toHaveLength(0);
});

it('"Vrati" blocks the person again with a command of its own from the receipt\'s revision, says so, and reads the list again', async () => {
  mockList.mockResolvedValueOnce(ok([{ targetAccountId: B, displayName: 'Marko', revision: 4 }], null)).mockResolvedValue(ok([]));
  mockSetBlock.mockResolvedValueOnce(receipt(B, 5));
  await render(); await askUnblock('Marko'); await act(async () => confirmButton().props.onPress());
  const first = mockSetBlock.mock.calls[0][0];
  mockSetBlock.mockResolvedValueOnce({ ok: true, podatak: { accountId: A, targetAccountId: B, blocked: true, revision: 6, authoritative: true, clientRequestId: 'y', idempotentReplay: false } });
  mockList.mockClear(); mockList.mockResolvedValue(ok([{ targetAccountId: B, displayName: 'Marko', revision: 6 }]));
  await act(async () => poruka.current()!.action!.onPress());
  expect(mockSetBlock).toHaveBeenCalledTimes(2);
  expect(mockSetBlock.mock.calls[1][0]).toMatchObject({ targetAccountId: B, blocked: true, expectedRevision: 5 });
  expect(mockSetBlock.mock.calls[1][0].clientRequestId).not.toBe(first.clientRequestId);
  expect(poruka.current()).toMatchObject({ text: 'Blokiranje je vraćeno.', confirmed: true }); expect(poruka.current()?.action).toBeUndefined();
  expect(mockList).toHaveBeenCalledTimes(1); expect(people().map(node => node.props.name)).toEqual(['Marko']);
});

it('an undo the server does not confirm is said as not confirmed; a person with no known name is asked about and told about without one', async () => {
  mockList.mockResolvedValueOnce(ok([{ targetAccountId: C, displayName: null, revision: 2 }])).mockResolvedValue(ok([]));
  mockSetBlock.mockResolvedValueOnce(receipt(C, 3));
  await render(); await askUnblock('Ime nije dostupno');
  expect(text()).toContain('Odblokirati osobu?'); expect(text()).not.toContain('Odblokirati Ime nije dostupno');
  await act(async () => confirmButton().props.onPress());
  expect(poruka.current()).toMatchObject({ text: 'Blokiranje je uklonjeno.', action: { label: 'Vrati' } });
  mockSetBlock.mockRejectedValueOnce(new Error('offline'));
  await act(async () => poruka.current()!.action!.onPress());
  expect(poruka.current()).toMatchObject({ text: 'Ne znamo da li je promena sačuvana. Osveži pa pokušaj ponovo.' }); expect(poruka.current()?.action).toBeUndefined();
});

it('a refused or unknown unblock locks every "Odblokiraj" until the list is read again, and a retry reuses the request id', async () => {
  mockList.mockResolvedValue(ok([{ targetAccountId: B, displayName: 'Marko', revision: 4 }, { targetAccountId: C, displayName: 'Ana', revision: 2 }]));
  mockSetBlock.mockResolvedValueOnce({ ok: false, kod: 'BLOCK_OUTCOME_UNKNOWN', poruka: 'Ishod nije potvrđen. Proveri listu.' });
  await render();
  await askUnblock('Marko'); await act(async () => confirmButton().props.onPress());
  expect(mockSetBlock).toHaveBeenCalledTimes(1);
  expect(text()).toContain('Ishod nije potvrđen. Proveri listu.');
  expect(people().every(node => node.props.action.disabled === true)).toBe(true);
  expect(text()).not.toContain('Blokiranje je uklonjeno'); expect(poruka.current()).toBeNull();
  await act(async () => action('Proveri listu').onPress());
  expect(people().every(node => node.props.action.disabled === false)).toBe(true);
  mockSetBlock.mockResolvedValueOnce(receipt(B, 5));
  await askUnblock('Marko'); await act(async () => confirmButton().props.onPress());
  expect(mockSetBlock).toHaveBeenCalledTimes(2);
  expect(mockSetBlock.mock.calls[1][0].clientRequestId).toBe(mockSetBlock.mock.calls[0][0].clientRequestId);
});

it('while one unblock runs, its own action spins and the others wait', async () => {
  mockList.mockResolvedValue(ok([{ targetAccountId: B, displayName: 'Marko' }, { targetAccountId: C, displayName: 'Ana' }]));
  let answer!: (value: unknown) => void; mockSetBlock.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
  await render();
  await askUnblock('Marko'); await act(async () => { confirmButton().props.onPress(); });
  expect(person('Marko').props.action.loading).toBe(true);
  expect(person('Ana').props.action.loading).toBe(false); expect(person('Ana').props.action.disabled).toBe(true);
  await act(async () => { answer(receipt(B, 2)); });
  expect(mockSetBlock).toHaveBeenCalledTimes(1);
});

it('a question left open is retired when the list is read again, so a late confirm sends nothing', async () => {
  mockList.mockResolvedValueOnce(ok([{ targetAccountId: B, displayName: 'Marko' }], C)).mockResolvedValue(ok([{ targetAccountId: C, displayName: 'Ana' }]));
  await render();
  await askUnblock('Marko');
  const late = confirmButton().props.onPress;
  await act(async () => action('Sledeće osobe').onPress());
  expect(confirmButton()).toBeUndefined();
  await act(async () => { late(); });
  expect(mockSetBlock).not.toHaveBeenCalled();
});

// Round-5 review (2026-09-24): a list that stays on screen under a failed re-read is not confirmed. "Odblokiraj" used to
// stay live there, and its confirm then did nothing at all, with no error and no change.
it('a re-read that got no answer keeps the list under its error with every "Odblokiraj" waiting, until "Proveri listu"', async () => {
  mockList.mockResolvedValueOnce(ok([{ targetAccountId: B, displayName: 'Marko', revision: 4 }]));
  await render();
  expect(person('Marko').props.action.disabled).toBe(false);
  // Back from /bezbednost while offline: the screen reads its list again and gets no answer.
  mockList.mockRejectedValueOnce(Error('offline'));
  await act(async () => { refocus(); });
  expect(people().map(node => node.props.name)).toEqual(['Marko']);
  expect(text()).toContain('Podaci nisu učitani. Proveri vezu i pokušaj ponovo.');
  expect(person('Marko').props.action.disabled).toBe(true);
  mockList.mockResolvedValueOnce(ok([{ targetAccountId: B, displayName: 'Marko', revision: 4 }]));
  await act(async () => action('Proveri listu').onPress());
  expect(person('Marko').props.action.disabled).toBe(false);
  mockSetBlock.mockResolvedValueOnce(receipt(B, 5)); mockList.mockResolvedValueOnce(ok([]));
  await askUnblock('Marko'); await act(async () => confirmButton().props.onPress());
  expect(mockSetBlock).toHaveBeenCalledTimes(1);
});

// The receipt is the server's word; a list that cannot be read right after it does not make a confirmed unblock
// "unconfirmed" (it used to lock the whole list with "Čuvanje nije potvrđeno").
it.each([['no answer', () => mockList.mockRejectedValueOnce(Error('offline'))],
  ['a refusal', () => mockList.mockResolvedValueOnce({ ok: false, kod: 'READ_FAILED', poruka: 'Lista nije dostupna.' })]])(
  'a confirmed unblock whose re-read gets %s is said as done, and only that person leaves the page', async (_case, failNextRead) => {
    mockList.mockResolvedValueOnce(ok([{ targetAccountId: B, displayName: 'Marko', revision: 4 }, { targetAccountId: C, displayName: 'Ana', revision: 2 }]));
    mockSetBlock.mockResolvedValueOnce(receipt(B, 5));
    await render();
    failNextRead();
    await askUnblock('Marko'); await act(async () => confirmButton().props.onPress());
    expect(mockSetBlock).toHaveBeenCalledTimes(1);
    expect(poruka.current()).toMatchObject({ text: 'Blokiranje je uklonjeno: Marko.', confirmed: true });
    expect(text()).not.toContain('Čuvanje nije potvrđeno');
    expect(people().map(node => node.props.name)).toEqual(['Ana']);
    expect(person('Ana').props.action.disabled).toBe(false);
    expect(person('Ana').props.action.accessibilityLabel).toBe('Odblokiraj, Ana');
  });

it('a refused unblock is still reported as refused, whatever the list does afterwards', async () => {
  mockList.mockResolvedValue(ok([{ targetAccountId: B, displayName: 'Marko', revision: 4 }]));
  mockSetBlock.mockResolvedValueOnce({ ok: false, kod: 'STALE_REVISION', poruka: 'Lista se promenila. Proveri je ponovo.' });
  await render();
  await askUnblock('Marko'); await act(async () => confirmButton().props.onPress());
  expect(text()).toContain('Lista se promenila. Proveri je ponovo.');
  expect(text()).not.toContain('Blokiranje je uklonjeno'); expect(poruka.current()).toBeNull();
  expect(people().map(node => node.props.name)).toEqual(['Marko']);
  expect(person('Marko').props.action.disabled).toBe(true);
});
