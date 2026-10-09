import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockAccount = '10000000-0000-4000-8000-000000000001', mockRevision = 1;
let mockIntent = 'uskocer', mockFocused = true, mockPlatform = 'android';
// ONE NAME (owner, 8 Oct 2026): the work profile has no field for the name, it takes the ACCOUNT's. The hook is mocked (the real one reads the server).
let mockAccountName: { state: 'loading' } | { state: 'error'; retry: () => void } | { state: 'ready'; name: string | null; profileId?: string | null } = { state: 'ready', name: 'Ana' };
// "Lični podaci" leads here with `uredi=o-meni` and a nonce `n` (a link of the router).
let mockParams: { uredi?: string; n?: string } = {};
const mockListeners = new Set<(state: string) => void>();
const mockBackHandlers = new Set<() => boolean>();
const mockRead = jest.fn(), mockWrite = jest.fn(), mockScrollTo = jest.fn(), mockFocusField = jest.fn();
const mockAvailabilityRead = jest.fn(), mockAvailabilitySave = jest.fn();
const mockSource = { mojRadnikProfil: mockRead, azurirajRadnikProfil: mockWrite };
const mockRouter = { back: jest.fn(), navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'Platform') return { OS: mockPlatform };
  if (key === 'AppState') return { currentState: 'active', addEventListener: (_: string, callback: (state: string) => void) => {
    mockListeners.add(callback); return { remove: () => mockListeners.delete(callback) }; } };
  if (key === 'BackHandler') return { addEventListener: (_: string, callback: () => boolean) => {
    mockBackHandlers.add(callback); return { remove: () => mockBackHandlers.delete(callback) }; } };
  return ['View', 'ScrollView', 'TextInput', 'ActivityIndicator', 'Switch', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => require('react').useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]) }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
// Same presentation-only sheet boundary as profile-draft-back.test.tsx; the real leave hook and confirmation run.
jest.mock('../../ui/product/ProductSheet', () => ({ SHEET_TOUCH: 48, ProductSheet: ({ children, footer, onClose }: any) =>
  require('react').createElement('Sheet', null, children(onClose), footer?.(onClose)) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }),
  sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }) }));
jest.mock('../../ui/profile/useAccountName', () => ({ useAccountName: () => mockAccountName }));
// The face and the rating of the card read their own resources (their own suites); here they are named elements, so the route is tested for what it hands them.
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
jest.mock('../../ui/profile/RatingLine', () => ({ RatingLine: 'RatingLine' }));
// The switch "Mogu odmah" saves as Početna does, through the revision-bound availability client, which the route loads only when the switch is touched.
jest.mock('../workerAvailabilityClientService', () => ({ workerAvailabilityClientService: {
  read: (...args: unknown[]) => mockAvailabilityRead(...args), save: (...args: unknown[]) => mockAvailabilitySave(...args) } }));
import Profile from '../../app/(app)/profil/radnik';
import { WorkerProfileForm } from '../../ui/workerProfile/WorkerProfilePresentation';
import { Avatar } from '../../ui/system/Avatar';
import { inicijali } from '../../lib/inicijali';
const profile = { id: '20000000-0000-4000-8000-000000000001', ime: 'Ana', grad: 'Novi Sad', biografija: '',
  vestine: ['Prevoz, utovar'], alati: ['Bušilica'], vozila: ['Kombi'], licence: ['B, C'], stanje: 'ACTIVE', dostupanOdmah: true, radijusKm: 20, kapacitetTima: 1, capacityRevision: 'a'.repeat(64) };
let tree: ReactTestRenderer;
const control = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(value => typeof value === 'string')).join(' ');
// What stands behind a "ⓘ" (the bar's, or the one at "Oprema"): the lines the InfoButton opens in its sheet.
const infoLines = (testID = 'worker-profile-info') => {
  const node = tree.root.findAllByProps({ testID }).find(item => Array.isArray(item.props.lines ?? item.props.info))!;
  return (node.props.lines ?? node.props.info) as string[];
};
const click = (label: string) => act(() => control(label).props.onPress());
const hardwareBack = () => {
  let handled = false;
  act(() => { handled = [...mockBackHandlers].reverse().some(handler => handler()); });
  return handled;
};
// UI/UX pass 2026-10-08 (F6): the word that opens a part is "Izmeni" at the end of its title, and "Gotovo" while it is open; the spoken name carries the same word.
const openEditor = (label: string) => {
  if (tree.root.findAllByProps({ accessibilityLabel: `Gotovo: ${label}` }).length === 0) click(`Izmeni: ${label}`);
};
const input = (label: string, value: string) => {
  openEditor(label.startsWith('Nova stavka: ') ? label.slice('Nova stavka: '.length) : 'O meni');
  act(() => control(label).props.onChangeText(value));
};
const settle = async () => { await act(async () => {}); };
async function renderReading() { await act(async () => { tree = create(<Profile />, {
  createNodeMock: element => element.type === 'ScrollView' ? { scrollTo: mockScrollTo } : element.type === 'TextInput' ? { focus: mockFocusField } : null,
}); }); }
// Guard tests below still exercise the legacy editor through its component command
// boundary. The saved-card UI no longer admits that path; its real affordances
// are covered separately in "the saved profile is read first". Legacy deep links
// and DRAFT editing remain a separate migration, not silently removed here.
const toEditor = () => {
  if (tree.root.findAllByProps({ testID: 'worker-skills-row' }).length === 0) return;
  act(() => tree.root.findByType(WorkerProfileForm).props.onEditPart('skills'));
  act(() => control('Gotovo: Veštine i usluge').props.onPress());
};
async function render() { await renderReading(); toEditor(); }
beforeEach(() => {
  jest.clearAllMocks(); mockRead.mockReset().mockResolvedValue(profile); mockWrite.mockReset().mockResolvedValue({ ok: true, podatak: null });
  mockAccount = '10000000-0000-4000-8000-000000000001'; mockRevision = 1; mockIntent = 'uskocer'; mockFocused = true; mockPlatform = 'android';
  mockAccountName = { state: 'ready', name: 'Ana' }; mockParams = {};
  mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

// Since 2026-09-24 availability and the work area are summary rows that open their own editors: no switch, no dead fields.
it.each(['android', 'ios'])('renders the actual V2 form and keyboard boundary on %s, retaining true availability and comma-containing terms', async platform => {
  mockPlatform = platform; await render();
  expect(texts()).toContain('Mogu odmah'); expect(texts()).not.toContain('Mogu odmah · dostupnost'); expect(texts()).toContain('Novi Sad · 20 km');
  expect(tree.root.findAll(node => String(node.type) === 'Switch')).toHaveLength(0);
  expect(texts()).toContain('Prevoz, utovar');
  // Availability is a factual row; notification consent remains in its own settings flow. What the data does is behind the "ⓘ" in the bar, not on the screen.
  expect(texts()).not.toContain('njihov broj navodiš u toj ponudi');
  expect(infoLines()).toContain('Ako za neki zadatak obezbeđuješ više ljudi, njihov broj navodiš u toj ponudi.');
  expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
  expect(tree.root.findByType('KeyboardAvoidingView' as any).props.behavior).toBe(platform === 'ios' ? 'padding' : 'height');
  // The tab bar is hidden on this flow since 2026-09-23, so the screen owns its bottom inset.
  expect(tree.root.findByType('SafeAreaView' as any).props.edges).toEqual(['top', 'bottom']);
  expect(mockWrite).not.toHaveBeenCalled();
});

it('opens the personal editor explicitly and keeps its regular field on the bundled Inter face', async () => {
  await render(); openEditor('O meni');
  const name = StyleSheet.flatten(control('O meni').props.style);
  expect(name.fontFamily).toBe('Inter-Regular');
  expect(name.fontWeight).toBeUndefined();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Koliko ljudi možeš da obezbediš' })).toHaveLength(0);
});

it.each(['ACTIVE'])('a clean %s profile has no save footer, while editing and validation retain it', async stanje => {
  mockRead.mockResolvedValue({ ...profile, stanje }); await render();
  expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Sačuvaj izmene' })).toHaveLength(0);
  input('O meni', 'Novo ime');
  expect(control('Sačuvaj izmene')).toBeTruthy();
  input('O meni', profile.biografija);
  expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(0);
  input('Nova stavka: Alat i oprema', 'Merdevine'); click('Sačuvaj izmene');
  expect(texts()).toContain('još nije dodata');
  expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(1);
  expect(mockWrite).not.toHaveBeenCalled();
});

it('an absent pristine profile opens the guarded conversation without creating an empty profile', async () => {
  mockRead.mockResolvedValue(null); await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Sačuvaj profil' })).toHaveLength(0);
  click('Uredi kroz razgovor');
  expect(mockRouter.push).toHaveBeenCalledWith('/profil/razgovor');
  expect(mockWrite).not.toHaveBeenCalled();
});

it('a successfully absent profile saves manual input as a first draft, under the name of the account, before activation', async () => {
  mockAccountName = { state: 'ready', name: 'Milos' };
  mockRead.mockResolvedValueOnce(null).mockResolvedValue({ ...profile, ime: 'Milos', biografija: 'Radim sa bratom', stanje: 'DRAFT' }); await render();
  expect(texts()).toContain('Izaberi gde želiš da radiš'); expect(texts()).not.toContain('Pogledaj i uredi dostupnost');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Koliko ljudi možeš da obezbediš' })).toHaveLength(0);
  input('O meni', 'Radim sa bratom');
  click('Sačuvaj profil'); await settle();
  // The name is not typed in the work profile: the first save creates it under the ACCOUNT's name.
  expect(mockWrite).toHaveBeenCalledWith({ ime: 'Milos', biografija: 'Radim sa bratom', zavrsi: false });
  expect(texts()).toContain('Profil je sačuvan. Nastavi sa podešavanjem.');
  expect(control('Proveri i aktiviraj profil')).toBeTruthy();
});
it('read failure offers retry without constructing a false/15km draft', async () => {
  mockRead.mockRejectedValueOnce(new Error('private diagnostic')); await render();
  expect(texts()).toContain('Profil nije učitan'); expect(texts()).not.toContain('private diagnostic');
  expect(tree.root.findAllByProps({ label: 'Dostupnost' })).toHaveLength(0);
  click('Ponovo učitaj profil'); await settle(); expect(texts()).toContain('Mogu odmah');
});
it('location is read-only here and routes to the area editor', async () => {
  await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Grad ili mesto rada' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Radijus rada (km)' })).toHaveLength(0);
  expect(texts()).toContain('Novi Sad · 20 km');
  click('Područje rada'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/lokacija');
});
it('opens existing notification settings on WORKER without implying that profile save enables push', async () => {
  await render(); click('Obaveštenja o zadacima');
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/profil/obavestenja', params: { skup: 'WORKER' } });
  expect(mockWrite).not.toHaveBeenCalled();
});

