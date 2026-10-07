import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockTask = jest.fn(), mockNeed = jest.fn(), mockProfile = jest.fn(), mockSubmit = jest.fn(), mockSelect = jest.fn(), mockCandidates = jest.fn(), mockApplications = jest.fn(), mockPublic = jest.fn();
const mockViewed = jest.fn();
const mockSource = { prilika: mockTask, potreba: mockNeed, mojRadnikProfil: mockProfile, podnesiPrijavu: mockSubmit,
  izaberiPrijavu: mockSelect, prijaveZaPotrebu: mockCandidates, mojePrijave: mockApplications, javniProfil: mockPublic, oznaciPrijavuVidjenom: mockViewed };
const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
let mockId: string | undefined = '10000000-0000-4000-8000-000000000001', mockFocused = true;
let mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
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
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }) } }));
import Composer from '../../app/(app)/prilike/[id]/prijava';
import Candidates from '../../app/(app)/potrebe/[id]/kandidati';
import { ApplicationSelectionPresentation } from '../../ui/v2/ApplicationSelectionPresentation';
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
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; };
beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true; mockId = '10000000-0000-4000-8000-000000000001';
  mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 }; mockRouter.canGoBack.mockReturnValue(true);
  mockNeed.mockResolvedValue(need()); mockTask.mockResolvedValue({ ...need(), primaNovePrijave: true, rokZaPrijaveIso: null });
  mockProfile.mockResolvedValue({ id: '10000000-0000-4000-8000-000000000002', stanje: 'ACTIVE' });
  mockCandidates.mockResolvedValue([k()]); mockApplications.mockResolvedValue([]);
  mockSubmit.mockResolvedValue({ ok: true, podatak: { prijavaId: k().prijavaId, verzija: 2, hash: k().hash } });
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
async function selection() { await render(Candidates); await tap('Pogledaj ponudu: Milan'); await tap('Pregledaj povezivanje'); }

