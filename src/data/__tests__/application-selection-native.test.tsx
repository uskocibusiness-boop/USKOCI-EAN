import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockTask = jest.fn(), mockNeed = jest.fn(), mockProfile = jest.fn(), mockSubmit = jest.fn(), mockSelect = jest.fn(), mockCandidates = jest.fn(), mockApplications = jest.fn(), mockPublic = jest.fn();
const mockViewed = jest.fn();
const mockSource = { prilika: mockTask, potreba: mockNeed, mojRadnikProfil: mockProfile, podnesiPrijavu: mockSubmit,
  izaberiPrijavu: mockSelect, prijaveZaPotrebu: mockCandidates, mojePrijave: mockApplications, javniProfil: mockPublic, oznaciPrijavuVidjenom: mockViewed };
const mockLinkQuery = jest.fn();
const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
let mockId: string | undefined = '10000000-0000-4000-8000-000000000001', mockFocused = true;
let mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 };
let mockState = 'active';
const mockListeners = new Set<(state: string) => void>();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'AppState') return { currentState: mockState, addEventListener: (_: string, listener: (state: string) => void) => {
      mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) };
    } };
    // Native virtualization is a boundary here; render its initial viewport.
    if (key === 'FlatList') return (props: any) => require('react').createElement('FlatList', props,
      props.ListHeaderComponent,
      ...(props.data.length ? props.data.slice(0, props.initialNumToRender).map((item: any, index: number) =>
        require('react').createElement(require('react').Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item, index }))) : [props.ListEmptyComponent]),
      props.ListFooterComponent);
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' }, FadeIn: { duration: () => ({}) } }));
// Reduced motion is read from the one store (ui/system/motion) since 2026-09-24, no longer from Reanimated.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource}));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockAccount, sesijaSada: () => mockAccount }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({
  from: () => { const builder = { select: () => builder, eq: () => builder, maybeSingle: mockLinkQuery }; return builder; },
}) }));
const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }) } }));
import Composer from '../../app/(app)/prilike/[id]/prijava';
import Candidates from '../../app/(app)/potrebe/[id]/kandidati';
import { sys } from '../../ui/system/tokens';
import { SuccessMark } from '../../ui/system/SuccessMark';
const need = () => ({ id: mockId, revizija: 3, naslov: 'Unos ormara', podrucjeTekst: 'Liman 2, Novi Sad', vremeTekst: '20. sept · 10–11h',
  stanje: 'CEKA_PRIJAVE', pokrivenost: { ukupno: 3, preostalo: 3, popunjeno: 0 }, rezimCene: 'OFFERS', taskTimezone: 'Europe/Belgrade',
  schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-20T08:00:00.123456Z', endsAt: '2026-09-20T09:00:00.654321Z' } });
const k = () => ({ prijavaId: '10000000-0000-4000-8000-000000000003', radnikProfilId: '10000000-0000-4000-8000-000000000002',
  potrebaRevizija: 3, verzija: 2, hash: 'a'.repeat(64), ime: 'Milan', inicijali: 'M', ocenaTekst: '—', recenzijeTekst: '0 završenih',
  cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' }, pokrivaMesta: 2, preostaloMesta: 3,
  dolazakTekst: '20. sept · 10h', prevozTekst: 'Kombi', napomena: 'Dolazimo sa trakama.', stanje: 'SELECTABLE', mozeIzabrati: true,
  predlozeniPocetak: '2026-09-20T08:00:00Z', predlozeniKraj: '2026-09-20T09:00:00Z',
  dokazPrijave: { sema: 'APPLICATION_V1_SELF_DECLARED', kapacitetTima: 2, vestine: ['Nošenje'], alati: ['Trake'], vozila: ['Kombi'], licence: [] }, razlogPreporuke: null });
const agreement = '10000000-0000-4000-8000-000000000004';
let tree: ReactTestRenderer | undefined, screen: React.ElementType = Composer;
const text = () => tree!.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const press = (label: string) => tree!.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0]?.props.onPress;
const tap = async (label: string) => { const fn = press(label); expect(fn).toBeDefined(); await act(async () => { fn(); }); };
const edit = async (label: string, value: string) => { await act(async () => {
  tree!.root.findAll(node => String(node.type) === 'TextInput' && node.props.accessibilityLabel === label)[0].props.onChangeText(value);
}); };
const render = async (component = Composer) => { screen = component; await act(async () => { tree = create(React.createElement(screen)); }); };
const update = async () => { await act(async () => { tree!.update(React.createElement(screen)); }); };
const background = async (state: string) => { await act(async () => { mockState = state; mockListeners.forEach(listener => listener(state)); }); };
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; };
beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true; mockState = 'active'; mockId = '10000000-0000-4000-8000-000000000001';
  mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 }; mockRouter.canGoBack.mockReturnValue(true);
  mockNeed.mockResolvedValue(need()); mockTask.mockResolvedValue({ ...need(), primaNovePrijave: true, rokZaPrijaveIso: null });
  mockProfile.mockResolvedValue({ id: '10000000-0000-4000-8000-000000000002', stanje: 'ACTIVE' });
  mockCandidates.mockResolvedValue([k()]); mockApplications.mockResolvedValue([]);
  mockSubmit.mockResolvedValue({ ok: true, podatak: { prijavaId: k().prijavaId, verzija: 2, hash: k().hash } });
  mockLinkQuery.mockResolvedValue({ data: null, error: null });
  mockSelect.mockResolvedValue({ ok: true, podatak: { dogovorId: agreement } }); mockPublic.mockResolvedValue(null);
  mockViewed.mockResolvedValue({ ok: true, podatak: null });
  mockStorage.clear();
});
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });
async function reviewOffer() {
  if (!press('Pošalji ovu prijavu')) await tap('Pregledaj ponudu');
  expect(press('Pošalji ovu prijavu')).toBeDefined();
}
async function sendOffer() { await reviewOffer(); await tap('Pošalji ovu prijavu'); }
async function offer() { await render(); await edit('Tvoja ukupna ponuda za ljude koje dovodiš (RSD)', '4500'); await edit('Koliko ljudi dolazi', '2'); }
// Step 7 (2026-09-24): an offer opens as a sheet over the list and its one green action, "Izaberi ovu prijavu", asks in an
// in-app confirmation. It was a page with "Pregledaj povezivanje" and a review page behind it; these helpers pinned that
// look. Android Back on the sheet (its Modal's request) is how an offer is closed now, where the offer page had its own
// back arrow.
async function selection() { await render(Candidates); await tap('Pogledaj prijavu: Milan'); await tap('Izaberi ovu prijavu'); }
// Review r4 rk item 5: the confirmation's button now says the green button's own words, "Izaberi ovu prijavu" (it said
// "Izaberi ovu Prijavu", two words for one command). The two share a label, so the confirm is the confirmation's own
// button, found by its testID, and each lookup also checks its words.
const confirmNode = () => tree!.root.findAll(node => String(node.type) === 'Press' && node.props.testID === 'confirm-sheet-confirm')[0];
const confirmChoice = () => { const node = confirmNode(); if (node) expect(node.props.accessibilityLabel).toBe('Izaberi ovu prijavu'); return node?.props.onPress; };
const tapConfirm = async () => { const fn = confirmChoice(); expect(fn).toBeDefined(); await act(async () => { fn(); }); };
const sheets = () => tree!.root.findAll(node => String(node.type) === 'Modal');
async function closeOffer() { const offerSheet = sheets()[0]; expect(offerSheet).toBeDefined(); await act(async () => offerSheet.props.onRequestClose()); }
const person = () => tree!.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityHint === 'Otvara javni profil')[0]?.props.onPress;