const readingScroll = () => tree.root.findByType('ScrollView' as any);
const scrollEvent = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y } } });
const formLayout = () => tree.root.findByProps({ testID: 'worker-profile-reading' }).props.onLayout();
async function focusProfile(focused: boolean) { mockFocused = focused; await act(async () => tree.update(<Profile />)); }

it.each(['Obaveštenja o zadacima', 'Područje rada', 'Dostupnost'])('returns from %s to the reading position after native form layout, ignoring blur clamps', async label => {
  await render();
  const oldScroll = readingScroll().props.onScroll;
  const oldLayout = tree.root.findByProps({ testID: 'worker-profile-reading' }).props.onLayout;
  act(() => oldScroll(scrollEvent(640))); click(label);
  // A layout before actual navigation and a late native clamp cannot consume the snapshot.
  act(() => { oldLayout(); oldScroll(scrollEvent(0)); });
  await focusProfile(false);
  expect(tree.root.findAllByProps({ testID: 'worker-profile-reading' })).toHaveLength(0);
  act(() => { oldLayout(); oldScroll(scrollEvent(0)); readingScroll().props.onScroll(scrollEvent(0)); });
  expect(mockScrollTo).not.toHaveBeenCalled();
  await focusProfile(true);
  act(() => readingScroll().props.onScroll(scrollEvent(0)));
  expect(mockScrollTo).not.toHaveBeenCalled();
  act(() => formLayout());
  expect(mockScrollTo).toHaveBeenCalledWith({ y: 640, animated: false });
  act(() => { formLayout(); oldLayout(); });
  expect(mockScrollTo).toHaveBeenCalledTimes(1);
  expect(mockWrite).not.toHaveBeenCalled();
});

it('a drag on return takes precedence over a delayed reading restoration', async () => {
  await render(); act(() => readingScroll().props.onScroll(scrollEvent(640))); click('Dostupnost');
  await focusProfile(false); await focusProfile(true);
  act(() => readingScroll().props.onScrollBeginDrag(scrollEvent(24)));
  act(() => formLayout()); expect(mockScrollTo).not.toHaveBeenCalled();
  // The next visit starts from the newer position chosen by the person.
  click('Područje rada'); await focusProfile(false); await focusProfile(true);
  act(() => formLayout()); expect(mockScrollTo).toHaveBeenCalledWith({ y: 24, animated: false });
});

it('reading restoration survives a return read error but never crosses an account revision', async () => {
  await render(); act(() => readingScroll().props.onScroll(scrollEvent(640))); click('Dostupnost');
  await focusProfile(false); mockRead.mockRejectedValueOnce(new Error('offline')); await focusProfile(true);
  expect(tree.root.findAllByProps({ testID: 'worker-profile-reading' })).toHaveLength(0);
  act(() => readingScroll().props.onScroll(scrollEvent(0))); expect(mockScrollTo).not.toHaveBeenCalled();
  click('Ponovo učitaj profil'); await settle(); act(() => formLayout());
  expect(mockScrollTo).toHaveBeenCalledWith({ y: 640, animated: false });
  const oldLayout = tree.root.findByProps({ testID: 'worker-profile-reading' }).props.onLayout;
  click('Područje rada'); await focusProfile(false); mockScrollTo.mockClear();
  mockRevision += 2; await focusProfile(true);
  act(() => { oldLayout(); formLayout(); });
  expect(mockScrollTo).not.toHaveBeenCalled(); expect(mockWrite).not.toHaveBeenCalled();
});