it('rearms read and Retry after returning to the same retained tab', async () => {
  mockNeed.mockResolvedValue({ ...need(), naslov: 'Restored task' });
  mockTask.mockRejectedValueOnce(new Error('first outage')).mockRejectedValueOnce(new Error('second outage'))
    .mockResolvedValueOnce({ ...need(), naslov: 'Restored task', primaNovePrijave: true });
  await render(); await tap('Nazad na zadatak');
  mockFocused = false; await update(); expect(mockTask).toHaveBeenCalledTimes(1);
  mockFocused = true; await update(); expect(mockTask).toHaveBeenCalledTimes(2);
  expect(text()).toContain('Podatke za prijavu trenutno nije moguće učitati');
  const retry = press('Pokušaj ponovo'); await act(async () => { retry(); retry(); });
  expect(mockTask).toHaveBeenCalledTimes(3); expect(press('Pregledaj ponudu')).toBeDefined();
  expect(text()).toContain('Restored task'); expect(mockSubmit).not.toHaveBeenCalled();
});
it('ignores a late blurred read and revalidates next focus', async () => {
  const d = deferred(); mockTask.mockReturnValueOnce(d.promise).mockRejectedValueOnce(new Error('current outage'));
  await render(); mockFocused = false; await update();
  await act(async () => d.resolve({ ...need(), naslov: 'Late private context' }));
  expect(text()).not.toContain('Late private context'); expect(press('Pregledaj ponudu')).toBeUndefined();
  mockFocused = true; await update(); expect(mockTask).toHaveBeenCalledTimes(2);
  expect(text()).toContain('Podatke za prijavu trenutno nije moguće učitati'); expect(mockSubmit).not.toHaveBeenCalled();
});
it('recovers the actual composer from a rejected detail read without leaking errors or mutating', async () => {
  mockTask.mockRejectedValueOnce(new Error('private transport detail')).mockResolvedValueOnce({ ...need(), primaNovePrijave: true });
  await render(); expect(text()).toContain('Podatke za prijavu trenutno nije moguće učitati'); expect(text()).not.toContain('private');
  const retry = press('Pokušaj ponovo'); await act(async () => { retry(); retry(); });
  expect(mockTask).toHaveBeenCalledTimes(2); expect(press('Pregledaj ponudu')).toBeDefined(); expect(mockSubmit).not.toHaveBeenCalled();
});
it('refuses a submission when the authoritative task gate says remaining search is closed', async () => {
  // r6: a closed task locks the fields, so the draft is filled while the task is open and the task closes on a re-read;
  // the route's guard is then called with that draft, so its order (price and people first, then the task) stays pinned.
  await offer();
  mockTask.mockResolvedValue({ ...need(), primaNovePrijave: false, rokZaPrijaveIso: null });
  mockFocused = false; await update(); mockFocused = true; await update();
  const review = tree!.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Pregledaj ponudu')[0];
  expect(review.props.disabled).toBe(true);
  // The grey button says why (owner, 2026-09-23): the reason stands under it, with the way on beside it.
  expect(text()).toContain('Zadatak više ne prima prijave.'); expect(press('Pogledaj druge zadatke')).toBeDefined();
  expect(tree!.root.findAll(node => String(node.type) === 'TextInput' && node.props.accessibilityLabel === 'Koliko ljudi dolazi')[0].props.editable).toBe(false);
  // Exercise the unchanged route guard directly, even though the presentation prevents entry.
  const presentation = tree!.root.findByType(require('../../ui/v2/ApplicationSelectionPresentation').ApplicationSelectionPresentation);
  await act(async () => { await presentation.props.submit(); });
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(text()).toContain('Proveri aktuelni zadatak i aktivan radni profil.');
});
// Round 2c (verifier va, should 5): the composer's block branch was pinned only by its text. The review button carries
// the reason as its own line and spoken hint; the way out stands beside it; while a send runs the reason has its own line.
const PROFILE_REASON = 'Radni profil još nije aktivan — bez njega ponuda ne može da se pošalje.';
const reasonLines = () => tree!.root.findAll(node => String(node.type) === 'T' && node.props.children === PROFILE_REASON);
it('with the worker profile not active, the review button says why once, as its line and its hint, and the link opens the profile', async () => {
  mockProfile.mockResolvedValue({ id: '10000000-0000-4000-8000-000000000002', stanje: 'DRAFT' });
  await offer();
  const review = tree!.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Pregledaj ponudu')[0];
  expect(review.props.disabled).toBe(true); expect(review.props.accessibilityHint).toBe(PROFILE_REASON);
  // Drawn once, under the button, and not read there a second time: the hint already says it.
  expect(text().split(PROFILE_REASON)).toHaveLength(2);
  expect(reasonLines()).toHaveLength(1); expect(reasonLines()[0].props.accessibilityElementsHidden).toBe(true);
  await tap('Dopuni radni profil');
  expect(mockRouter.push).toHaveBeenCalledWith('/profil/radnik'); expect(mockSubmit).not.toHaveBeenCalled();
});
it('while a send is in flight, the reason stands in its own live line beside the working button', async () => {
  mockProfile.mockResolvedValue({ id: '10000000-0000-4000-8000-000000000002', stanje: 'DRAFT' });
  await offer();
  // The same props the route handed the composer, drawn while its own send runs.
  const props = tree!.root.findByType(ApplicationSelectionPresentation).props as React.ComponentProps<typeof ApplicationSelectionPresentation>;
  await act(async () => tree!.unmount());
  await act(async () => { tree = create(<ApplicationSelectionPresentation {...props} busy />); });
  const sending = tree!.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Slanje…')[0];
  expect(sending.props.accessibilityState).toEqual({ disabled: true, busy: true }); expect(sending.props.accessibilityHint).toBeUndefined();
  expect(reasonLines()).toHaveLength(1);
  expect(reasonLines()[0].props.accessibilityLiveRegion).toBe('polite'); expect(reasonLines()[0].props.accessibilityElementsHidden).toBeUndefined();
  expect(press('Dopuni radni profil')).toBeDefined();
});
it('a SQLSTATE-bound refusal is settled immediately, while its journal survives until the explicit new-offer choice', async () => {
  mockSubmit.mockResolvedValue({ ok: false, kod: 'NEED_NOT_OPEN', poruka: 'Zadatak više ne prima prijave i izbore.',
    applicationRefusal: true, hardBlockers: [] });
  await offer(); await sendOffer();
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(press('Proveri ishod')).toBeUndefined(); expect(press('Sastavi novu ponudu')).toBeDefined();
  expect(text()).toContain('Ova ponuda nije primljena. Zadatak više ne prima prijave i izbore.');
  const key = `uskoci.application.command.v1.owner-a.${mockId}`;
  expect(mockStorage.has(key)).toBe(true);
  await tap('Sastavi novu ponudu');
  expect(mockStorage.has(key)).toBe(false); expect(press('Pregledaj ponudu')).toBeDefined();
});
it('shows allowlisted eligibility guidance and correction links without changing the frozen pending command', async () => {
  mockSubmit.mockResolvedValue({ ok: false, kod: 'WORKER_NOT_ELIGIBLE', poruka: 'Radni profil ili dostupnost ne ispunjavaju uslove Zadatka.',
    applicationRefusal: true, hardBlockers: ['MISSING_REQUIRED_TOOL', 'CALENDAR_CONFLICT'] });
  await offer(); await sendOffer();
  const original = mockSubmit.mock.calls[0][0];
  expect(text()).toContain('Radnom profilu nedostaje alat koji ovaj zadatak zahteva.');
  expect(text()).toContain('Termin se preklapa sa već potvrđenim Dogovorom.');
  expect(press('Dopuni radni profil')).toBeDefined(); expect(press('Otvori raspored')).toBeDefined();
  expect(press('Proveri ishod')).toBeUndefined(); expect(press('Sastavi novu ponudu')).toBeDefined();
  await tap('Dopuni radni profil'); expect(mockRouter.push).toHaveBeenCalledWith('/profil/radnik');
  expect(mockSubmit.mock.calls[0][0]).toEqual(original);
  expect(mockStorage.size).toBe(1);
});
it.each([
  ['eligibility message without proof', { ok: false, kod: 'WORKER_NOT_ELIGIBLE', poruka: 'Radni profil ili dostupnost ne ispunjavaju uslove Zadatka.' }],
  ['reused key', { ok: false, kod: 'IDEMPOTENCY_KEY_REUSED', poruka: 'Ovaj zahtev je već vezan za drugu ponudu. Proveri sačuvano stanje.' }],
] as const)('%s plus a fresh collection read cannot release an uncertain journal', async (_label, failure) => {
  mockSubmit.mockResolvedValueOnce(failure);
  await offer(); await sendOffer();
  const key = `uskoci.application.command.v1.owner-a.${mockId}`;
  expect(mockStorage.has(key)).toBe(true); expect(press('Proveri ishod')).toBeDefined();
  await tap('Proveri ishod');
  expect(mockStorage.has(key)).toBe(true); expect(press('Sastavi novu ponudu')).toBeUndefined();
  expect(press('Pošalji ponovo')).toBeDefined();
});
it('shows successful unavailability and a single real detail fallback navigation', async () => {
  mockTask.mockResolvedValue(null); mockRouter.canGoBack.mockReturnValue(false); await render();
  expect(text()).toContain('Podaci za prijavu nisu dostupni'); expect(press('Pregledaj ponudu')).toBeUndefined();
  const back = press('Nazad na zadatak'); await act(async () => { back(); back(); });
  expect(mockRouter.replace.mock.calls).toEqual([[{ pathname: '/prilike/[id]', params: { id: mockId } }]]);
});
it('keeps Back usable while read is unfinished', async () => {
  mockTask.mockReturnValue(new Promise(() => {})); await render(); await tap('Nazad na zadatak');
  expect(mockRouter.back).toHaveBeenCalledTimes(1); expect(mockSubmit).not.toHaveBeenCalled();
});
it('does not start an invalid route read or remain loading', async () => {
  mockId = undefined; await render(); expect(mockTask).not.toHaveBeenCalled();
  expect(text()).toContain('Podaci za prijavu nisu dostupni'); expect(text()).not.toContain('Učitavamo');
});
describe('PKG-006 durable application command identity (GAP-0031)', () => {
  const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage').default as { setItem: jest.Mock; removeItem: jest.Mock };
  const JOURNAL = () => `uskoci.application.command.v1.owner-a.${mockId}`;
  const unconfirmed = { ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' };
  const field = (label: string) => tree!.root.findAll(node => String(node.type) === 'TextInput' && node.props.accessibilityLabel === label)[0].props;
  const remount = async () => { await act(async () => tree?.unmount()); tree = undefined; await render(); };
  it('a lost ACK survives a route remount: the original command is restored, never resent automatically, retried with the same key and payload, and cleared on the receipt', async () => {
    mockSubmit.mockResolvedValueOnce(unconfirmed);
    await offer(); await sendOffer();
    const original = mockSubmit.mock.calls[0][0];
    expect([...mockStorage.keys()]).toEqual([JOURNAL()]);
    expect(mockStorage.get(JOURNAL())).not.toMatch(/Milan|4\.500|Unos ormara/);
    expect(AsyncStorage.setItem.mock.invocationCallOrder[0]).toBeLessThan(mockSubmit.mock.invocationCallOrder[0]);
    await remount();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(press('Pošalji ponovo')).toBeDefined(); expect(press('Pregledaj ponudu')).toBeUndefined();
    // r6: the saved offer stands under its own heading, in plain words (it said "Sačuvana je ista ponuda za proveru
    // ishoda. Ponavljanje koristi…"); the notice says what a repeat does without claiming the send arrived or not.
    expect(text()).toContain('Tvoja prijava'); expect(text()).toContain('Termin, cena i broj ljudi ostaju isti.');
    expect(text()).toContain('Ne znamo da li je prijava stigla. Pošalji istu ponudu još jednom — ako je već stigla, neće se udvostručiti.');
    expect(text()).not.toContain('sačuvani zahtev');
    // The saved command is shown as facts, never as greyed fields that look editable.
    expect(text()).toContain('4.500 RSD'); expect(text()).toContain('2 osobe');
    expect(tree!.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
    await tap('Pošalji ponovo');
    expect(mockSubmit).toHaveBeenCalledTimes(2); expect(mockSubmit.mock.calls[1][0]).toEqual(original);
    expect(mockSubmit.mock.calls[1][0].clientRequestId).toBe(original.clientRequestId);
    expect(text()).toContain('Prijava je poslata.'); expect(mockStorage.size).toBe(0);
    await remount();
    expect(press('Pregledaj ponudu')).toBeDefined(); expect(press('Pošalji ponovo')).toBeUndefined();
  });
  it('the identity is journaled before the send; a storage failure prevents the send and keeps the composer editable', async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk full details'));
    await offer(); await sendOffer();
    expect(mockSubmit).not.toHaveBeenCalled(); expect(text()).toContain('nije sačuvan na uređaju'); expect(text()).not.toContain('disk full details');
    // A fresh read of the task cannot fix a phone that could not save: no refresh is offered beside it.
    expect(press('Osveži zadatak')).toBeUndefined();
    expect(press('Pregledaj ponudu')).toBeDefined(); expect(field('Koliko ljudi dolazi').editable).toBe(true);
    await sendOffer();
    expect(mockSubmit).toHaveBeenCalledTimes(1); expect(text()).toContain('Prijava je poslata.');
  });
  it('another account cannot see or erase the pending command; the same account restores it after a later incarnation', async () => {
    mockSubmit.mockResolvedValueOnce(unconfirmed);
    await offer(); await sendOffer();
    const key = JOURNAL();
    mockAccount = { user: { id: 'owner-b' }, accountRevision: 1 };
    await remount();
    expect(press('Pošalji ponovo')).toBeUndefined(); expect(press('Pregledaj ponudu')).toBeDefined();
    expect(mockStorage.has(key)).toBe(true); expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 };
    await remount();
    expect(press('Pošalji ponovo')).toBeDefined(); expect(mockSubmit).toHaveBeenCalledTimes(1);
  });
  it('a journal read that lands after an account change is not applied', async () => {
    mockSubmit.mockResolvedValueOnce(unconfirmed);
    await offer(); await sendOffer();
    const held = deferred();
    const AsyncStorageMock = jest.requireMock('@react-native-async-storage/async-storage').default as { getItem: jest.Mock };
    AsyncStorageMock.getItem.mockReturnValueOnce(held.promise);
    await act(async () => tree?.unmount()); tree = undefined;
    await act(async () => { tree = create(React.createElement(Composer)); });
    mockAccount = { user: { id: 'owner-b' }, accountRevision: 1 };
    await act(async () => { tree!.update(React.createElement(Composer)); held.resolve(mockStorage.get(JOURNAL()) ?? null); });
    expect(press('Pošalji ponovo')).toBeUndefined(); expect(mockSubmit).toHaveBeenCalledTimes(1);
  });
  it('a corrupt journal value is discarded without stranding the composer', async () => {
    mockStorage.set(JOURNAL(), '{"version":1,"accountId":"owner-a","needId":"garbage"}');
    await render();
    expect(press('Pošalji ponovo')).toBeUndefined(); expect(AsyncStorage.removeItem).toHaveBeenCalledWith(JOURNAL());
    expect(text()).toContain('nije čitljiv');
    await edit('Tvoja ukupna ponuda za ljude koje dovodiš (RSD)', '4500'); await edit('Koliko ljudi dolazi', '2'); await sendOffer();
    expect(mockSubmit).toHaveBeenCalledTimes(1); expect(text()).toContain('Prijava je poslata.');
  });
  it('a known refusal of the retried command permits a reset that clears the journal; an unknown outcome keeps it', async () => {
    mockSubmit.mockResolvedValueOnce(unconfirmed);
    await offer(); await sendOffer();
    await remount();
    mockSubmit.mockResolvedValueOnce(unconfirmed);
    await tap('Pošalji ponovo');
    expect(mockStorage.has(JOURNAL())).toBe(true); expect(press('Sastavi novu ponudu')).toBeUndefined();
    await tap('Proveri ishod');
    mockSubmit.mockResolvedValueOnce({ ok: false, kod: 'STALE_REVIEW_REQUIRED',
      poruka: 'Zadatak ili Prijava su promenjeni. Pregledaj aktuelne podatke pre novog izbora.',
      applicationRefusal: true, hardBlockers: [] });
    await tap('Pošalji ponovo');
    expect(text()).toContain('Zadatak ili Prijava su promenjeni'); expect(mockStorage.has(JOURNAL())).toBe(true);
    expect(press('Proveri ishod')).toBeUndefined(); expect(press('Sastavi novu ponudu')).toBeDefined();
    expect(text()).toContain('Ova ponuda nije primljena. Zadatak ili Prijava su promenjeni.');
    expect(text()).not.toContain('Pošalji istu ponudu'); expect(text()).not.toContain('ostaju isti');
    await tap('Sastavi novu ponudu');
    expect(mockStorage.size).toBe(0); expect(press('Pregledaj ponudu')).toBeDefined();
  });
  it('a malformed receipt from the retried command stays unconfirmed and keeps the journal', async () => {
    mockSubmit.mockResolvedValueOnce(unconfirmed);
    await offer(); await sendOffer();
    await remount();
    mockSubmit.mockResolvedValueOnce({ ok: false, kod: 'APPLICATION_SELECTION_INVALID_RECEIPT', poruka: 'Server nije vratio potpunu potvrdu radnje.' });
    await tap('Pošalji ponovo');
    expect(text()).not.toContain('Prijava je poslata.'); expect(mockStorage.has(JOURNAL())).toBe(true);
    expect(press('Proveri ishod')).toBeDefined(); expect(press('Sastavi novu ponudu')).toBeUndefined();
  });
});