it('previews the actual offer message without marking it viewed; opening keeps the full message', async () => {
  const message = 'Dolazimo nas dvojica. Donosimo trake. Kombi je veliki i može da stane ispred ulaza.';
  mockCandidates.mockResolvedValue([{ ...k(), napomena: message }]);
  await render(Candidates);
  const spoken = tree!.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Pogledaj prijavu: Milan')[0].props.accessibilityValue.text;
  expect(spoken).toContain('4.500 RSD'); expect(spoken).toContain('2 osobe');
  expect(spoken).toContain('10:00–11:00 (po vremenu u Srbiji)'); expect(spoken).toContain(message);
  expect(text()).toContain(message); expect(mockViewed).not.toHaveBeenCalled(); expect(mockSelect).not.toHaveBeenCalled();
  await tap('Pogledaj prijavu: Milan');
  expect(text()).toContain(message); expect(mockViewed).toHaveBeenCalledTimes(1); expect(mockSelect).not.toHaveBeenCalled();
});

// The offer's price label read "Ukupno za dolazi 1 osoba" on the phone (2026-09-23): a sentence glued into a label.
it('says whom the total is for in plain grammar on the offer screen', async () => {
  await render(Candidates); await tap('Pogledaj prijavu: Milan');
  expect(tree!.root.findAll(node => node.props.accessibilityLabel === 'Ukupno za 2 osobe: 4.500 RSD')).not.toHaveLength(0);
  expect(text()).not.toContain('Ukupno za dolaz');
});

it('keeps a long accessible message preview bounded and opens the full saved message', async () => {
  const message = 'Donosimo trake i veliki kombi. 🚚 '.repeat(12);
  mockCandidates.mockResolvedValue([{ ...k(), napomena: message }]);
  await render(Candidates);
  const spoken = tree!.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Pogledaj prijavu: Milan')[0].props.accessibilityValue.text;
  expect(spoken).toContain(message.slice(0, 100)); expect(spoken).not.toContain(message.trim());
  expect(spoken.length).toBeLessThan(message.length); expect(spoken).toContain('…');
  expect(spoken).toContain('Otvori prijavu za celu poruku.');
  expect(mockViewed).not.toHaveBeenCalled(); expect(mockSelect).not.toHaveBeenCalled();
  await tap('Pogledaj prijavu: Milan');
  expect(text()).toContain(message); expect(mockViewed).toHaveBeenCalledTimes(1); expect(mockSelect).not.toHaveBeenCalled();
});

it('reviews an offer without writing or sending and returns to the unchanged draft on Back', async () => {
  await offer(); await edit('Poruka uz prijavu', '  Donosimo trake.  ');
  expect(press('Pošalji ovu prijavu')).toBeUndefined();
  await tap('Pregledaj ponudu');
  expect(text()).toContain('Ovo šalješ'); expect(text()).toContain('4.500 RSD');
  expect(text()).toContain('Donosimo trake.'); expect(text()).toContain('2 osobe');
  expect(mockSubmit).not.toHaveBeenCalled(); expect(mockStorage.size).toBe(0);
  const retainedSend = press('Pošalji ovu prijavu');
  const modal = tree!.root.findAll(node => String(node.type) === 'Modal')[0];
  await act(async () => modal.props.onRequestClose());
  await act(async () => retainedSend());
  expect(mockSubmit).not.toHaveBeenCalled(); expect(mockStorage.size).toBe(0);
  expect(press('Pošalji ovu prijavu')).toBeUndefined();
  const note = tree!.root.findAll(node => String(node.type) === 'TextInput' && node.props.accessibilityLabel === 'Poruka uz prijavu')[0];
  expect(note.props.value).toBe('  Donosimo trake.  ');
});
it('a retained review cannot send a later edited offer; a new review sends that exact offer once', async () => {
  await offer(); await tap('Pregledaj ponudu'); const oldSend = press('Pošalji ovu prijavu');
  await tap('Izmeni ponudu'); await edit('Tvoja ukupna ponuda za ljude koje dovodiš (RSD)', '6500');
  await edit('Poruka uz prijavu', '  Donosimo trake.  ');
  await act(async () => oldSend()); expect(mockSubmit).not.toHaveBeenCalled();
  await tap('Pregledaj ponudu'); expect(text()).toContain('6.500 RSD');
  const send = press('Pošalji ovu prijavu'); await act(async () => { send(); send(); });
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(mockSubmit.mock.calls[0][0]).toMatchObject({ cenaRsd: 6500, pokrivenaMesta: 2, napomena: 'Donosimo trake.', potrebaRevizija: 3 });
});
it('invalidates a review when the task revision changes and asks for a fresh review', async () => {
  await offer(); await tap('Pregledaj ponudu'); const oldSend = press('Pošalji ovu prijavu');
  mockNeed.mockResolvedValue({ ...need(), revizija: 4, naslov: 'Promenjen zadatak' });
  mockFocused = false; await update(); mockFocused = true; await update();
  await act(async () => oldSend()); expect(mockSubmit).not.toHaveBeenCalled();
  expect(press('Pošalji ovu prijavu')).toBeUndefined();
  await tap('Pregledaj ponudu'); expect(text()).toContain('Promenjen zadatak');
  await tap('Pošalji ovu prijavu'); expect(mockSubmit.mock.calls[0][0].potrebaRevizija).toBe(4);
});
// Round 6 (unit prijava): an empty price no longer opens a review that says "Proveri unetu cenu"; the green button is grey
// with the reason under it, and the footer says the missing price in words, never as an amount.
it('reviews flexible time without making up an exact interval and keeps missing price as text', async () => {
  const flexible = { ...need(), vremeTekst: 'Fleksibilno', schedule: { kind: 'FLEXIBLE', startsAt: null, endsAt: null } };
  mockNeed.mockResolvedValue(flexible); mockTask.mockResolvedValue({ ...flexible, primaNovePrijave: true });
  await render();
  const review = () => tree!.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Pregledaj ponudu')[0];
  expect(review().props.disabled).toBe(true); expect(review().props.accessibilityHint).toBe('Upiši svoju cenu da pregledaš ponudu.');
  expect(text()).toContain('Cena još nije upisana'); expect(text()).not.toMatch(/\d RSD/);
  await act(async () => review().props.onPress()); expect(press('Pošalji ovu prijavu')).toBeUndefined();
  await edit('Tvoja ukupna ponuda za ljude koje dovodiš (RSD)', '4500'); await tap('Pregledaj ponudu');
  expect(text()).toContain('Tačan početak i kraj još nisu dogovoreni.');
  expect(mockSubmit).not.toHaveBeenCalled(); expect(mockStorage.size).toBe(0);
});