it('notification settings cannot drop an edited profile or use a callback from another account revision', async () => {
  await render();
  const retained = control('Obaveštenja o zadacima').props.onPress;
  input('O meni', 'Lokalna izmena'); click('Obaveštenja o zadacima');
  expect(mockRouter.navigate).not.toHaveBeenCalled();
  expect(texts()).toContain('Sačuvaj unos pre otvaranja drugog podešavanja.');
  expect(control('O meni').props.value).toBe('Lokalna izmena');
  mockRevision += 2; act(() => retained());
  expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(mockWrite).not.toHaveBeenCalled();
});
it('notification navigation stays blocked while a profile save has an unknown outcome', async () => {
  mockWrite.mockResolvedValue({ ok: false, kod: 'TIMEOUT', poruka: 'unknown' });
  await render(); const retained = control('Obaveštenja o zadacima').props.onPress;
  input('O meni', 'Unos koji ostaje'); click('Sačuvaj izmene'); await settle();
  act(() => retained()); click('Obaveštenja o zadacima');
  expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(mockWrite).toHaveBeenCalledTimes(1);
  expect(control('O meni').props.value).toBe('Unos koji ostaje');
});
it('sends only edited fields and confirms success only after matching server readback', async () => {
  let finish!: (result: unknown) => void;
  mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('O meni', '  Ana Petrović  ');
  const save = control('Sačuvaj izmene').props.onPress;
  act(() => { save(); save(); }); expect(mockWrite).toHaveBeenCalledTimes(1);
  expect(mockWrite).toHaveBeenCalledWith({ biografija: 'Ana Petrović', zavrsi: false });
  expect(texts()).not.toContain('Izmene profila su sačuvane');
  expect(control('Čuvamo profil…').props.disabled).toBe(true);
  mockRead.mockResolvedValue({ ...profile, biografija: 'Ana Petrović', grad: 'Zemun' });
  await act(async () => finish({ ok: true, podatak: null }));
  expect(texts()).toContain('Izmene profila su sačuvane.');
  expect(texts()).toContain('Zemun · 20 km');
  expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(1);
  expect(mockRouter.back).not.toHaveBeenCalled();
});
it('activation remains unconfirmed while the server still reports DRAFT and never navigates on transport success alone', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT' }); await render();
  click('Proveri i aktiviraj profil'); await settle();
  expect(mockWrite).toHaveBeenCalledWith({ zavrsi: true });
  expect(texts()).not.toContain('Profil je aktivan. Sačuvani podaci');
  expect(control('Pogledaj sačuvani profil')).toBeTruthy(); expect(mockRouter.back).not.toHaveBeenCalled();
  mockRead.mockResolvedValue(profile); click('Pogledaj sačuvani profil'); await settle();
  expect(texts()).toContain('Profil je aktivan i sačuvan.'); expect(mockWrite).toHaveBeenCalledTimes(1);
});
it('a missing required skill prevents activation but permits an explicitly saved draft', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT', vestine: [] }); await render();
  // PKG-005 progressive CTA: activation is not offered until the basics exist; the primary action guides to the missing skill.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Proveri i aktiviraj profil' })).toHaveLength(0);
  click('Dopuni osnovne podatke'); expect(texts()).toContain('bar jednu veštinu'); expect(mockWrite).not.toHaveBeenCalled();
  click('Sačuvaj kao nacrt'); await settle(); expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false });
  expect(texts()).toContain('Izmene profila su sačuvane.');
});
it('an ACTIVE readback with concurrently changed visible activation facts is not confirmed as the reviewed profile', async () => {
  mockRead.mockResolvedValueOnce({ ...profile, stanje: 'DRAFT' }).mockResolvedValue({ ...profile, vestine: ['Druga usluga'] });
  await render(); click('Proveri i aktiviraj profil'); await settle();
  expect(texts()).not.toContain('Profil je aktivan i sačuvan.');
  expect(control('Pogledaj sačuvani profil')).toBeTruthy();
  expect(texts()).toContain('Prevoz, utovar');
});
it('unknown outcome preserves the immutable command and requires readback before explicit retry', async () => {
  mockWrite.mockResolvedValue({ ok: false, kod: 'TIMEOUT', poruka: 'raw upstream' });
  await render(); input('O meni', 'Novo ime'); const oldInput = control('O meni').props.onChangeText;
  const oldSave = control('Sačuvaj izmene').props.onPress;
  click('Sačuvaj izmene'); await settle(); act(() => { oldSave(); oldInput('Kasniji tekst'); });
  expect(mockWrite).toHaveBeenCalledTimes(1); expect(control('O meni').props.value).toBe('Novo ime');
  expect(control('O meni').props.editable).toBe(false); expect(texts()).not.toContain('raw upstream');
  expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(1);
  click('Pogledaj sačuvani profil'); await settle(); act(() => oldSave()); expect(mockWrite).toHaveBeenCalledTimes(1);
  click('Sačuvaj ponovo'); await settle(); expect(mockWrite).toHaveBeenCalledTimes(2);
  expect(mockWrite.mock.calls[1][0]).toEqual(mockWrite.mock.calls[0][0]);
});
it('fresh mismatching readback permits explicit editing without silently dropping the attempted draft', async () => {
  mockWrite.mockResolvedValue({ ok: false, kod: 'REFUSED', poruka: 'no' }); await render();
  input('O meni', 'Moj nacrt'); click('Sačuvaj izmene'); await settle();
  click('Pogledaj sačuvani profil'); await settle(); click('Izmeni podatke');
  expect(control('O meni').props.value).toBe('Moj nacrt'); expect(control('O meni').props.editable).toBe(true);
});
it('optional resources preserve exact items and refuse to silently lose an unadded item', async () => {
  await render(); input('Nova stavka: Alat i oprema', 'Merdevine');
  click('Sačuvaj izmene'); expect(mockWrite).not.toHaveBeenCalled(); expect(texts()).toContain('još nije dodata');
  click('Dodaj: Alat i oprema'); input('Nova stavka: Vozila', 'Automobil'); click('Dodaj: Vozila');
  click('Sačuvaj izmene'); await settle();
  expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, alati: ['Bušilica', 'Merdevine'], vozila: ['Kombi', 'Automobil'] });
  expect(mockWrite.mock.calls[0][0]).not.toHaveProperty('licence'); expect(mockWrite.mock.calls[0][0]).not.toHaveProperty('vestine');
});
it('a save blocked by an unadded tool reopens that editor after switching to identity', async () => {
  await render(); input('Nova stavka: Alat i oprema', 'Merdevine');
  openEditor('O meni');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Nova stavka: Alat i oprema' })).toHaveLength(0);
  click('Sačuvaj izmene'); await settle();
  expect(mockWrite).not.toHaveBeenCalled();
  expect(texts()).toContain('još nije dodata');
  expect(control('Gotovo: Alat i oprema')).toBeTruthy();
  expect(control('Nova stavka: Alat i oprema').props.value).toBe('Merdevine');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'O meni' })).toHaveLength(0);
});
it('availability is a read-only summary that links to its revision-bound writer', async () => {
  await render(); expect(tree.root.findAll(node => String(node.type) === 'Switch')).toHaveLength(0);
  expect(texts()).toContain('Mogu odmah'); expect(texts()).not.toContain('Mogu odmah · dostupnost');
  click('Dostupnost'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/dostupnost');
  expect(mockWrite).not.toHaveBeenCalled();
});
it('keeps retired license and permanent team facts out of the personal profile and an unrelated save', async () => {
  await render();
  expect(texts()).not.toMatch(/Licence koje navodiš|B, C|Kapacitet tima/);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Nova stavka: Licence koje navodiš' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Koliko ljudi možeš da obezbediš' })).toHaveLength(0);
  input('O meni', 'Ana Petrović');
  mockRead.mockResolvedValue({ ...profile, biografija: 'Ana Petrović' });
  click('Sačuvaj izmene'); await settle();
  expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, biografija: 'Ana Petrović' });
  expect(texts()).toContain('Izmene profila su sačuvane.');
});
it('activation confirms visible personal facts independently of legacy license and team readback', async () => {
  mockRead.mockResolvedValueOnce({ ...profile, stanje: 'DRAFT', capacityRevision: undefined })
    .mockResolvedValue({ ...profile, licence: [], kapacitetTima: 5, capacityRevision: 'b'.repeat(64) });
  await render(); click('Proveri i aktiviraj profil'); await settle();
  expect(mockWrite).toHaveBeenCalledWith({ zavrsi: true });
  expect(texts()).toContain('Profil je aktivan i sačuvan.');
  expect(texts()).not.toContain('B, C');
});
it.each(['account'])('retires retained callbacks and late reads across %s changes', async change => {
  await render(); input('O meni', 'Unos starog naloga'); const oldSave = control('Sačuvaj izmene').props.onPress;
  let late!: (value: unknown) => void; mockRead.mockImplementationOnce(() => new Promise(resolve => { late = resolve; }));
  if (change === 'account') mockRevision += 2;
  await act(async () => tree.update(<Profile />)); act(() => oldSave()); expect(mockWrite).not.toHaveBeenCalled();
  await act(async () => late({ ...profile, biografija: 'Aktuelni nalog' }));
  // The new account's profile is read first, like any finished profile.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'O meni' })).toHaveLength(0);
  toEditor(); openEditor('O meni');
  expect(control('O meni').props.value).toBe('Aktuelni nalog'); expect(texts()).not.toContain('Unos starog naloga');
});
// Owner decision 1 (2026-09-19): the app has no global mode. This used to be a row of the table above.
it('a flip of the retired app mode keeps the typed draft and lets the retained save run', async () => {
  await render(); input('O meni', 'Unos koji ostaje'); const oldSave = control('Sačuvaj izmene').props.onPress;
  mockIntent = 'narucilac'; await act(async () => tree.update(<Profile />));
  expect(control('O meni').props.value).toBe('Unos koji ostaje');
  await act(async () => oldSave()); expect(mockWrite).toHaveBeenCalledTimes(1);
});
it('blur retains draft and new-item input, while old callbacks cannot run after refocus', async () => {
  await render(); input('O meni', 'Sačuvani lokalni unos'); input('Nova stavka: Veštine i usluge', 'Krečenje');
  input('Nova stavka: Alat i oprema', 'Merdevine');
  const save = control('Sačuvaj izmene').props.onPress;
  mockFocused = false; await act(async () => tree.update(<Profile />)); expect(texts()).not.toContain('Sačuvani lokalni unos');
  mockFocused = true; await act(async () => tree.update(<Profile />)); act(() => save()); expect(mockWrite).not.toHaveBeenCalled();
  openEditor('O meni');
  expect(control('O meni').props.value).toBe('Sačuvani lokalni unos');
  openEditor('Veštine i usluge');
  expect(control('Nova stavka: Veštine i usluge').props.value).toBe('Krečenje');
  openEditor('Alat i oprema');
  expect(control('Nova stavka: Alat i oprema').props.value).toBe('Merdevine');
});
it('background hides the form and foreground waits for a pending write then rereads its actual result', async () => {
  let finish!: (value: unknown) => void; mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('O meni', 'Potvrđeno ime'); click('Sačuvaj izmene');
  act(() => mockListeners.forEach(listener => listener('background'))); expect(texts()).not.toContain('Potvrđeno ime');
  act(() => mockListeners.forEach(listener => listener('active'))); await settle(); expect(mockRead).toHaveBeenCalledTimes(1);
  mockRead.mockResolvedValue({ ...profile, biografija: 'Potvrđeno ime' });
  await act(async () => finish({ ok: true, podatak: null }));
  expect(mockRead).toHaveBeenCalledTimes(2); expect(texts()).toContain('Izmene profila su sačuvane.');
});
it('a pending write across blur/refocus cannot open another write or lose its later result', async () => {
  let finish!: (value: unknown) => void; mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('O meni', 'Posle povratka'); click('Sačuvaj izmene');
  mockFocused = false; await act(async () => tree.update(<Profile />));
  mockFocused = true; await act(async () => tree.update(<Profile />));
  expect(control('Čuvamo profil…').props.disabled).toBe(true);
  mockRead.mockResolvedValue({ ...profile, biografija: 'Posle povratka' });
  await act(async () => finish({ ok: true, podatak: null }));
  expect(texts()).toContain('Izmene profila su sačuvane.'); expect(mockWrite).toHaveBeenCalledTimes(1);
});
it('late write after account ABA cannot reread or announce old account success', async () => {
  let finish!: (value: unknown) => void; mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('O meni', 'Stari unos'); click('Sačuvaj izmene');
  mockRevision += 2; await act(async () => tree.update(<Profile />)); const reads = mockRead.mock.calls.length;
  await act(async () => finish({ ok: true, podatak: null }));
  expect(mockRead).toHaveBeenCalledTimes(reads); expect(texts()).not.toContain('Izmene profila su sačuvane');
});
it('read timeout is bounded and late response cannot overwrite a successful replacement', async () => {
  jest.useFakeTimers(); let late!: (value: unknown) => void;
  mockRead.mockImplementationOnce(() => new Promise(resolve => { late = resolve; })); await render();
  await act(async () => jest.advanceTimersByTime(15_000)); click('Ponovo učitaj profil'); await settle();
  await act(async () => late({ ...profile, biografija: 'Istekli odgovor' }));
  toEditor(); openEditor('O meni'); expect(control('O meni').props.value).toBe('');
});
it('a hanging transport becomes unknown without automatic replay or a late success announcement', async () => {
  jest.useFakeTimers(); let late!: (value: unknown) => void;
  mockWrite.mockImplementationOnce(() => new Promise(resolve => { late = resolve; })); await render();
  input('O meni', 'Zadržan unos'); click('Sačuvaj izmene');
  await act(async () => jest.advanceTimersByTime(65_000)); expect(control('Pogledaj sačuvani profil')).toBeTruthy();
  await act(async () => late({ ok: true, podatak: null })); expect(mockRead).toHaveBeenCalledTimes(1);
  expect(mockWrite).toHaveBeenCalledTimes(1); expect(texts()).not.toContain('Izmene profila su sačuvane');
});
it('owned related settings navigation avoids losing a dirty active-profile draft', async () => {
  await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Proveri i aktiviraj profil' })).toHaveLength(0);
  click('Dostupnost'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/dostupnost');
  input('O meni', 'Lokalna izmena'); click('Područje rada');
  expect(mockRouter.navigate).toHaveBeenCalledTimes(1); expect(texts()).toContain('Sačuvaj unos pre otvaranja');
});

it.each(['toolbar', 'hardware'])('%s Back asks before discarding a local draft and cancel preserves it', async entry => {
  await render(); input('O meni', 'Lokalno ime');
  const goBack = () => entry === 'toolbar' ? click('Nazad') : expect(hardwareBack()).toBe(true);
  goBack();
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(control('Odbaci izmene')).toBeTruthy();
  click('Nastavi uređivanje');
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(control('O meni').props.value).toBe('Lokalno ime');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Odbaci izmene' })).toHaveLength(0);
  goBack(); click('Odbaci izmene');
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockWrite).not.toHaveBeenCalled();
});