// R18 storage integrity: real route + durable journal, with only the native storage boundary mocked.
import { applicationCommandJournal as durableJournal } from '../applicationCommandJournal';
describe('R18 storage integrity', () => {
  const storage = jest.requireMock('@react-native-async-storage/async-storage').default as {
    getItem: jest.Mock; setItem: jest.Mock; removeItem: jest.Mock;
  };
  const key = () => 'uskoci.application.command.v1.owner-a.' + mockId;
  const refusal = () => ({ ok: false, kod: 'WORKER_NOT_ELIGIBLE',
    poruka: 'Radni profil ili dostupnost ne ispunjavaju uslove Zadatka.',
    applicationRefusal: true, hardBlockers: ['MISSING_REQUIRED_TOOL'] });
  const unknown = { ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' };
  const rejectedOffer = async () => { mockSubmit.mockResolvedValueOnce(refusal()); await offer(); await sendOffer(); };
  const form = () => tree!.root.findAll(node => String(node.type) === 'TextInput');
  const presentation = () => tree!.root.findByType(ApplicationSelectionPresentation);

  it('failed retirement keeps the refused command and never opens a new offer until storage succeeds', async () => {
    await rejectedOffer(); const bytes = mockStorage.get(key());
    storage.removeItem.mockRejectedValueOnce(new Error('private storage failure'));
    await tap('Sastavi novu ponudu');
    expect(mockStorage.get(key())).toBe(bytes);
    expect(form()).toHaveLength(0);
    expect(press('Pregledaj ponudu')).toBeUndefined();
    expect(press('Sastavi novu ponudu')).toBeDefined();
    expect(text()).not.toContain('private storage failure');
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    await tap('Sastavi novu ponudu');
    expect(mockStorage.has(key())).toBe(false);
    expect(press('Pregledaj ponudu')).toBeDefined();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it('double reset waits for one durable removal and an old reset cannot erase the next pending offer', async () => {
    await rejectedOffer(); const first = mockSubmit.mock.calls[0][0];
    const gate = deferred();
    storage.removeItem.mockImplementationOnce(async (storageKey: string) => {
      await gate.promise; mockStorage.delete(storageKey);
    });
    const oldReset = press('Sastavi novu ponudu');
    await act(async () => { oldReset(); oldReset(); });
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
    expect(form()).toHaveLength(0);
    expect(mockStorage.has(key())).toBe(true);
    await act(async () => { await presentation().props.submit(); });
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve(undefined));
    expect(press('Pregledaj ponudu')).toBeDefined();
    mockSubmit.mockResolvedValueOnce(unknown);
    await sendOffer();
    const second = mockSubmit.mock.calls[1][0];
    expect(second.clientRequestId).not.toBe(first.clientRequestId);
    const bytes = mockStorage.get(key());
    await act(async () => { oldReset(); oldReset(); });
    expect(mockStorage.get(key())).toBe(bytes);
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
    expect(mockSubmit).toHaveBeenCalledTimes(2);
  });

  it('a failed retirement read cannot be mistaken for an absent journal', async () => {
    await rejectedOffer(); const bytes = mockStorage.get(key());
    storage.getItem.mockRejectedValueOnce(new Error('private disk read'));
    await tap('Sastavi novu ponudu');
    expect(form()).toHaveLength(0);
    expect(mockStorage.get(key())).toBe(bytes);
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(text()).not.toContain('private disk read');
    await tap('Sastavi novu ponudu');
    expect(press('Pregledaj ponudu')).toBeDefined();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it('a removal acknowledgement without actual deletion cannot unlock the composer', async () => {
    await rejectedOffer(); const bytes = mockStorage.get(key());
    storage.removeItem.mockResolvedValueOnce(undefined);
    await tap('Sastavi novu ponudu');
    expect(mockStorage.get(key())).toBe(bytes);
    expect(press('Pregledaj ponudu')).toBeUndefined();
    expect(form()).toHaveLength(0);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it('leaving while retirement reads storage prevents the old callback from deleting the command', async () => {
    await rejectedOffer(); const bytes = mockStorage.get(key())!;
    const gate = deferred(); storage.getItem.mockReturnValueOnce(gate.promise);
    await tap('Sastavi novu ponudu');
    mockFocused = false; await update();
    await act(async () => gate.resolve(bytes));
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(mockStorage.get(key())).toBe(bytes);
    mockFocused = true; await update();
    expect(press('Sastavi novu ponudu')).toBeDefined();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it('unknown offer survives profile return and remount with the exact original request and terms', async () => {
    mockSubmit.mockResolvedValueOnce(unknown);
    await offer(); await edit('Poruka uz prijavu', 'Sačuvaj ovu tačnu ponudu.'); await sendOffer();
    const first = mockSubmit.mock.calls[0][0];
    await tap('Dopuni radni profil');
    mockFocused = false; await update();
    mockNeed.mockResolvedValue({ ...need(), revizija: 4 });
    mockProfile.mockResolvedValue({ id: first.radnikProfilId, stanje: 'ACTIVE', alati: ['Telefon'] });
    mockFocused = true; await update();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(press('Sastavi novu ponudu')).toBeUndefined();
    expect(form()).toHaveLength(0);
    await act(async () => tree!.unmount()); tree = undefined; await render();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Sačuvaj ovu tačnu ponudu.');
    await tap('Pošalji ponovo');
    expect(mockSubmit.mock.calls[1][0]).toEqual(first);
  });

  it('a corrected profile does not silently replace a refused offer; only explicit reset uses fresh terms', async () => {
    await rejectedOffer(); const first = mockSubmit.mock.calls[0][0];
    await tap('Dopuni radni profil'); mockFocused = false; await update();
    mockNeed.mockResolvedValue({ ...need(), revizija: 4 });
    mockProfile.mockResolvedValue({ id: first.radnikProfilId, stanje: 'ACTIVE', alati: ['Telefon'] });
    mockFocused = true; await update();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockStorage.get(key())!).command).toEqual(first);
    await tap('Sastavi novu ponudu');
    await sendOffer();
    expect(mockSubmit.mock.calls[1][0]).toMatchObject({ cenaRsd: first.cenaRsd, pokrivenaMesta: first.pokrivenaMesta, potrebaRevizija: 4 });
    expect(mockSubmit.mock.calls[1][0].clientRequestId).not.toBe(first.clientRequestId);
  });

  it('accepted receipt remains accepted when cleanup fails; cold recovery replays only the same command', async () => {
    storage.removeItem.mockRejectedValueOnce(new Error('private cleanup detail'));
    await offer(); await sendOffer(); const first = mockSubmit.mock.calls[0][0];
    expect(text()).toContain('Prijava je poslata.');
    expect(text()).not.toContain('private cleanup detail');
    expect(mockStorage.has(key())).toBe(true);
    await act(async () => tree!.unmount()); tree = undefined; await render();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    await tap('Pošalji ponovo');
    expect(mockSubmit.mock.calls[1][0]).toEqual(first);
    expect(mockStorage.has(key())).toBe(false);
  });

  it('a newer journal from another retained editor is not cleared by an older refused offer', async () => {
    await rejectedOffer(); const first = mockSubmit.mock.calls[0][0];
    await durableJournal.clear('owner-a', mockId!, first.clientRequestId);
    const second = { ...first, clientRequestId: first.clientRequestId + '_newer' };
    await durableJournal.save({ version: 1, accountId: 'owner-a', needId: mockId!, command: second });
    const bytes = mockStorage.get(key()); storage.removeItem.mockClear();
    await tap('Sastavi novu ponudu');
    expect(mockStorage.get(key())).toBe(bytes);
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(press('Pregledaj ponudu')).toBeUndefined();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });
});