it('marks only an intentionally opened offer, never the list, comparison or focus refresh', async () => {
  mockCandidates.mockResolvedValue([k(), { ...k(), prijavaId: agreement, ime: 'Ana' }]);
  await render(Candidates); expect(mockViewed).not.toHaveBeenCalled();
  await tap('Uporedi'); expect(mockViewed).not.toHaveBeenCalled();
  await tap('Prikaži listu'); expect(mockViewed).not.toHaveBeenCalled();
  mockFocused = false; await update(); mockFocused = true; await update();
  expect(mockViewed).not.toHaveBeenCalled();
  await tap('Uporedi'); await tap('Otvori prijavu: Milan');
  expect(mockViewed.mock.calls).toEqual([[k().prijavaId]]);
  expect(mockSelect).not.toHaveBeenCalled();
  await closeOffer(); expect(sheets()).toHaveLength(0);
  await tap('Prikaži listu'); await tap('Pogledaj prijavu: Milan');
  expect(mockViewed).toHaveBeenCalledTimes(1);
});
it('deduplicates pending double opens without blocking offer reading or selecting', async () => {
  const d = deferred(); mockViewed.mockReturnValueOnce(d.promise);   await render(Candidates); const open = press('Pogledaj prijavu: Milan');
  await act(async () => { open(); open(); });
  expect(mockViewed.mock.calls).toEqual([[k().prijavaId]]);
  expect(text()).toContain('Dolazimo sa trakama.');
  expect(press('Izaberi ovu prijavu')).toBeDefined();
  await closeOffer(); await tap('Pogledaj prijavu: Milan');
  expect(mockViewed).toHaveBeenCalledTimes(1);
  await act(async () => d.resolve({ ok: true, podatak: null }));
  await closeOffer(); await tap('Pogledaj prijavu: Milan');
  expect(mockViewed).toHaveBeenCalledTimes(1); expect(mockSelect).not.toHaveBeenCalled();
});
it('shows safe unconfirmed view status and repeats only on another explicit exact offer opening', async () => {
  mockViewed.mockRejectedValueOnce(new Error('PRIVATE_SQL_DETAILS'));   await render(Candidates); await tap('Pogledaj prijavu: Milan');
  expect(text()).toContain('nije označena kao viđena'); expect(text()).not.toContain('PRIVATE_SQL_DETAILS');
  await update(); expect(mockViewed).toHaveBeenCalledTimes(1);
  await closeOffer(); mockFocused = false; await update(); mockFocused = true; await update();
  expect(mockViewed).toHaveBeenCalledTimes(1);
  await tap('Pogledaj prijavu: Milan');
  expect(mockViewed.mock.calls).toEqual([[k().prijavaId], [k().prijavaId]]);
  expect(text()).not.toContain('nije označena kao viđena'); expect(mockSelect).not.toHaveBeenCalled();
});
// Plan 2.12 (owner 2026-10-07): the requester sees the same five states on each application as the worker does. The candidate read merges
// SUBMITTED, VIEWED and SHORTLISTED and carries no viewed flag, so "Viđena" is claimed only for an application whose view mark the SERVER
// confirmed on this phone; until then, and where the mark failed, it is "Poslata", which is still true.
it('says "Viđena" for an application only after the server confirmed that it was opened, on the list under the sheet and on the sheet', async () => {
  const chips = () => tree!.root.findAll(node => String(node.type) === 'View' && node.props.testID === 'status-chip').map(node => node.props.accessibilityLabel);
  const d = deferred(); mockViewed.mockReturnValueOnce(d.promise);
  mockCandidates.mockResolvedValue([k(), { ...k(), prijavaId: agreement, ime: 'Ana' }]);
  await render(Candidates);
  expect(chips()).toEqual(['Poslata', 'Poslata']);
  await tap('Pogledaj prijavu: Milan');
  // The mark is on its way: nothing is claimed yet, by the card or by the sheet that opened.
  expect(chips()).toEqual(['Poslata', 'Poslata', 'Poslata']);
  await act(async () => d.resolve({ ok: true, podatak: null }));
  // Milan's card and the sheet say it; Ana, never opened, is still "Poslata".
  expect(chips()).toEqual(['Viđena', 'Poslata', 'Viđena']);
  await closeOffer(); expect(chips()).toEqual(['Viđena', 'Poslata']);
});
it('does not claim "Viđena" where the mark failed, and says it on the next opening that the server confirms', async () => {
  const chips = () => tree!.root.findAll(node => String(node.type) === 'View' && node.props.testID === 'status-chip').map(node => node.props.accessibilityLabel);
  mockViewed.mockRejectedValueOnce(new Error('PRIVATE_SQL_DETAILS'));
  await render(Candidates); await tap('Pogledaj prijavu: Milan');
  expect(chips()).toEqual(['Poslata', 'Poslata']); expect(text()).toContain('nije označena kao viđena');
  await closeOffer(); expect(chips()).toEqual(['Poslata']);
  await tap('Pogledaj prijavu: Milan');
  expect(chips()).toEqual(['Viđena', 'Viđena']); expect(text()).not.toContain('nije označena kao viđena');
});
it('rejects a stale open handler after blur/refocus and an account incarnation change', async () => {
  await render(Candidates); const old = press('Pogledaj prijavu: Milan');
  mockFocused = false; await update(); await act(async () => old());
  mockFocused = true; await update(); await act(async () => old());
  expect(mockViewed).not.toHaveBeenCalled();
  const current = press('Pogledaj prijavu: Milan');
  mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 };
  await act(async () => current()); expect(mockViewed).not.toHaveBeenCalled();
});
it('does not surface an old view failure or select after an account switch', async () => {
  const d = deferred(); mockViewed.mockReturnValueOnce(d.promise);   await render(Candidates); await tap('Pogledaj prijavu: Milan');
  mockAccount = { user: { id: 'owner-b' }, accountRevision: 2 }; await update();
  await act(async () => d.resolve({ ok: false, kod: 'UNKNOWN', poruka: 'PRIVATE_SQL_DETAILS' }));
  expect(text()).not.toContain('PRIVATE_SQL_DETAILS'); expect(text()).not.toContain('nije označena kao viđena');
  expect(mockViewed).toHaveBeenCalledTimes(1); expect(mockSelect).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('sends one exact application after explicit interval review and duplicate taps', async () => {
  await offer(); await tap('Termin prijave');
  await edit('Datum početka', '2026-09-20'); await edit('Početak', '12:00');
  await edit('Datum kraja', '2026-09-20'); await edit('Kraj', '13:00'); await tap('Potvrdi termin');
  expect(mockSubmit).not.toHaveBeenCalled(); expect(text()).toContain('12:00–13:00');
  await reviewOffer();
  // r6: the review says the time is the worker's own proposal, with the task's window beside it, as the Termin row does.
  expect(text()).toContain('Tvoj predlog · termin zadatka je 20. sep · 10:00–11:00');
  const send = press('Pošalji ovu prijavu'); await act(async () => { send(); send(); });
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(mockSubmit.mock.calls[0][0]).toMatchObject({ potrebaRevizija: 3, pokrivenaMesta: 2, cenaRsd: 4500,
    predlozeniPocetak: '2026-09-20T10:00:00.000Z', predlozeniKraj: '2026-09-20T11:00:00.000Z' });
  expect(text()).toContain('Prijava je poslata.'); expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('opens exactly the confirmed application once, without another submission', async () => {
  await offer(); await sendOffer();
  const open = press('Otvori moje prijave');
  await act(async () => { open(); open(); });
  expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/moje-prijave', params: { prijavaId: k().prijavaId } });
  expect(mockSubmit).toHaveBeenCalledTimes(1);
});
// The receipt says the state the application will wear in "Moje prijave" from now on: the same chip, so the receipt and the list say one word.
it('the receipt of a sent application wears the chip it will wear in "Moje prijave": Poslata', async () => {
  await offer(); await sendOffer();
  const chips = tree!.root.findAll(node => String(node.type) === 'View' && node.props.testID === 'status-chip');
  expect(chips.map(node => node.props.accessibilityLabel)).toEqual(['Poslata']);
  expect(text()).toContain('Prijava je poslata.');
});
it.each(['blur', 'account'])('a confirmed application link cannot navigate after %s', async change => {
  await offer(); await sendOffer(); const open = press('Otvori moje prijave');
  if (change === 'blur') { mockFocused = false; await update(); }
  else mockAccount = { user: { id: 'owner-b' }, accountRevision: 2 };
  await act(async () => open()); expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('keeps offered price total and rejects trailing garbage or overfill', async () => {
  await offer(); expect(text()).toContain('Tvoja ukupna ponuda'); expect(text()).toContain('Za sve ljude koje dovodiš.');
  expect(tree!.root.findAll(node => node.props.accessibilityLabel === '4.500 RSD ukupno, dolaze 2 osobe')).not.toHaveLength(0);
  const review = () => tree!.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Pregledaj ponudu')[0];
  // The route's own guard stays authoritative: it is called directly with each bad draft, past the grey button.
  const routeSubmit = async () => { await act(async () => {
    await tree!.root.findByType(require('../../ui/v2/ApplicationSelectionPresentation').ApplicationSelectionPresentation).props.submit(); }); };
  await edit('Tvoja ukupna ponuda za ljude koje dovodiš (RSD)', '4500abc');
  // r6: the grey button's reason is the field's own sentence (it said "Cena mora biti ceo iznos u dinarima." beside it).
  expect(review().props.disabled).toBe(true); expect(review().props.accessibilityHint).toBe('Upiši ceo iznos u dinarima, bez tačaka i slova.');
  expect(text()).toContain('Upiši ceo iznos u dinarima, bez tačaka i slova.');
  await act(async () => review().props.onPress()); expect(press('Pošalji ovu prijavu')).toBeUndefined();
  await routeSubmit(); expect(mockSubmit).not.toHaveBeenCalled(); expect(mockStorage.size).toBe(0);
  await edit('Tvoja ukupna ponuda za ljude koje dovodiš (RSD)', '4500'); await edit('Koliko ljudi dolazi', '4');
  // The capacity appears once beside the count; the button says how to fix an overfill.
  expect(review().props.disabled).toBe(true); expect(review().props.accessibilityHint).toBe('Smanji broj ljudi na 3 da pregledaš ponudu.');
  expect(text().split('Traži 3 osobe')).toHaveLength(2);
  await act(async () => review().props.onPress()); expect(press('Pošalji ovu prijavu')).toBeUndefined();
  await routeSubmit(); expect(mockSubmit).not.toHaveBeenCalled(); expect(mockStorage.size).toBe(0);
});
it('unknown submit requires readback; absence never unlocks changed fields and exact original request retries', async () => {
  mockSubmit.mockResolvedValueOnce({ ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
  await offer(); await reviewOffer(); const oldSend = press('Pošalji ovu prijavu'); await sendOffer();
  await act(async () => { oldSend(); }); expect(mockSubmit).toHaveBeenCalledTimes(1);
  // What was sent is shown as facts while its outcome is unknown: there is no field left to change it with.
  expect(tree!.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0); expect(text()).toContain('4.500 RSD');
  // The route itself still refuses an edit while the command is pending, whatever the screen draws.
  const composer = () => tree!.root.findByType(require('../../ui/v2/ApplicationSelectionPresentation').ApplicationSelectionPresentation);
  await act(async () => composer().props.change({ ...composer().props.draft, price: '9999' }));
  expect(composer().props.draft.price).toBe('4500'); expect(text()).not.toContain('9.999');
  mockNeed.mockResolvedValue({ ...need(), revizija: 4 }); await tap('Proveri ishod');
  expect(tree!.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
  expect(mockApplications).toHaveBeenCalledTimes(2); expect(mockSubmit).toHaveBeenCalledTimes(1);
  await tap('Pošalji ponovo'); expect(mockSubmit.mock.calls[1][0]).toEqual(mockSubmit.mock.calls[0][0]);
  expect(mockSubmit.mock.calls[1][0].cenaRsd).toBe(4500); expect(mockSubmit.mock.calls[1][0].potrebaRevizija).toBe(3);
});
it('late application response after blur cannot navigate and in-flight request remains fenced on refocus', async () => {
  const d = deferred(); mockSubmit.mockReturnValueOnce(d.promise); await offer(); await sendOffer();
  mockFocused = false; await update(); mockFocused = true; await update();
  expect(mockSubmit).toHaveBeenCalledTimes(1); expect(press('Pošalji ponovo')).toBeUndefined();
  await act(async () => d.resolve({ ok: true, podatak: { prijavaId: k().prijavaId, verzija: 2, hash: k().hash } }));
  expect(mockRouter.replace).not.toHaveBeenCalled(); await tap('Proveri ishod');
  expect(text()).toContain('Prijava je poslata.');
});
it('old-account completion and retained callbacks cannot send or navigate after A→B→A', async () => {
  const d = deferred(); mockSubmit.mockReturnValueOnce(d.promise); await offer(); await reviewOffer(); const old = press('Pošalji ovu prijavu'); await sendOffer();
  mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 }; await update();
  await act(async () => { old(); d.resolve({ ok: true, podatak: { prijavaId: k().prijavaId, verzija: 2, hash: k().hash } }); });
  expect(mockSubmit).toHaveBeenCalledTimes(1); expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(text()).not.toContain('Prijava je poslata.');
});
// Updated deliberately (owner decision 2026-09-24, "1 DA"): the offer no longer lists the applicant's self-declared
// skills as labels; the rest of the path is unchanged.
it('shows the offer without skill labels, then confirms once and opens the exact existing Agreement route', async () => {
  await render(Candidates);
  expect(confirmChoice()).toBeUndefined(); expect(mockSelect).not.toHaveBeenCalled();
  await tap('Pogledaj prijavu: Milan'); expect(text()).not.toContain('Nošenje · Trake · Kombi');
  expect(text()).not.toContain('Sposobnosti'); expect(text()).not.toContain('Sačuvana samoizjava'); await tap('Izaberi ovu prijavu');
  expect(text()).toContain('Izabrati ovu prijavu?'); const choose = confirmChoice();
  await act(async () => { choose(); choose(); }); expect(mockSelect).toHaveBeenCalledTimes(1);
  expect(mockSelect.mock.calls[0][0]).toMatchObject({ potrebaRevizija: 3, prijavaVerzija: 2, prijavaHash: k().hash, mesta: 2 });
  const confirmation = tree!.root.findAll(node => String(node.type) === 'T' && node.props.children === 'Dogovor je sklopljen.');
  const marks = tree!.root.findAll(node => node.type === SuccessMark);
  expect(confirmation).toHaveLength(1); expect(marks).toHaveLength(1); expect(marks[0].props.fresh).toBe(true);
  const footer = tree!.root.findByProps({ testID: 'product-sheet-footer' });
  expect(footer.findAll(node => node.type === SuccessMark)).toEqual(marks);
  expect(footer.findAll(node => (String(node.type) === 'T' && node.props.children === 'Dogovor je sklopljen.')
    || (String(node.type) === 'Press' && node.props.accessibilityLabel === 'Otvori Dogovor'))
    .map(node => node.props.accessibilityLabel ?? node.props.children)).toEqual(['Dogovor je sklopljen.', 'Otvori Dogovor']);
  expect(mockRouter.replace).not.toHaveBeenCalled();
  await tap('Otvori Dogovor'); expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: agreement } });
});
// Step 7 (2026-09-24): the offer's one green action asks first, in the app's own confirmation, with the words that always
// stood before this choice; only its confirm runs the route's choose, whose guards are unchanged.
const brand = () => tree!.root.findAll(node => String(node.type) === 'Press' && [node.props.style].flat(3).filter(Boolean)
  .map((style: { backgroundColor?: string }) => style.backgroundColor).filter(Boolean).pop() === sys.color.green).map(node => node.props.accessibilityLabel);
it('choose reaches its confirmation with the exact words; a cancel sends nothing and one confirm sends the exact command once', async () => {
  await render(Candidates); expect(brand()).toEqual([]);
  await tap('Pogledaj prijavu: Milan'); expect(brand()).toEqual(['Izaberi ovu prijavu']);
  await tap('Izaberi ovu prijavu');
  // A question, and under it what is accepted (price, people, the term that applies: here the person's own proposal) and what follows.
  expect(text()).toContain('Izabrati ovu prijavu?');
  expect(text()).toContain('Prihvataš: 4.500 RSD ukupno · 2 osobe · 20. sep · 10:00–11:00 (po vremenu u Srbiji). Dogovor odmah važi za obe strane. '
    + 'Termin izabrane osobe ponovo se proverava pri izboru.');
  expect(mockSelect).not.toHaveBeenCalled();
  await tap('Odustani'); expect(confirmChoice()).toBeUndefined(); expect(mockSelect).not.toHaveBeenCalled();
  await tap('Izaberi ovu prijavu'); const confirm = confirmChoice();
  await act(async () => { confirm(); confirm(); });
  expect(mockSelect).toHaveBeenCalledTimes(1);
  expect(mockSelect.mock.calls[0][0]).toEqual({ potrebaId: mockId, potrebaRevizija: 3, prijavaId: k().prijavaId, prijavaVerzija: 2,
    prijavaHash: k().hash, mesta: 2, clientRequestId: expect.any(String) });
  expect(text()).toContain('Dogovor je sklopljen.'); expect(brand()).toEqual(['Otvori Dogovor']);
});
it('a question retained across a fresh read is retired and cannot choose; while the choice runs nothing closes the offer or sends twice', async () => {
  await selection(); const retained = confirmChoice();
  mockFocused = false; await update(); mockFocused = true; await update();
  expect(confirmChoice()).toBeUndefined();
  await act(async () => retained()); expect(mockSelect).not.toHaveBeenCalled();
  const d = deferred(); mockSelect.mockReturnValueOnce(d.promise);
  await tap('Pogledaj prijavu: Milan'); await tap('Izaberi ovu prijavu'); await tapConfirm();
  // The confirm says it is at work and cannot be pressed again; Back on the offer underneath does nothing meanwhile.
  expect(confirmNode().props.accessibilityState)
    .toEqual({ disabled: true, busy: true });
  await act(async () => sheets()[0].props.onRequestClose());
  expect(mockRouter.back).not.toHaveBeenCalled(); expect(sheets()).not.toHaveLength(0);
  await act(async () => d.resolve({ ok: true, podatak: { dogovorId: agreement } }));
  expect(mockSelect).toHaveBeenCalledTimes(1); expect(press('Otvori Dogovor')).toBeDefined();
});
it('stale candidate/Need read pair does not expose selection', async () => {
  mockCandidates.mockResolvedValue([{ ...k(), potrebaRevizija: 2 }]); await render(Candidates);
  expect(text()).toContain('Zadatak se upravo promenio'); expect(press('Pogledaj prijavu: Milan')).toBeUndefined(); expect(mockSelect).not.toHaveBeenCalled();
});
it('shows a legitimate STALE offer beside a current offer and permits choosing only the current one', async () => {
    mockCandidates.mockResolvedValue([
    { ...k(), prijavaId: agreement, ime: 'Ranija ponuda', stanje: 'STALE', mozeIzabrati: false, verzija: 1, potrebaRevizija: 3 }, k(),
  ]);
  await render(Candidates);
  // PKG-035: the total names every application ever sent; the ones still open to choose are counted apart.
  // V41 (2026-09-23): the free places moved to the task row at the top, the counts stand above the cards.
  expect(text()).toContain('2 prijave · 1 za izbor'); expect(text()).toContain('3 od 3 mesta je slobodno');
  // The card that cannot be chosen says why on its own bottom line, and the list says once what that means.
  const stale = tree!.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Pogledaj prijavu: Ranija ponuda')[0];
  expect(stale.findAll(node => String(node.type) === 'T' && node.props.children === 'Zadatak je izmenjen. Čekamo da osoba potvrdi prijavu.')).toHaveLength(1);
  expect(stale.props.accessibilityValue.text).toContain('Zadatak je izmenjen. Čekamo da osoba potvrdi prijavu.');
  expect(text()).toContain('Prijavu koja sada nije za izbor možeš da pročitaš, ali ne i da izabereš.');
  expect(press('Pogledaj prijavu: Ranija ponuda')).toBeDefined(); expect(press('Pogledaj prijavu: Milan')).toBeDefined();
  await tap('Pogledaj prijavu: Ranija ponuda'); expect(text()).toContain('Zadatak je izmenjen. Čekamo da osoba potvrdi prijavu.');
  expect(press('Izaberi ovu prijavu')).toBeUndefined(); expect(confirmChoice()).toBeUndefined();
  expect(text()).not.toContain('Dogovor je sklopljen.'); expect(tree!.root.findAll(node => node.type === SuccessMark)).toHaveLength(0);
  expect(press('Otvori Dogovor')).toBeUndefined();
  // An offer that cannot be chosen says so and carries the refresh it names, instead of ending there.
  expect(press('Osveži prijave')).toBeDefined();
  await closeOffer(); await tap('Pogledaj prijavu: Milan'); await tap('Izaberi ovu prijavu'); await tapConfirm();
  expect(mockSelect).toHaveBeenCalledTimes(1); expect(mockSelect.mock.calls[0][0]).toMatchObject({ prijavaId: k().prijavaId, potrebaRevizija: 3 });
});
// Review r4 rk item 1: a fresh read takes the blocked offer away; the list's back arrow then goes back on its first press
// (it used to spend that press clearing an offer nobody could see).
it('after a blocked offer is refreshed away, one press on the list’s back arrow goes back', async () => {
  mockCandidates.mockResolvedValue([{ ...k(), stanje: 'STALE', mozeIzabrati: false }]);
  await render(Candidates); await tap('Pogledaj prijavu: Milan');
  expect(sheets()).not.toHaveLength(0); expect(press('Izaberi ovu prijavu')).toBeUndefined();
  await tap('Osveži prijave');
  expect(sheets()).toHaveLength(0); expect(mockCandidates).toHaveBeenCalledTimes(2);
  await tap('Nazad na zadatak');
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  // An offer that is still on screen closes first, as before.
  await act(async () => tree!.unmount()); tree = undefined; mockRouter.back.mockClear();
  await render(Candidates); await tap('Pogledaj prijavu: Milan'); await closeOffer();
  expect(sheets()).toHaveLength(0); expect(mockRouter.back).not.toHaveBeenCalled();
});
it('retains exact selection on unknown even when fresh candidate state is SELECTED', async () => {
  mockSelect.mockResolvedValueOnce({ ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
  await selection(); await tapConfirm();
  expect(text()).not.toContain('Dogovor je sklopljen.'); expect(tree!.root.findAll(node => node.type === SuccessMark)).toHaveLength(0);
  expect(press('Otvori Dogovor')).toBeUndefined();
  mockCandidates.mockResolvedValue([{ ...k(), stanje: 'SELECTED', mozeIzabrati: false }]); await tap('Proveri ishod');
  expect(text()).not.toContain('Dogovor je sklopljen.'); expect(press('Otvori Dogovor')).toBeUndefined();
  await tap('Pošalji izbor ponovo'); expect(mockSelect.mock.calls[1][0]).toEqual(mockSelect.mock.calls[0][0]);
  await tap('Otvori Dogovor'); expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: agreement } });
});
it('selection late write on another account never reveals or opens its Agreement', async () => {
  const d = deferred(); mockSelect.mockReturnValueOnce(d.promise); await selection(); const stale = confirmChoice();
  await tapConfirm(); mockAccount = { user: { id: 'owner-b' }, accountRevision: 2 }; await update();
  await act(async () => { d.resolve({ ok: true, podatak: { dogovorId: agreement } }); stale(); });
  expect(mockSelect).toHaveBeenCalledTimes(1); expect(press('Otvori Dogovor')).toBeUndefined(); expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(text()).not.toContain('Dogovor je sklopljen.'); expect(tree!.root.findAll(node => node.type === SuccessMark)).toHaveLength(0);
});
it('same-row callback retained before an explicit refresh cannot select its old revision', async () => {
  await selection(); const stale = confirmChoice();
  mockFocused = false; await update(); mockFocused = true; await update();
  await act(async () => stale()); expect(mockSelect).not.toHaveBeenCalled();
});
it('binds displayed fixed price to the same Need revision and prevents editing that price', async () => {
  mockNeed.mockResolvedValue({ ...need(), rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 6000, valuta: 'RSD', prikaz: '6.000 RSD' } });
  mockTask.mockResolvedValue({ ...need(), primaNovePrijave: true, rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' } });
  await render();
  // A price the task names is a fact, not a field: nothing to type it into, and it is the Need's own amount.
  expect(tree!.root.findAll(node => String(node.type) === 'TextInput' && node.props.accessibilityLabel === 'Tvoja ukupna ponuda za ljude koje dovodiš (RSD)')).toHaveLength(0);
  expect(text()).toContain('6.000 RSD'); expect(text()).not.toContain('4.500 RSD');
  await sendOffer();
  expect(mockSubmit.mock.calls[0][0]).toMatchObject({ cenaRsd: 6000, potrebaRevizija: 3, predlozeniPocetak: null, predlozeniKraj: null });
});
// Deep read 8.10: rpc_submit_response prices a PER_PERSON application as amount × people and a TOTAL one
// as the amount for every place. The composer used to send the bare amount, so only one person could apply.
it('prices a per-person task by the people this application brings', async () => {
  const perPerson = { ...need(), rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 5000, valuta: 'RSD', prikaz: '5.000 RSD' } };
  mockNeed.mockResolvedValue(perPerson); mockTask.mockResolvedValue({ ...perPerson, primaNovePrijave: true });
  await render();
  const priceFields = () => tree!.root.findAll(node => String(node.type) === 'TextInput' && node.props.accessibilityLabel === 'Tvoja ukupna ponuda za ljude koje dovodiš (RSD)');
  expect(text()).toContain('5.000 RSD po osobi');
  expect(tree!.root.findAll(node => node.props.accessibilityLabel === 'Cena zadatka: 5.000 RSD po osobi')).not.toHaveLength(0);
  expect(priceFields()).toHaveLength(0);
  expect(tree!.root.findAll(node => node.props.accessibilityLabel === '5.000 RSD ukupno, dolazi 1 osoba')).not.toHaveLength(0);
  await tap('Jedna osoba više'); expect(text()).toContain('10.000 RSD ukupno');
  expect(tree!.root.findAll(node => node.props.accessibilityLabel === '10.000 RSD ukupno, dolaze 2 osobe')).not.toHaveLength(0);
  expect(priceFields()).toHaveLength(0);
  await sendOffer();
  expect(mockSubmit.mock.calls[0][0]).toMatchObject({ cenaRsd: 10000, pokrivenaMesta: 2, potrebaRevizija: 3 });
});
it('covers every place on a task whose price is for the whole task', async () => {
  const total = { ...need(), rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL', ponudjenaCena: { iznos: 18000, valuta: 'RSD', prikaz: '18.000 RSD' } };
  mockNeed.mockResolvedValue(total); mockTask.mockResolvedValue({ ...total, primaNovePrijave: true });
  await render();
  expect(text()).toContain('18.000 RSD ukupno'); expect(text()).toContain('18.000 RSD za ceo zadatak');
  expect(text()).toContain('Traži 3 osobe');
  expect(tree!.root.findAll(node => String(node.type) === 'TextInput' && node.props.accessibilityLabel === 'Koliko ljudi dolazi')).toHaveLength(0);
  expect(text()).toContain('Dolaze 3 osobe'); expect(press('Jedna osoba više')).toBeUndefined();
  await sendOffer();
  expect(mockSubmit.mock.calls[0][0]).toMatchObject({ cenaRsd: 18000, pokrivenaMesta: 3 });
});
it('rejects newly elapsed deadline on tap and exposes a fresh read, without dispatch', async () => {
  mockTask.mockResolvedValue({ ...need(), primaNovePrijave: true, rokZaPrijaveIso: '2020-01-01T00:00:00Z' });
  await offer(); await sendOffer(); expect(mockSubmit).not.toHaveBeenCalled();
  expect(text()).toContain('Rok za prijave je istekao'); expect(press('Osveži zadatak')).toBeDefined();
});
it('public profile panel uses the real public port and drops a late prior-account response', async () => {
  // The person at the head of the offer opens the profile (heard as the person, "Otvara javni profil" as its hint).
  const d = deferred(); mockPublic.mockReturnValueOnce(d.promise); await render(Candidates); await tap('Pogledaj prijavu: Milan');
  const open = person(); expect(open).toBeDefined(); await act(async () => { open(); });
  expect(mockPublic).toHaveBeenCalledWith(k().radnikProfilId);
  mockAccount = { user: { id: 'owner-b' }, accountRevision: 2 }; await update();
  await act(async () => d.resolve({ profilId: k().radnikProfilId, ime: 'Late prior-account profile', poverenje: {} }));
  expect(text()).not.toContain('Late prior-account profile');
});
it('a retained reset callback cannot discard a later successful selection receipt', async () => {
  mockSelect.mockResolvedValueOnce({ ok: false, kod: 'CALENDAR_RECHECK_REQUIRED', poruka: 'Proveri kalendar.' });
  await selection(); await tapConfirm(); await tap('Proveri ishod');
  const oldReset = press('Pregledaj aktuelne prijave'); expect(oldReset).toBeDefined();
  await tap('Pošalji izbor ponovo'); await act(async () => oldReset());
  expect(press('Otvori Dogovor')).toBeDefined(); expect(mockCandidates).toHaveBeenCalledTimes(2);
});
it('passes all received candidates to native virtualization with a bounded initial viewport', async () => {
  mockCandidates.mockResolvedValue(Array.from({ length: 600 }, (_, index) => ({ ...k(), prijavaId: `application-${index}`, ime: `Osoba ${index}` })));
  await render(Candidates);
  const list = tree!.root.findAll(node => String(node.type) === 'FlatList')[0];
  expect(list.props.data).toHaveLength(600); expect(list.props.initialNumToRender).toBe(8);
  expect(press('Pogledaj prijavu: Osoba 0')).toBeDefined(); expect(press('Pogledaj prijavu: Osoba 599')).toBeUndefined();
});
it('owned readback can replay only the frozen request when Need visibility closes after unknown submit', async () => {
  mockSubmit.mockResolvedValueOnce({ ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Proveri ishod.' });
  await offer(); await sendOffer(); mockTask.mockResolvedValue(null); mockNeed.mockResolvedValue(null);
  await tap('Proveri ishod'); expect(mockApplications).toHaveBeenCalledTimes(2);
  await tap('Pošalji ponovo'); expect(mockSubmit.mock.calls[1][0]).toEqual(mockSubmit.mock.calls[0][0]);
  expect(text()).toContain('Prijava je poslata.');
});

it('reopens an already selected application using its exact owned Agreement link', async () => {
  mockCandidates.mockResolvedValue([{ ...k(), stanje: 'SELECTED', mozeIzabrati: false }]);
  mockLinkQuery.mockResolvedValue({ data: { need_id: mockId, response_id: k().prijavaId, status: 'SELECTED', agreements: { id: agreement, need_id: mockId, selected_response_id: k().prijavaId } }, error: null });
  await render(Candidates); await tap('Pogledaj prijavu: Milan'); expect(mockLinkQuery).toHaveBeenCalledTimes(1);
  await tap('Otvori Dogovor'); expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: agreement } });
  expect(mockSelect).not.toHaveBeenCalled();
});
it('missing selected link remains read-only and can be explicitly reread', async () => {
  mockCandidates.mockResolvedValue([{ ...k(), stanje: 'SELECTED', mozeIzabrati: false }]);
  await render(Candidates); await tap('Pogledaj prijavu: Milan'); expect(press('Otvori Dogovor')).toBeUndefined();
  expect(text()).toContain('Veza sa Dogovorom trenutno nije dostupna');
  mockLinkQuery.mockResolvedValue({ data: { need_id: mockId, response_id: k().prijavaId, status: 'SELECTED', agreements: { id: agreement, need_id: mockId, selected_response_id: k().prijavaId } }, error: null });
  await tap('Proveri Dogovor'); expect(mockLinkQuery).toHaveBeenCalledTimes(2); expect(press('Otvori Dogovor')).toBeDefined();
  expect(mockSelect).not.toHaveBeenCalled();
});
it.each(['application', 'candidates'] as const)('bounds %s context read at 15 seconds and ignores its late generation', async surface => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
  try {
    const late = deferred();
    if (surface === 'application') mockTask.mockReturnValueOnce(late.promise);
    else { mockNeed.mockReturnValueOnce(late.promise); }
    await render(surface === 'application' ? Composer : Candidates);
    expect(text()).toContain('Učitavamo aktuelne podatke');
    await act(async () => { await jest.advanceTimersByTimeAsync(15001); });
    expect(text()).not.toContain('Učitavamo aktuelne podatke'); expect(press('Pokušaj ponovo')).toBeDefined();
    mockNeed.mockResolvedValue({ ...need(), naslov: 'Aktuelan pregled' });
    await tap('Pokušaj ponovo'); expect(text()).toContain('Aktuelan pregled');
    await act(async () => late.resolve({ ...need(), naslov: 'Zakasneli stari pregled', primaNovePrijave: true }));
    expect(text()).not.toContain('Zakasneli stari pregled'); expect(text()).toContain('Aktuelan pregled');
    expect(mockSubmit).not.toHaveBeenCalled(); expect(mockSelect).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});
// V41 (2026-09-23): the list can be ordered by the lowest total. The rows carry no time of sending, so the
// other order is the server's own (earliest first), named as such and never as "newest".
it('orders the loaded offers by the lowest total without a new read, keeps ties in arrival order, and keeps the order after opening an offer', async () => {
  const priced = (n: number, ime: string, iznos: number) => ({ ...k(), prijavaId: `10000000-0000-4000-8000-00000000001${n}`, ime,
    cena: { iznos, valuta: 'RSD', prikaz: `${iznos} RSD` } });
  mockCandidates.mockResolvedValue([priced(1, 'Prva', 6000), priced(2, 'Druga', 3000), priced(3, 'Treća', 3000)]);
  await render(Candidates);
  const order = () => tree!.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith('Pogledaj prijavu: '))
    .map(node => String(node.props.accessibilityLabel).slice('Pogledaj prijavu: '.length));
  expect(order()).toEqual(['Prva', 'Druga', 'Treća']);
  const reads = mockCandidates.mock.calls.length;
  await tap('Redosled prijava: Redom pristizanja'); await tap('Najniža cena');
  expect(order()).toEqual(['Druga', 'Treća', 'Prva']);
  expect(mockCandidates).toHaveBeenCalledTimes(reads); expect(mockViewed).not.toHaveBeenCalled();
  await tap('Pogledaj prijavu: Prva'); await closeOffer();
  expect(order()).toEqual(['Druga', 'Treća', 'Prva']); expect(press('Redosled prijava: Najniža cena')).toBeDefined();
  await tap('Redosled prijava: Najniža cena'); await tap('Redom pristizanja');
  expect(order()).toEqual(['Prva', 'Druga', 'Treća']);
});
it('the task row at the top opens the Task itself, once', async () => {
  await render(Candidates);
  const open = press('Otvori zadatak: Unos ormara'); expect(open).toBeDefined();
  await act(async () => { open(); open(); });
  expect(mockRouter.navigate.mock.calls).toEqual([[{ pathname: '/potrebe/[id]/pregled', params: { id: mockId } }]]);
  expect(mockViewed).not.toHaveBeenCalled(); expect(mockSelect).not.toHaveBeenCalled();
});

it('retires an offer confirmation in the background and rereads before another selection', async () => {
  await selection(); const oldConfirm = confirmChoice();
  await background('background');
  expect(text()).not.toContain('Dolazimo sa trakama.'); expect(confirmChoice()).toBeUndefined();
  await act(async () => oldConfirm()); expect(mockSelect).not.toHaveBeenCalled();
  const late = deferred(); mockCandidates.mockReturnValueOnce(late.promise);
  await background('active');
  expect(text()).toContain('Učitavamo aktuelne podatke'); expect(press('Izaberi ovu prijavu')).toBeUndefined();
  await act(async () => oldConfirm()); expect(mockSelect).not.toHaveBeenCalled();
  await act(async () => late.resolve([{ ...k(), stanje: 'WITHDRAWN', mozeIzabrati: false }]));
  await tap('Pogledaj prijavu: Milan'); expect(press('Izaberi ovu prijavu')).toBeUndefined();
  expect(mockCandidates).toHaveBeenCalledTimes(2); expect(mockSelect).not.toHaveBeenCalled();
});
it('keeps comparison and sort across a foreground reread, scoped to the same task and account', async () => {
  mockCandidates.mockResolvedValue([k(), { ...k(), prijavaId: 'second', ime: 'Ana', cena: { iznos: 3000, valuta: 'RSD', prikaz: '3.000 RSD' } }]);
  await render(Candidates); await tap('Uporedi'); await tap('Redosled prijava: Redom pristizanja'); await tap('Najniža cena');
  expect(text()).toContain('Uporedi prijave');
  await background('inactive'); await background('active');
  expect(text()).toContain('Uporedi prijave'); expect(press('Redosled prijava: Najniža cena')).toBeDefined();
  expect(mockCandidates).toHaveBeenCalledTimes(2);
  mockAccount = { user: { id: 'owner-b' }, accountRevision: 2 }; await update();
  expect(text()).not.toContain('Uporedi prijave'); expect(press('Redosled prijava: Redom pristizanja')).toBeDefined();
  expect(mockSelect).not.toHaveBeenCalled();
});
it('ignores a read that settles after its foreground visit was retired', async () => {
  const retired = deferred(), fresh = deferred();
  mockCandidates.mockReturnValueOnce(retired.promise).mockReturnValueOnce(fresh.promise);
  await render(Candidates); await background('background'); await background('active');
  await act(async () => retired.resolve([{ ...k(), ime: 'Zakasnela osoba' }]));
  expect(text()).not.toContain('Zakasnela osoba'); expect(text()).toContain('Učitavamo aktuelne podatke');
  await act(async () => fresh.resolve([{ ...k(), ime: 'Aktuelna osoba' }]));
  expect(press('Pogledaj prijavu: Aktuelna osoba')).toBeDefined(); expect(text()).not.toContain('Zakasnela osoba');
  expect(mockViewed).not.toHaveBeenCalled(); expect(mockSelect).not.toHaveBeenCalled();
});
it('keeps an in-flight selection as the same pending command across foreground return', async () => {
  const late = deferred(); mockSelect.mockReturnValueOnce(late.promise);
  await selection(); await tapConfirm(); const sent = mockSelect.mock.calls[0][0];
  await background('background'); await background('active');
  expect(press('Povezivanje…')).toBeDefined(); expect(mockSelect).toHaveBeenCalledTimes(1);
  await act(async () => late.resolve({ ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Proveri ishod.' }));
  expect(press('Proveri ishod')).toBeDefined(); await tap('Proveri ishod'); await tap('Pošalji izbor ponovo');
  expect(mockSelect.mock.calls[1][0]).toEqual(sent); expect(press('Otvori Dogovor')).toBeDefined();
});

// Round 6 (unit prijava, 2026-09-24): the composer reads as a checkout step.
describe('the composer as a checkout step', () => {
  const inputs = (label: string) => tree!.root.findAll(node => String(node.type) === 'TextInput' && node.props.accessibilityLabel === label);
  const step = (label: string) => tree!.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0];
  it('shows the task as its own face, with the places a worker asks about and never the owner\'s progress', async () => {
    await render();
    expect(text()).toContain('Unos ormara'); expect(text()).toContain('Tražim ponude'); expect(text()).toContain('Traži 3 osobe');
    expect(text()).not.toContain('0 / 3'); expect(text()).not.toContain('popunjeno');
    expect(tree!.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel === 'Unos ormara, Liman 2, Novi Sad, Tražim ponude')).not.toHaveLength(0);
  });
  it('steps the people between one and the places left, and says so when the typed number is too many', async () => {
    await render();
    expect(step('Jedna osoba manje').props.disabled).toBe(true); expect(step('Jedna osoba više').props.disabled).toBe(false);
    await tap('Jedna osoba više'); await tap('Jedna osoba više');
    expect(inputs('Koliko ljudi dolazi')[0].props.value).toBe('3');
    expect(step('Jedna osoba više').props.disabled).toBe(true); expect(step('Jedna osoba manje').props.disabled).toBe(false);
    await tap('Jedna osoba više'); expect(inputs('Koliko ljudi dolazi')[0].props.value).toBe('3');
    await tap('Jedna osoba manje'); expect(inputs('Koliko ljudi dolazi')[0].props.value).toBe('2');
    await edit('Koliko ljudi dolazi', '');
    const review = step('Pregledaj ponudu');
    expect(review.props.disabled).toBe(true); expect(review.props.accessibilityHint).toBe('Upiši svoju cenu da pregledaš ponudu.');
    await edit('Tvoja ukupna ponuda za ljude koje dovodiš (RSD)', '4500');
    expect(step('Pregledaj ponudu').props.accessibilityHint).toBe('Upiši koliko ljudi dolazi.'); expect(text()).toContain('broj ljudi nije upisan');
    await edit('Koliko ljudi dolazi', '0'); expect(step('Pregledaj ponudu').props.accessibilityHint).toBe('Upiši koliko ljudi dolazi.');
    await edit('Koliko ljudi dolazi', '2'); expect(step('Pregledaj ponudu').props.disabled).toBe(false);
    expect(mockSubmit).not.toHaveBeenCalled();
  });
  it('the stepper starts again from one when the typed count is not a number, and steps down from too many', async () => {
    await render(); await edit('Koliko ljudi dolazi', 'abc');
    expect(step('Jedna osoba manje').props.disabled).toBe(true);
    await tap('Jedna osoba više'); expect(inputs('Koliko ljudi dolazi')[0].props.value).toBe('1');
    await edit('Koliko ljudi dolazi', '7');
    expect(step('Jedna osoba više').props.disabled).toBe(true); expect(step('Jedna osoba manje').props.disabled).toBe(false);
    await tap('Jedna osoba manje'); expect(inputs('Koliko ljudi dolazi')[0].props.value).toBe('6');
  });
  it('a task without its named price says so in words and cannot be reviewed', async () => {
    const unpriced = { ...need(), rezimCene: 'MY_PRICE', ponudjenaCena: undefined };
    mockNeed.mockResolvedValue(unpriced); mockTask.mockResolvedValue({ ...unpriced, primaNovePrijave: true });
    await render();
    expect(text()).toContain('Cena nije navedena'); expect(text()).not.toMatch(/\d RSD/);
    // r6: no rule sentence claims a price that is not there ("Cena je navedena u Zadatku…" stood right under the row).
    expect(text()).not.toContain('Cena je navedena');
    expect(step('Pregledaj ponudu').props.accessibilityHint).toBe('Zadatak nema navedenu cenu. Osveži zadatak.');
    // The reason names a fresh read, and the way to it stands under the grey button.
    const reads = mockNeed.mock.calls.length; await tap('Osveži zadatak'); expect(mockNeed.mock.calls.length).toBe(reads + 1);
  });
  // r6: a price the task names is said once, by the "Cena zadatka" row; the task face keeps only its title. "Tražim
  // ponude" stays in the corner of a task that takes offers (the first test of this group), and no green action carries a glyph.
  it('says a named price once and keeps the task face to its title, heard without the amount', async () => {
    const perPerson = { ...need(), rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 5000, valuta: 'RSD', prikaz: '5.000 RSD' } };
    mockNeed.mockResolvedValue(perPerson); mockTask.mockResolvedValue({ ...perPerson, primaNovePrijave: true });
    await render();
    const amounts = () => tree!.root.findAll(node => String(node.type) === 'T' && node.props.children === '5.000 RSD');
    expect(amounts()).toHaveLength(1); expect(text()).toContain('5.000 RSD po osobi');
    const head = tree!.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Unos ormara, '));
    expect(head).toHaveLength(1); expect(head[0].props.accessibilityLabel).toBe('Unos ormara, Liman 2, Novi Sad');
    expect(text()).toContain('Traži 3 osobe');
    expect(step('Termin prijave').props.accessibilityValue.text).toContain('10:00–11:00');
    expect(step('Pregledaj ponudu').props.icon).toBeUndefined();
  });
  it('a task that no longer takes applications locks its fields and offers the other tasks beside the reason', async () => {
    await offer();
    mockTask.mockResolvedValue({ ...need(), primaNovePrijave: false, rokZaPrijaveIso: null });
    mockFocused = false; await update(); mockFocused = true; await update();
    expect(text()).toContain('Zadatak više ne prima prijave.'); expect(step('Pregledaj ponudu').props.disabled).toBe(true);
    for (const label of ['Tvoja ukupna ponuda za ljude koje dovodiš (RSD)', 'Koliko ljudi dolazi', 'Poruka uz prijavu']) expect(inputs(label)[0].props.editable).toBe(false);
    expect(step('Jedna osoba više').props.disabled).toBe(true); expect(step('Termin prijave').props.disabled).toBe(true);
    await edit('Tvoja ukupna ponuda za ljude koje dovodiš (RSD)', '9999'); expect(inputs('Tvoja ukupna ponuda za ljude koje dovodiš (RSD)')[0].props.value).toBe('4500');
    const go = press('Pogledaj druge zadatke'); expect(go).toBeDefined();
    await act(async () => { go(); go(); });
    expect(mockRouter.replace.mock.calls).toEqual([['/zadaci']]); expect(mockSubmit).not.toHaveBeenCalled();
  });
  it('after the send, the fields give way to the success mark and the facts of what was sent, with its currency', async () => {
    await offer(); await sendOffer();
    expect(text()).toContain('Prijava je poslata.'); expect(tree!.root.findAll(node => node.type === SuccessMark)).toHaveLength(1);
    expect(tree!.root.findAll(node => node.type === SuccessMark)[0].props.fresh).toBe(true);
    expect(text()).toContain('4.500 RSD'); expect(text()).toContain('2 osobe');
    expect(tree!.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
    expect(press('Otvori moje prijave')).toBeDefined(); expect(press('Pregledaj ponudu')).toBeUndefined();
  });
});