it('confirmed discard resets a cached route draft before reentry and retires its retained save callback', async () => {
  await render(); input('O meni', 'QA lokalno');
  const previousSave = control('Sačuvaj izmene').props.onPress;
  click('Nazad'); click('Odbaci izmene');
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  // The router mock keeps the actual route mounted, just as a cached native route can remain mounted. Leaving reads the
  // profile again next time (T4b1), and the editor it opens holds the saved values.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'O meni' })).toHaveLength(0);
  toEditor(); openEditor('O meni');
  expect(control('O meni').props.value).toBe(profile.biografija);
  expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(0);
  act(() => previousSave()); expect(mockWrite).not.toHaveBeenCalled();
  mockFocused = false; await act(async () => tree.update(<Profile />));
  mockFocused = true; await act(async () => tree.update(<Profile />));
  openEditor('O meni');
  expect(control('O meni').props.value).toBe(profile.biografija);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Sačuvaj izmene' })).toHaveLength(0);
  expect(texts()).not.toContain('QA lokalno');
  expect(mockWrite).not.toHaveBeenCalled();
});

it.each(['toolbar', 'hardware'])('%s Back retains an in-flight or unconfirmed command until successful readback', async entry => {
  let finish!: (result: unknown) => void;
  mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('O meni', 'Potvrđeno ime'); click('Sačuvaj izmene');
  const goBack = () => entry === 'toolbar' ? click('Nazad') : expect(hardwareBack()).toBe(true);
  goBack();
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(texts()).toContain('Prvo proveri ishod čuvanja. Tvoj unos je zadržan.');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Odbaci izmene' })).toHaveLength(0);
  await act(async () => finish({ ok: false, kod: 'TIMEOUT', poruka: 'unknown' }));
  goBack();
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Odbaci izmene' })).toHaveLength(0);
  expect(control('O meni').props.value).toBe('Potvrđeno ime');
  mockRead.mockResolvedValue({ ...profile, biografija: 'Potvrđeno ime' });
  click('Pogledaj sačuvani profil'); await settle();
  expect(texts()).toContain('Izmene profila su sačuvane.');
  if (entry === 'hardware') expect(hardwareBack()).toBe(false);
  click('Nazad');
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockWrite).toHaveBeenCalledTimes(1);
});

// A draft profile is not merely incomplete: private.dispatch_cheap_candidate_admitted requires
// profile_status = 'ACTIVE', so while it is a draft nothing is offered at all. Saying only
// "dopunite pre prijave" left the owner's own business account invisible to every task while
// looking like a small omission. The consequence is stated, not implied.
it('says a draft profile is offered nothing, not merely that it is incomplete', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT' });
  await render();
  expect(texts()).toContain('Radni profil je još nacrt');
  expect(texts()).toContain('zadaci ti se ne nude');
});

it('says the same about a suspended profile, and nothing at all about an active one', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'SUSPENDED' });
  await renderReading();
  expect(texts()).toContain('Dok traje suspenzija, zadaci ti se ne nude.');
  await act(async () => tree.unmount());
  mockRead.mockResolvedValue(profile);
  await render();
  expect(texts()).toContain('Profil je aktivan');
  expect(texts()).not.toContain('zadaci ti se ne nude');
});

describe('manual corrections after a summary edit tap', () => {
  it('shows saved facts without a catalogue and permits explicit removal in the vehicle editor', async () => {
    await render(); expect(texts()).toContain('Kombi');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Brzi izbor vozila' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Ukloni vozila: Kombi' })).toHaveLength(0);
    openEditor('Vozila'); click('Ukloni vozila: Kombi'); click('Sačuvaj izmene'); await settle();
    expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, vozila: [] });
  });
  it('adds free text after saved terms without a catalogue choice', async () => {
    await render(); input('Nova stavka: Vozila', 'Automobil'); click('Dodaj: Vozila'); click('Sačuvaj izmene'); await settle();
    expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, vozila: ['Kombi', 'Automobil'] });
  });
  it('opens one editor at a time and retains unsaved input when switching sections', async () => {
    await render(); input('Nova stavka: Alat i oprema', 'Merdevine');
    openEditor('Vozila');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Nova stavka: Alat i oprema' })).toHaveLength(0);
    expect(control('Izmeni: Alat i oprema')).toBeTruthy(); expect(tree.root.findAllByProps({ accessibilityLabel: 'Gotovo: Alat i oprema' })).toHaveLength(0);
    openEditor('Alat i oprema');
    expect(control('Nova stavka: Alat i oprema').props.value).toBe('Merdevine');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Nova stavka: Vozila' })).toHaveLength(0);
    expect(mockWrite).not.toHaveBeenCalled();
  });
  it('a full list keeps its field and add action disabled and says why', async () => {
    const full = Array.from({ length: 50 }, (_, i) => 'Vozilo ' + (i + 1));
    mockRead.mockResolvedValue({ ...profile, vozila: full }); await render(); openEditor('Vozila');
    expect(control('Dodaj: Vozila').props.disabled).toBe(true);
    click('Dodaj: Vozila');
    expect(control('Nova stavka: Vozila').props.editable).toBe(false); expect(texts()).toContain('Najviše 50 stavki.');
    expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Sačuvaj izmene' })).toHaveLength(0);
    expect(mockWrite).not.toHaveBeenCalled();
  });
});

// Review of step 9 (2026-09-24): the support row is not a setting, so a dirty draft gets its own sentence.
it('asks to save a dirty draft before writing to support, in words about support', async () => {
  await render();
  input('O meni', 'Lokalna izmena');
  act(() => tree.root.findByType(WorkerProfileForm).props.navigate('/podrska'));
  expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(texts()).toContain('Sačuvaj unos pre nego što pišeš podršci.');
  expect(texts()).not.toContain('Sačuvaj unos pre otvaranja drugog podešavanja.');
});

describe('activation checklist', () => {
  it('names what a draft is missing, item by item', async () => {
    mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT', vestine: [] }); await render();
    expect(control('Veštine i ime naloga: nedostaje')).toBeTruthy();
    expect(control('Područje rada: spremno')).toBeTruthy();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Kapacitet tima: spremno' })).toHaveLength(0);
    expect(texts()).not.toContain('Sve je spremno za aktivaciju.');
  });
  it('says a complete draft is ready', async () => {
    mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT' }); await render();
    expect(texts()).toContain('Sve je spremno za aktivaciju.'); expect(control('Proveri i aktiviraj profil')).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(1);
  });
  it('activation needs no legacy capacity revision, but unsaved visible edits still require saving first', async () => {
    mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT', capacityRevision: undefined }); await render();
    expect(control('Proveri i aktiviraj profil')).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(1);
    expect(texts()).toContain('Sve je spremno za aktivaciju.');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Učitaj kapacitet profila' })).toHaveLength(0);
    input('O meni', 'Ana Petrović');
    expect(control('Sačuvaj izmene')).toBeTruthy(); expect(texts()).not.toContain('Sve je spremno za aktivaciju.');
  });
});

// T4b1 (2026-10-07), M3, arranged as the product draft the owner approved on 8 Oct 2026 (P3): a finished profile is READ first, as the card others see, the rows
// "Šta radiš" and "Gde", "Kada", "Oprema" and the white "Uredi kroz razgovor". A row that changes something opens the editor of THAT part; nothing is written by a tap.
describe('the saved profile is read first', () => {
  it('reads the card, the rows and the white button: no field, no pencil, no footer, and nothing written', async () => {
    await renderReading();
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
    expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
    expect(texts()).toContain('Tvoj radni profil'); expect(texts()).toContain('Ana');
    expect(texts()).toContain('Šta radiš'); expect(texts()).toContain('Prevoz, utovar');
    expect(texts()).toContain('Gde'); expect(texts()).toContain('Novi Sad · 20 km');
    expect(texts()).toContain('Kada'); expect(texts()).toContain('Mogu odmah'); expect(texts()).not.toContain('Mogu odmah · dostupnost'); expect(texts()).toContain('Nedeljni raspored');
    expect(texts()).toContain('Oprema'); expect(texts()).toContain('Alat'); expect(texts()).toContain('Bušilica'); expect(texts()).toContain('Vozila'); expect(texts()).toContain('Kombi');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Izmeni: O meni' })).toHaveLength(0);
    // The two buttons of the older reading ("Izmeni razgovorom" and "Izmeni ručno") are gone, and so is the notifications row: the rows lead to the part they change.
    for (const gone of ['Izmeni razgovorom', 'Izmeni ručno', 'Obaveštenja o zadacima', 'Područje rada', 'Dostupnost']) expect([gone, tree.root.findAllByProps({ accessibilityLabel: gone }).length]).toEqual([gone, 0]);
    // "Na šta utiče" was a block of rows; it is the sentences behind the "ⓘ" in the bar now.
    expect(texts()).not.toContain('Na šta utiče'); expect(texts()).not.toContain('Javni profil');
    expect(control('Objašnjenje: Na šta utiče radni profil')).toBeTruthy();
    expect(control('Uredi kroz razgovor')).toBeTruthy();
    // A clean finished profile has no save footer: there is nothing here to save.
    expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(0);
    expect(mockWrite).not.toHaveBeenCalled();
  });
  it('puts the face and the rating line in the card: the account\'s photo when the account has a profile, its letters otherwise', async () => {
    mockAccountName = { state: 'ready', name: 'Ana', profileId: 'p-ana' }; await renderReading();
    const photo = tree.root.findByType('ProfilePhoto' as never);
    expect(photo.props).toMatchObject({ profileId: 'p-ana', size: 56, own: true }); expect(photo.props.fallback.type).toBe(Avatar);
    expect(tree.root.findByType('RatingLine' as never).props.accountId).toBe(mockAccount);
    await act(async () => tree.unmount());
    mockAccountName = { state: 'ready', name: 'Ana' }; await renderReading();
    expect(tree.root.findAllByType('ProfilePhoto' as never)).toHaveLength(0);
    // The stand-in at the card's size, with the letters of the account's name (`Avatar` is a memo, found by what it is handed).
    const stand = tree.root.findAll(node => node.props.size === 56 && 'initials' in node.props);
    expect(stand.length).toBeGreaterThan(0); expect(stand[0].props.initials).toBe(inicijali('Ana'));
  });
  it('says what the profile does today behind the "ⓘ": notifications, the public profile and the "Za mene" list the server now has', async () => {
    await renderReading();
    expect(infoLines()).toEqual([
      'Obaveštenja: novi i već otvoreni zadaci koji ti odgovaraju.',
      'Javni profil: ime, „O meni“ i grad vide osobe koje otvore tvoj profil.',
      'Zadaci · Za mene: lista po tvom području i vremenu.']);
  });
  it('says what tools and vehicles do now that MATCH-V1 is applied behind the "ⓘ" of Oprema: information only, no condition of a task', async () => {
    await renderReading();
    expect(infoLines('worker-kit-info')).toEqual(['Samo informacija: ne utiču na pretragu ni na obaveštenja.']);
    expect(texts()).toContain('Oprema'); expect(texts()).not.toContain('samo informacija'); expect(texts()).not.toMatch(/ne nudi i ne možeš da se prijaviš/);
  });
  it('the explanations of the hand-edited profile are behind the bar\'s "ⓘ": the equipment note and the people count only there', async () => {
    await renderReading();
    expect(infoLines()).not.toContain('Ako za neki zadatak obezbeđuješ više ljudi, njihov broj navodiš u toj ponudi.');
    toEditor();
    expect(infoLines()).toContain('Ako za neki zadatak obezbeđuješ više ljudi, njihov broj navodiš u toj ponudi.');
    expect(infoLines()).toContain('Samo informacija: ne utiču na pretragu ni na obaveštenja.');
    expect(texts()).not.toContain('Samo informacija');
  });
  it('"Uredi kroz razgovor" opens the guarded conversation, and writes nothing', async () => {
    await renderReading(); click('Uredi kroz razgovor');
    expect(mockRouter.push).toHaveBeenCalledWith('/profil/razgovor'); expect(mockWrite).not.toHaveBeenCalled();
  });
  it('"Gde" leads to the area and "Nedeljni raspored" to the week, and neither writes anything', async () => {
    await renderReading();
    click('Gde'); expect(mockRouter.navigate).toHaveBeenLastCalledWith('/profil/lokacija');
    click('Nedeljni raspored'); expect(mockRouter.navigate).toHaveBeenLastCalledWith('/profil/dostupnost');
    expect(mockWrite).not.toHaveBeenCalled();
  });
  it('saved skills and equipment stay readable without opening a manual editor', async () => {
    await renderReading();
    for (const label of ['Šta radiš', 'Alat', 'Vozila']) {
      expect(tree.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')).toHaveLength(0);
    }
    expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
    expect(mockWrite).not.toHaveBeenCalled();
  });
  it('a row does not open the editor while a save is running or the screen is not ready', async () => {
    let finish!: (result: unknown) => void;
    mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    mockAccountName = { state: 'ready', name: 'Milos' }; mockRead.mockResolvedValue({ ...profile, ime: 'Pera peric' }); await renderReading();
    click('Koristi „Milos“'); await settle();
    // While the name is being written the rows are locked.
    expect(control('Uredi kroz razgovor').props.disabled).toBe(true); expect(control('Gde').props.disabled).toBe(true);
    act(() => tree.root.findByType(WorkerProfileForm).props.onEditPart('skills'));
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
    mockRead.mockResolvedValue({ ...profile, ime: 'Milos' });
    await act(async () => finish({ ok: true, podatak: null }));
  });
  it('"Nazad" leaves the editor it opened, and the profile is read again next time', async () => {
    await renderReading(); toEditor();
    expect(control('Izmeni: O meni')).toBeTruthy();
    click('Nazad'); expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
  });
  it('a suspended profile is read too, with the support way out and no switch, and a draft is not read but guided', async () => {
    mockRead.mockResolvedValue({ ...profile, stanje: 'SUSPENDED' }); await renderReading();
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
    expect(texts()).toContain('Profil je trenutno suspendovan'); expect(control('Obrati se podršci')).toBeTruthy();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Uredi kroz razgovor' })).toHaveLength(0);
    const form = tree.root.findByType(WorkerProfileForm);
    act(() => { form.props.openConversation(); form.props.navigate('/profil/lokacija'); form.props.navigate('/profil/dostupnost'); form.props.onEditPart('skills'); });
    expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
    // It says its state and cannot be touched: a suspended profile is not switched by its owner.
    expect(tree.root.findAllByProps({ testID: 'worker-available-now' })).toHaveLength(0); expect(texts()).toContain('Uključeno');
    await act(async () => tree.unmount());
    mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT' }); await renderReading();
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(0);
    expect(control('Proveri i aktiviraj profil')).toBeTruthy();
  });
});

// The switch "Mogu odmah" (approved draft, P3): the same one Početna has, saved by the same client against the revision the week was read at. The route saves
// nothing of the work profile itself; what the switch shows after it saved is its own answer until the next read lands.
describe('"Mogu odmah"', () => {
  const REVISION = 'r'.repeat(64);
  const week = (availableNow: boolean) => ({ accountId: mockAccount, profileId: profile.id, revision: REVISION, timezone: 'Europe/Belgrade', availableNow,
    rules: [{ id: 'rule-1' }], windows: [] as unknown[] });
  const toggle = () => tree.root.findByProps({ testID: 'worker-available-now' });
  const flip = async (value: boolean) => { await act(async () => { toggle().props.onValueChange(value); }); };
  beforeEach(() => {
    mockAvailabilityRead.mockReset().mockResolvedValue({ ok: true, podatak: week(true) });
    mockAvailabilitySave.mockReset().mockImplementation(async (command: { value: { availableNow: boolean } }) => ({ ok: true,
      podatak: { saved: true, idempotentReplay: false, availability: week(command.value.availableNow) } }));
  });
  it('is a switch in its own row, with the state the profile has, for an active profile', async () => {
    await renderReading();
    expect(toggle().props).toMatchObject({ value: true, disabled: false, accessibilityLabel: 'Mogu odmah' });
    expect(mockAvailabilityRead).not.toHaveBeenCalled();   // loaded only when it is touched
    await act(async () => tree.unmount());
    mockRead.mockResolvedValue({ ...profile, dostupanOdmah: false }); await renderReading();
    expect(toggle().props.value).toBe(false);
  });
  it('saves as Početna does: the saved week with only the status changed, against the revision it was read at, and writes nothing of the profile', async () => {
    await renderReading(); await flip(false);
    expect(mockAvailabilityRead).toHaveBeenCalledTimes(1); expect(mockAvailabilitySave).toHaveBeenCalledTimes(1);
    expect(mockAvailabilitySave).toHaveBeenCalledWith({ expectedRevision: REVISION, value: { timezone: 'Europe/Belgrade', availableNow: false, rules: [{ id: 'rule-1' }], windows: [] } });
    expect(toggle().props.value).toBe(false); expect(texts()).not.toContain('Čuvamo…'); expect(texts()).not.toContain('Nije sačuvano. Pokušaj ponovo.');
    expect(mockWrite).not.toHaveBeenCalled();
  });
  it('says it is saving, holds a second touch until the save settles, and takes the answer of the save', async () => {
    let finish!: (result: unknown) => void;
    mockAvailabilitySave.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await renderReading(); await flip(false);
    expect(texts()).toContain('Čuvamo…'); expect(toggle().props.disabled).toBe(true); expect(toggle().props.value).toBe(false);
    await flip(true); expect(mockAvailabilityRead).toHaveBeenCalledTimes(1); expect(mockAvailabilitySave).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ok: true, podatak: { saved: true, idempotentReplay: false, availability: week(false) } }));
    expect(texts()).not.toContain('Čuvamo…'); expect(toggle().props.disabled).toBe(false); expect(toggle().props.value).toBe(false);
  });
  it.each([
    ['the save is refused', () => mockAvailabilitySave.mockResolvedValue({ ok: false, kod: 'AVAILABILITY_VERSION_CONFLICT', poruka: 'x' })],
    ['the save throws', () => mockAvailabilitySave.mockRejectedValue(new Error('offline'))],
    ['the week cannot be read', () => mockAvailabilityRead.mockResolvedValue({ ok: false, kod: 'WORKER_AVAILABILITY_READ_FAILED', poruka: 'x' })],
    ['the read throws', () => mockAvailabilityRead.mockRejectedValue(new Error('offline'))],
  ])('says it did not take when %s, and shows the profile\'s own state again', async (_name, arrange) => {
    arrange(); await renderReading(); await flip(false);
    expect(texts()).toContain('Nije sačuvano. Pokušaj ponovo.'); expect(toggle().props.value).toBe(true); expect(toggle().props.disabled).toBe(false);
    expect(mockWrite).not.toHaveBeenCalled();
    // A second try is its own request.
    mockAvailabilityRead.mockReset().mockResolvedValue({ ok: true, podatak: week(true) });
    mockAvailabilitySave.mockReset().mockResolvedValue({ ok: true, podatak: { saved: true, idempotentReplay: false, availability: week(false) } });
    await flip(false); expect(toggle().props.value).toBe(false); expect(texts()).not.toContain('Nije sačuvano. Pokušaj ponovo.');
  });
  it('is not touched while the screen is busy: a name being written locks it, and the profile stays read meanwhile', async () => {
    let finish!: (result: unknown) => void;
    mockAccountName = { state: 'ready', name: 'Milos' }; mockRead.mockResolvedValue({ ...profile, ime: 'Pera peric' });
    mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await renderReading(); click('Koristi „Milos“'); await settle();
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
    expect(toggle().props.disabled).toBe(true);
    await flip(false); expect(mockAvailabilityRead).not.toHaveBeenCalled();
    mockRead.mockResolvedValue({ ...profile, ime: 'Milos' });
    await act(async () => finish({ ok: true, podatak: null }));
    expect(toggle().props.disabled).toBe(false);
  });
  it('does not announce an answer for another account: a save that lands after the account changed says nothing', async () => {
    let finish!: (result: unknown) => void;
    mockAvailabilitySave.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await renderReading(); await flip(false);
    mockRevision += 2; await act(async () => tree.update(<Profile />));
    await act(async () => finish({ ok: true, podatak: { saved: true, idempotentReplay: false, availability: week(false) } }));
    expect(texts()).not.toContain('Nije sačuvano. Pokušaj ponovo.'); expect(toggle().props.value).toBe(true);
  });
});

// "Lični podaci" writes the account's name, and "O meni" is the work profile's text: the row leads here, to the editor of that part (`uredi=o-meni`), once for each tap
// (the nonce `n`), and it opens without putting the keyboard up.
describe('"O meni" written from "Lični podaci"', () => {
  it('opens the editor on "O meni" for a tap, once, and again only for a new tap', async () => {
    mockParams = { uredi: 'o-meni', n: '1' }; await renderReading();
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(0);
    expect(control('Gotovo: O meni')).toBeTruthy(); expect(control('O meni').props.value).toBe('');
    expect(mockFocusField).not.toHaveBeenCalled();
    // Closed by the person, the same tap does not open it again, whatever renders; a new tap (a new nonce) does.
    click('Gotovo: O meni'); await act(async () => tree.update(<Profile />));
    expect(control('Izmeni: O meni')).toBeTruthy();
    mockParams = { uredi: 'o-meni', n: '2' }; await act(async () => tree.update(<Profile />));
    expect(control('Gotovo: O meni')).toBeTruthy();
    expect(mockWrite).not.toHaveBeenCalled();
  });
  it('opens nothing for a link without a nonce, for another part, or when there is no link at all', async () => {
    mockParams = { uredi: 'o-meni' }; await renderReading();
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
    await act(async () => tree.unmount());
    mockParams = { uredi: 'alat', n: '3' }; await renderReading();
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
    await act(async () => tree.unmount());
    mockParams = {}; await renderReading();
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
  });
  it('waits for the profile to be read: no editor opens over a read that failed or a profile that does not exist', async () => {
    mockParams = { uredi: 'o-meni', n: '1' }; mockRead.mockRejectedValueOnce(new Error('offline')); await renderReading();
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Gotovo: O meni' })).toHaveLength(0);
    expect(texts()).toContain('Profil nije učitan');
  });
});

// ONE NAME (owner, 8 Oct 2026, "Može, dobro vam jedno ime za sve."): the work profile has no field for the name. It is read under the ACCOUNT's name,
// the difference is said quietly with one button that is the person's own action, and a first save or an activation always carries the account's name.
describe('one name for the account and the work profile', () => {
  const different = { ...profile, ime: 'Pera peric' };
  it('has no field for the name, in the editor either', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' }; mockRead.mockResolvedValue(different); await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Ime na radnom profilu' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Ime na profilu' })).toHaveLength(0);
    openEditor('O meni');
    expect(tree.root.findAll(node => String(node.type) === 'TextInput').map(node => node.props.accessibilityLabel)).toEqual(['O meni']);
  });
  it('reads under the account\'s name, says the difference quietly and offers one button that writes only the name', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' }; mockRead.mockResolvedValue(different); await renderReading();
    expect(texts()).toContain('Milos'); expect(texts()).toContain('Na radnom profilu piše „Pera peric“.');
    expect(mockWrite).not.toHaveBeenCalled();
    mockRead.mockResolvedValue({ ...profile, ime: 'Milos' });
    click('Koristi „Milos“'); await settle();
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, ime: 'Milos' });
    expect(texts()).toContain('Ime radnog profila je promenjeno.');
    expect(texts()).not.toContain('Na radnom profilu piše'); expect(tree.root.findAllByProps({ testID: 'worker-name-difference' })).toHaveLength(0);
  });
  it('says nothing about the name while the two agree, and without the account\'s name there is nothing to compare', async () => {
    mockAccountName = { state: 'ready', name: 'Ana' }; await renderReading();
    expect(tree.root.findAllByProps({ testID: 'worker-name-difference' })).toHaveLength(0);
    await act(async () => tree.unmount());
    mockAccountName = { state: 'ready', name: null }; await renderReading();
    expect(tree.root.findAllByProps({ testID: 'worker-name-difference' })).toHaveLength(0); expect(texts()).toContain('Ana');
  });
  it('a write that is not confirmed is said and kept: the difference stays and nothing is silent', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' }; mockRead.mockResolvedValue(different);
    mockWrite.mockResolvedValue({ ok: false, kod: 'TIMEOUT', poruka: 'unknown' });
    await renderReading(); click('Koristi „Milos“'); await settle();
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(control('Pogledaj sačuvani profil')).toBeTruthy(); expect(texts()).toContain('Čuvanje nije potvrđeno.');
    expect(texts()).not.toContain('Ime radnog profila je promenjeno.');
  });
  it('the button waits for the readback: the name is confirmed only when the server reports it', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' }; mockRead.mockResolvedValue(different);   // the read after the write still says "Pera peric"
    await renderReading(); click('Koristi „Milos“'); await settle();
    expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, ime: 'Milos' });
    expect(texts()).not.toContain('Ime radnog profila je promenjeno.'); expect(control('Pogledaj sačuvani profil')).toBeTruthy();
  });
  it('with unsaved edits the button asks to save them first and writes nothing', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' }; mockRead.mockResolvedValue(different); await render();
    input('O meni', 'Nešto novo'); click('Koristi „Milos“');
    expect(mockWrite).not.toHaveBeenCalled(); expect(texts()).toContain('Sačuvaj unos pre promene imena.');
  });
  it('activation always goes under the account\'s name, even over another name the profile carried', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' };
    mockRead.mockResolvedValue({ ...different, stanje: 'DRAFT' }); await render();
    mockRead.mockResolvedValue({ ...profile, ime: 'Milos' });   // the server reports ACTIVE under the account's name
    click('Proveri i aktiviraj profil'); await settle();
    expect(mockWrite).toHaveBeenCalledWith({ ime: 'Milos', zavrsi: true });
    expect(texts()).toContain('Profil je aktivan i sačuvan.');
  });
  it('an ordinary save of a profile that already has a name does not change it behind the person\'s back', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' }; mockRead.mockResolvedValue(different); await render();
    input('Nova stavka: Alat i oprema', 'Merdevine'); click('Dodaj: Alat i oprema');
    mockRead.mockResolvedValue({ ...different, alati: ['Bušilica', 'Merdevine'] });
    click('Sačuvaj izmene'); await settle();
    expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, alati: ['Bušilica', 'Merdevine'] });
    expect(mockWrite.mock.calls[0][0]).not.toHaveProperty('ime');
  });
  it('a draft with no name of its own takes the account\'s on the first ordinary save', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' }; mockRead.mockResolvedValue({ ...profile, ime: '', stanje: 'DRAFT' }); await render();
    input('O meni', 'Radim sa bratom');
    mockRead.mockResolvedValue({ ...profile, ime: 'Milos', biografija: 'Radim sa bratom', stanje: 'DRAFT' });
    click('Sačuvaj izmene'); await settle();
    expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, ime: 'Milos', biografija: 'Radim sa bratom' });
  });
  it('with no name on the account and none on the profile the primary leads to the one place it is written', async () => {
    mockAccountName = { state: 'ready', name: null };
    mockRead.mockResolvedValue({ ...profile, ime: '', stanje: 'DRAFT' }); await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Proveri i aktiviraj profil' })).toHaveLength(0);
    expect(control('Veštine i ime naloga: nedostaje')).toBeTruthy();
    click('Dodaj ime'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/podaci'); expect(mockWrite).not.toHaveBeenCalled();
  });
  it('waits for the name of the account before it activates', async () => {
    mockAccountName = { state: 'loading' }; mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT' }); await render();
    expect(control('Proveri i aktiviraj profil').props.disabled).toBe(true);
    click('Proveri i aktiviraj profil'); await settle(); expect(mockWrite).not.toHaveBeenCalled();
  });
  it('a name of the account that cannot be read leaves the profile\'s own in place and draws no difference', async () => {
    mockAccountName = { state: 'error', retry: jest.fn() }; mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT' }); await render();
    expect(tree.root.findAllByProps({ testID: 'worker-name-difference' })).toHaveLength(0);
    click('Proveri i aktiviraj profil'); await settle();
    expect(mockWrite).toHaveBeenCalledWith({ zavrsi: true });
  });
  it('the first conversation entry of an empty account still writes nothing', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' }; mockRead.mockResolvedValue(null); await render();
    click('Uredi kroz razgovor'); expect(mockRouter.push).toHaveBeenCalledWith('/profil/razgovor'); expect(mockWrite).not.toHaveBeenCalled();
  });
});


it('suspension retires callbacks captured before a same-focus authoritative read', async () => {
  mockAccountName = { state: 'ready', name: 'Milos' };
  await renderReading(); const retained = tree.root.findByType(WorkerProfileForm).props;
  mockRead.mockResolvedValue({ ...profile, ime: 'Milos', stanje: 'SUSPENDED' });
  click('Koristi „Milos“'); await settle();
  expect(texts()).toContain('Profil je trenutno suspendovan');
  act(() => { retained.openConversation(); retained.navigate('/profil/dostupnost');
    retained.navigate('/profil/lokacija'); retained.onEditPart('skills'); retained.availableNow.onChange(false); });
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.navigate).not.toHaveBeenCalled();
  expect(mockAvailabilityRead).not.toHaveBeenCalled(); expect(mockAvailabilitySave).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
  click('Obrati se podršci'); expect(mockRouter.navigate).toHaveBeenCalledWith('/podrska');
});
it('a biography deep link cannot reopen editing of a suspended profile', async () => {
  mockParams = { uredi: 'o-meni', n: 'suspended' }; mockRead.mockResolvedValue({ ...profile, stanje: 'SUSPENDED' });
  await renderReading(); expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
  expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
  expect(mockWrite).not.toHaveBeenCalled();
});

it('a suspended profile cannot synchronize a different name, including through a retained handler', async () => {
  mockAccountName = { state: 'ready', name: 'Milos' }; mockRead.mockResolvedValue({ ...profile, stanje: 'SUSPENDED' });
  await renderReading(); expect(control('Koristi „Milos“').props.disabled).toBe(true);
  act(() => tree.root.findByType(WorkerProfileForm).props.onUseAccountName());
  expect(mockWrite).not.toHaveBeenCalled();
});
it('suspension during a legacy edit preserves the draft and pending readback but admits no further save', async () => {
  await render(); input('O meni', 'Moj sačuvani lokalni unos');
  const retained = tree.root.findByType(WorkerProfileForm).props;
  const save = control('Sačuvaj izmene').props.onPress;
  mockWrite.mockResolvedValueOnce({ ok: false, kod: 'UNKNOWN', poruka: 'Nepotvrđeno' });
  click('Sačuvaj izmene'); await settle();
  mockRead.mockResolvedValue({ ...profile, stanje: 'SUSPENDED', biografija: 'Ranije sačuvan opis' });
  click('Pogledaj sačuvani profil'); await settle();
  expect(texts()).toContain('Ranije sačuvan opis');
  expect(texts()).toContain('Nesačuvani unos je zadržan.');
  expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
  act(() => { retained.change({ ...retained.draft, biografija: 'Zastarela promena' }); save(); }); await settle();
  expect(mockWrite).toHaveBeenCalledTimes(1);
  // Resolving the restriction later must not replace the authored local text.
  mockRead.mockResolvedValue(profile); click('Pogledaj sačuvani profil'); await settle();
  click('Izmeni podatke'); openEditor('O meni');
  expect(control('O meni').props.value).toBe('Moj sačuvani lokalni unos');
});

it('suspended support has no impossible save prerequisite and retains an unsaved local draft', async () => {
  await render(); input('O meni', 'Moj lokalni opis');
  const background = async () => { await act(async () => { for (const listener of [...mockListeners]) listener('background'); }); };
  const resume = async () => { await act(async () => { for (const listener of [...mockListeners]) listener('active'); }); };
  await background(); mockRead.mockResolvedValue({ ...profile, stanje: 'SUSPENDED' }); await resume();
  click('Obrati se podršci'); expect(mockRouter.navigate).toHaveBeenCalledWith('/podrska');
  expect(mockWrite).not.toHaveBeenCalled();
  await background(); mockRead.mockResolvedValue(profile); await resume();
  openEditor('O meni'); expect(control('O meni').props.value).toBe('Moj lokalni opis');
});
