import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockAccount = '10000000-0000-4000-8000-000000000001', mockRevision = 1;
let mockIntent = 'uskocer', mockFocused = true, mockPlatform = 'android';
const mockListeners = new Set<(state: string) => void>();
const mockBackHandlers = new Set<() => boolean>();
const mockRead = jest.fn(), mockWrite = jest.fn(), mockScrollTo = jest.fn();
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
jest.mock('expo-router', () => ({ get router() { return mockRouter; },
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
import Profile from '../../app/(app)/profil/radnik';
const profile = { id: '20000000-0000-4000-8000-000000000001', ime: 'Ana', grad: 'Novi Sad', biografija: '',
  vestine: ['Prevoz, utovar'], alati: ['Bušilica'], vozila: ['Kombi'], licence: ['B, C'], stanje: 'ACTIVE', dostupanOdmah: true, radijusKm: 20, kapacitetTima: 1, capacityRevision: 'a'.repeat(64) };
let tree: ReactTestRenderer;
const control = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(value => typeof value === 'string')).join(' ');
const click = (label: string) => act(() => control(label).props.onPress());
const hardwareBack = () => {
  let handled = false;
  act(() => { handled = [...mockBackHandlers].reverse().some(handler => handler()); });
  return handled;
};
const openEditor = (label: string) => {
  if (!control(`Izmeni: ${label}`).props.accessibilityState.expanded) click(`Izmeni: ${label}`);
};
const input = (label: string, value: string) => {
  openEditor(label.startsWith('Nova stavka: ') ? label.slice('Nova stavka: '.length) : 'O meni');
  act(() => control(label).props.onChangeText(value));
};
const settle = async () => { await act(async () => {}); };
async function render() { await act(async () => { tree = create(<Profile />, {
  createNodeMock: element => element.type === 'ScrollView' ? { scrollTo: mockScrollTo } : null,
}); }); }
beforeEach(() => {
  jest.clearAllMocks(); mockRead.mockReset().mockResolvedValue(profile); mockWrite.mockReset().mockResolvedValue({ ok: true, podatak: null });
  mockAccount = '10000000-0000-4000-8000-000000000001'; mockRevision = 1; mockIntent = 'uskocer'; mockFocused = true; mockPlatform = 'android';
  mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

// Since 2026-09-24 availability and the work area are summary rows that open their own editors: no switch, no dead fields.
it.each(['android', 'ios'])('renders the actual V2 form and keyboard boundary on %s, retaining true availability and comma-containing terms', async platform => {
  mockPlatform = platform; await render();
  expect(texts()).toContain('Mogu odmah · pogledaj raspored'); expect(texts()).toContain('Novi Sad · 20 km');
  expect(tree.root.findAll(node => String(node.type) === 'Switch')).toHaveLength(0);
  expect(texts()).toContain('Prevoz, utovar');
  // Availability is a factual row; notification consent remains in its own settings flow.
  expect(texts()).toContain('njihov broj navodiš u toj ponudi');
  expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
  expect(tree.root.findByType('KeyboardAvoidingView' as any).props.behavior).toBe(platform === 'ios' ? 'padding' : 'height');
  // The tab bar is hidden on this flow since 2026-09-23, so the screen owns its bottom inset.
  expect(tree.root.findByType('SafeAreaView' as any).props.edges).toEqual(['top', 'bottom']);
  expect(mockWrite).not.toHaveBeenCalled();
});

it('opens the personal editor explicitly and keeps its regular field on the bundled Inter face', async () => {
  await render(); openEditor('O meni');
  const name = StyleSheet.flatten(control('Ime na radnom profilu').props.style);
  expect(name.fontFamily).toBe('Inter-Regular');
  expect(name.fontWeight).toBeUndefined();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Koliko ljudi možeš da obezbediš' })).toHaveLength(0);
});

it.each(['ACTIVE', 'SUSPENDED'])('a clean %s profile has no save footer, while editing and validation retain it', async stanje => {
  mockRead.mockResolvedValue({ ...profile, stanje }); await render();
  expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Sačuvaj izmene' })).toHaveLength(0);
  input('Ime na radnom profilu', 'Novo ime');
  expect(control('Sačuvaj izmene')).toBeTruthy();
  input('Ime na radnom profilu', profile.ime);
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

it('a successfully absent profile saves manual input as a first draft before activation', async () => {
  mockRead.mockResolvedValueOnce(null).mockResolvedValue({ ...profile, stanje: 'DRAFT' }); await render();
  expect(texts()).toContain('Pogledaj i uredi raspored'); expect(texts()).toContain('Izaberi gde želiš da radiš');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Koliko ljudi možeš da obezbediš' })).toHaveLength(0);
  input('Ime na radnom profilu', 'Ana');
  click('Sačuvaj profil'); await settle();
  expect(mockWrite).toHaveBeenCalledWith({ ime: 'Ana', zavrsi: false });
  expect(texts()).toContain('Profil je sačuvan i provereno učitan');
  expect(control('Proveri i aktiviraj profil')).toBeTruthy();
});
it('read failure offers retry without constructing a false/15km draft', async () => {
  mockRead.mockRejectedValueOnce(new Error('private diagnostic')); await render();
  expect(texts()).toContain('Profil nije učitan'); expect(texts()).not.toContain('private diagnostic');
  expect(tree.root.findAllByProps({ label: 'Dostupnost' })).toHaveLength(0);
  click('Ponovo učitaj profil'); await settle(); expect(texts()).toContain('Mogu odmah · pogledaj raspored');
});
it('location is read-only here and routes to the area editor', async () => {
  await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Grad ili mesto rada' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Radijus rada (km)' })).toHaveLength(0);
  expect(texts()).toContain('Novi Sad · 20 km');
  click('Područje rada'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/lokacija');
});
it('opens existing notification settings on WORKER without implying that profile save enables push', async () => {
  await render(); click('Obaveštenja o poslovima');
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/profil/obavestenja', params: { skup: 'WORKER' } });
  expect(mockWrite).not.toHaveBeenCalled();
});

const readingScroll = () => tree.root.findByType('ScrollView' as any);
const scrollEvent = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y } } });
const formLayout = () => tree.root.findByProps({ testID: 'worker-profile-reading' }).props.onLayout();
async function focusProfile(focused: boolean) { mockFocused = focused; await act(async () => tree.update(<Profile />)); }

it.each(['Obaveštenja o poslovima', 'Područje rada', 'Dostupnost'])('returns from %s to the reading position after native form layout, ignoring blur clamps', async label => {
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
  const retained = control('Obaveštenja o poslovima').props.onPress;
  input('Ime na radnom profilu', 'Lokalna izmena'); click('Obaveštenja o poslovima');
  expect(mockRouter.navigate).not.toHaveBeenCalled();
  expect(texts()).toContain('Sačuvaj unos pre otvaranja drugog podešavanja.');
  expect(control('Ime na radnom profilu').props.value).toBe('Lokalna izmena');
  mockRevision += 2; act(() => retained());
  expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(mockWrite).not.toHaveBeenCalled();
});
it('notification navigation stays blocked while a profile save has an unknown outcome', async () => {
  mockWrite.mockResolvedValue({ ok: false, kod: 'TIMEOUT', poruka: 'unknown' });
  await render(); const retained = control('Obaveštenja o poslovima').props.onPress;
  input('Ime na radnom profilu', 'Unos koji ostaje'); click('Sačuvaj izmene'); await settle();
  act(() => retained()); click('Obaveštenja o poslovima');
  expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(mockWrite).toHaveBeenCalledTimes(1);
  expect(control('Ime na radnom profilu').props.value).toBe('Unos koji ostaje');
});
it('sends only edited fields and confirms success only after matching server readback', async () => {
  let finish!: (result: unknown) => void;
  mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('Ime na radnom profilu', '  Ana Petrović  ');
  const save = control('Sačuvaj izmene').props.onPress;
  act(() => { save(); save(); }); expect(mockWrite).toHaveBeenCalledTimes(1);
  expect(mockWrite).toHaveBeenCalledWith({ ime: 'Ana Petrović', zavrsi: false });
  expect(texts()).not.toContain('Izmene profila su sačuvane');
  expect(control('Čuvamo profil…').props.disabled).toBe(true);
  mockRead.mockResolvedValue({ ...profile, ime: 'Ana Petrović', grad: 'Zemun' });
  await act(async () => finish({ ok: true, podatak: null }));
  expect(texts()).toContain('Izmene profila su sačuvane i proverene');
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
  expect(texts()).toContain('Profil je aktivan. Sačuvani podaci su potvrđeni'); expect(mockWrite).toHaveBeenCalledTimes(1);
});
it('a missing required skill prevents activation but permits an explicitly saved draft', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT', vestine: [] }); await render();
  // PKG-005 progressive CTA: activation is not offered until the basics exist; the primary action guides to the missing skill.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Proveri i aktiviraj profil' })).toHaveLength(0);
  click('Dopuni osnovne podatke'); expect(texts()).toContain('bar jednu veštinu'); expect(mockWrite).not.toHaveBeenCalled();
  click('Sačuvaj kao nacrt'); await settle(); expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false });
  expect(texts()).toContain('Izmene profila su sačuvane i proverene');
});
it('an ACTIVE readback with concurrently changed visible activation facts is not confirmed as the reviewed profile', async () => {
  mockRead.mockResolvedValueOnce({ ...profile, stanje: 'DRAFT' }).mockResolvedValue({ ...profile, vestine: ['Druga usluga'] });
  await render(); click('Proveri i aktiviraj profil'); await settle();
  expect(texts()).not.toContain('Profil je aktivan. Sačuvani podaci su potvrđeni');
  expect(control('Pogledaj sačuvani profil')).toBeTruthy();
  expect(texts()).toContain('Prevoz, utovar');
});
it('unknown outcome preserves the immutable command and requires readback before explicit retry', async () => {
  mockWrite.mockResolvedValue({ ok: false, kod: 'TIMEOUT', poruka: 'raw upstream' });
  await render(); input('Ime na radnom profilu', 'Novo ime'); const oldInput = control('Ime na radnom profilu').props.onChangeText;
  const oldSave = control('Sačuvaj izmene').props.onPress;
  click('Sačuvaj izmene'); await settle(); act(() => { oldSave(); oldInput('Kasniji tekst'); });
  expect(mockWrite).toHaveBeenCalledTimes(1); expect(control('Ime na radnom profilu').props.value).toBe('Novo ime');
  expect(control('Ime na radnom profilu').props.editable).toBe(false); expect(texts()).not.toContain('raw upstream');
  expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(1);
  click('Pogledaj sačuvani profil'); await settle(); act(() => oldSave()); expect(mockWrite).toHaveBeenCalledTimes(1);
  click('Ponovi isto čuvanje'); await settle(); expect(mockWrite).toHaveBeenCalledTimes(2);
  expect(mockWrite.mock.calls[1][0]).toEqual(mockWrite.mock.calls[0][0]);
});
it('fresh mismatching readback permits explicit editing without silently dropping the attempted draft', async () => {
  mockWrite.mockResolvedValue({ ok: false, kod: 'REFUSED', poruka: 'no' }); await render();
  input('Ime na radnom profilu', 'Moj nacrt'); click('Sačuvaj izmene'); await settle();
  click('Pogledaj sačuvani profil'); await settle(); click('Uredi unos posle provere');
  expect(control('Ime na radnom profilu').props.value).toBe('Moj nacrt'); expect(control('Ime na radnom profilu').props.editable).toBe(true);
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
  expect(control('Izmeni: Alat i oprema').props.accessibilityState.expanded).toBe(true);
  expect(control('Nova stavka: Alat i oprema').props.value).toBe('Merdevine');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Ime na radnom profilu' })).toHaveLength(0);
});
it('availability is a read-only summary that links to its revision-bound writer', async () => {
  await render(); expect(tree.root.findAll(node => String(node.type) === 'Switch')).toHaveLength(0);
  expect(texts()).toContain('Mogu odmah · pogledaj raspored');
  click('Dostupnost'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/dostupnost');
  expect(mockWrite).not.toHaveBeenCalled();
});
it('keeps retired license and permanent team facts out of the personal profile and an unrelated save', async () => {
  await render();
  expect(texts()).not.toMatch(/Licence koje navodiš|B, C|Kapacitet tima/);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Nova stavka: Licence koje navodiš' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Koliko ljudi možeš da obezbediš' })).toHaveLength(0);
  input('Ime na radnom profilu', 'Ana Petrović');
  mockRead.mockResolvedValue({ ...profile, ime: 'Ana Petrović' });
  click('Sačuvaj izmene'); await settle();
  expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, ime: 'Ana Petrović' });
  expect(texts()).toContain('Izmene profila su sačuvane i proverene');
});
it('activation confirms visible personal facts independently of legacy license and team readback', async () => {
  mockRead.mockResolvedValueOnce({ ...profile, stanje: 'DRAFT', capacityRevision: undefined })
    .mockResolvedValue({ ...profile, licence: [], kapacitetTima: 5, capacityRevision: 'b'.repeat(64) });
  await render(); click('Proveri i aktiviraj profil'); await settle();
  expect(mockWrite).toHaveBeenCalledWith({ zavrsi: true });
  expect(texts()).toContain('Profil je aktivan. Sačuvani podaci su potvrđeni');
  expect(texts()).not.toContain('B, C');
});
it.each(['account'])('retires retained callbacks and late reads across %s changes', async change => {
  await render(); input('Ime na radnom profilu', 'Unos starog naloga'); const oldSave = control('Sačuvaj izmene').props.onPress;
  let late!: (value: unknown) => void; mockRead.mockImplementationOnce(() => new Promise(resolve => { late = resolve; }));
  if (change === 'account') mockRevision += 2;
  await act(async () => tree.update(<Profile />)); act(() => oldSave()); expect(mockWrite).not.toHaveBeenCalled();
  await act(async () => late({ ...profile, ime: 'Aktuelni nalog' }));
  openEditor('O meni');
  expect(control('Ime na radnom profilu').props.value).toBe('Aktuelni nalog'); expect(texts()).not.toContain('Unos starog naloga');
});
// Owner decision 1 (2026-09-19): the app has no global mode. This used to be a row of the table above.
it('a flip of the retired app mode keeps the typed draft and lets the retained save run', async () => {
  await render(); input('Ime na radnom profilu', 'Unos koji ostaje'); const oldSave = control('Sačuvaj izmene').props.onPress;
  mockIntent = 'narucilac'; await act(async () => tree.update(<Profile />));
  expect(control('Ime na radnom profilu').props.value).toBe('Unos koji ostaje');
  await act(async () => oldSave()); expect(mockWrite).toHaveBeenCalledTimes(1);
});
it('blur retains draft and new-item input, while old callbacks cannot run after refocus', async () => {
  await render(); input('Ime na radnom profilu', 'Sačuvani lokalni unos'); input('Nova stavka: Veštine i usluge', 'Krečenje');
  input('Nova stavka: Alat i oprema', 'Merdevine');
  const save = control('Sačuvaj izmene').props.onPress;
  mockFocused = false; await act(async () => tree.update(<Profile />)); expect(texts()).not.toContain('Sačuvani lokalni unos');
  mockFocused = true; await act(async () => tree.update(<Profile />)); act(() => save()); expect(mockWrite).not.toHaveBeenCalled();
  openEditor('O meni');
  expect(control('Ime na radnom profilu').props.value).toBe('Sačuvani lokalni unos');
  openEditor('Veštine i usluge');
  expect(control('Nova stavka: Veštine i usluge').props.value).toBe('Krečenje');
  openEditor('Alat i oprema');
  expect(control('Nova stavka: Alat i oprema').props.value).toBe('Merdevine');
});
it('background hides the form and foreground waits for a pending write then rereads its actual result', async () => {
  let finish!: (value: unknown) => void; mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('Ime na radnom profilu', 'Potvrđeno ime'); click('Sačuvaj izmene');
  act(() => mockListeners.forEach(listener => listener('background'))); expect(texts()).not.toContain('Potvrđeno ime');
  act(() => mockListeners.forEach(listener => listener('active'))); await settle(); expect(mockRead).toHaveBeenCalledTimes(1);
  mockRead.mockResolvedValue({ ...profile, ime: 'Potvrđeno ime' });
  await act(async () => finish({ ok: true, podatak: null }));
  expect(mockRead).toHaveBeenCalledTimes(2); expect(texts()).toContain('Izmene profila su sačuvane i proverene');
});
it('a pending write across blur/refocus cannot open another write or lose its later result', async () => {
  let finish!: (value: unknown) => void; mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('Ime na radnom profilu', 'Posle povratka'); click('Sačuvaj izmene');
  mockFocused = false; await act(async () => tree.update(<Profile />));
  mockFocused = true; await act(async () => tree.update(<Profile />));
  expect(control('Čuvamo profil…').props.disabled).toBe(true);
  mockRead.mockResolvedValue({ ...profile, ime: 'Posle povratka' });
  await act(async () => finish({ ok: true, podatak: null }));
  expect(texts()).toContain('Izmene profila su sačuvane i proverene'); expect(mockWrite).toHaveBeenCalledTimes(1);
});
it('late write after account ABA cannot reread or announce old account success', async () => {
  let finish!: (value: unknown) => void; mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('Ime na radnom profilu', 'Stari unos'); click('Sačuvaj izmene');
  mockRevision += 2; await act(async () => tree.update(<Profile />)); const reads = mockRead.mock.calls.length;
  await act(async () => finish({ ok: true, podatak: null }));
  expect(mockRead).toHaveBeenCalledTimes(reads); expect(texts()).not.toContain('Izmene profila su sačuvane');
});
it('read timeout is bounded and late response cannot overwrite a successful replacement', async () => {
  jest.useFakeTimers(); let late!: (value: unknown) => void;
  mockRead.mockImplementationOnce(() => new Promise(resolve => { late = resolve; })); await render();
  await act(async () => jest.advanceTimersByTime(15_000)); click('Ponovo učitaj profil'); await settle();
  await act(async () => late({ ...profile, ime: 'Istekli odgovor' }));
  openEditor('O meni'); expect(control('Ime na radnom profilu').props.value).toBe('Ana');
});
it('a hanging transport becomes unknown without automatic replay or a late success announcement', async () => {
  jest.useFakeTimers(); let late!: (value: unknown) => void;
  mockWrite.mockImplementationOnce(() => new Promise(resolve => { late = resolve; })); await render();
  input('Ime na radnom profilu', 'Zadržan unos'); click('Sačuvaj izmene');
  await act(async () => jest.advanceTimersByTime(65_000)); expect(control('Pogledaj sačuvani profil')).toBeTruthy();
  await act(async () => late({ ok: true, podatak: null })); expect(mockRead).toHaveBeenCalledTimes(1);
  expect(mockWrite).toHaveBeenCalledTimes(1); expect(texts()).not.toContain('Izmene profila su sačuvane');
});
it('owned related settings navigation avoids losing a dirty draft and suspended profiles cannot request activation', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'SUSPENDED' }); await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Proveri i aktiviraj profil' })).toHaveLength(0);
  click('Dostupnost'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/dostupnost');
  input('Ime na radnom profilu', 'Lokalna izmena'); click('Područje rada');
  expect(mockRouter.navigate).toHaveBeenCalledTimes(1); expect(texts()).toContain('Sačuvaj unos pre otvaranja');
});

it.each(['toolbar', 'hardware'])('%s Back asks before discarding a local draft and cancel preserves it', async entry => {
  await render(); input('Ime na radnom profilu', 'Lokalno ime');
  const goBack = () => entry === 'toolbar' ? click('Nazad') : expect(hardwareBack()).toBe(true);
  goBack();
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(control('Odbaci izmene')).toBeTruthy();
  click('Nastavi uređivanje');
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(control('Ime na radnom profilu').props.value).toBe('Lokalno ime');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Odbaci izmene' })).toHaveLength(0);
  goBack(); click('Odbaci izmene');
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockWrite).not.toHaveBeenCalled();
});

it('confirmed discard resets a cached route draft before reentry and retires its retained save callback', async () => {
  await render(); input('O tvom iskustvu', 'QA lokalno');
  const previousSave = control('Sačuvaj izmene').props.onPress;
  click('Nazad'); click('Odbaci izmene');
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  // The router mock keeps the actual route mounted, just as a cached native route can remain mounted.
  expect(control('O tvom iskustvu').props.value).toBe(profile.biografija);
  expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(0);
  act(() => previousSave()); expect(mockWrite).not.toHaveBeenCalled();
  mockFocused = false; await act(async () => tree.update(<Profile />));
  mockFocused = true; await act(async () => tree.update(<Profile />));
  openEditor('O meni');
  expect(control('O tvom iskustvu').props.value).toBe(profile.biografija);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Sačuvaj izmene' })).toHaveLength(0);
  expect(texts()).not.toContain('QA lokalno');
  expect(mockWrite).not.toHaveBeenCalled();
});

it.each(['toolbar', 'hardware'])('%s Back retains an in-flight or unconfirmed command until successful readback', async entry => {
  let finish!: (result: unknown) => void;
  mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('Ime na radnom profilu', 'Potvrđeno ime'); click('Sačuvaj izmene');
  const goBack = () => entry === 'toolbar' ? click('Nazad') : expect(hardwareBack()).toBe(true);
  goBack();
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(texts()).toContain('Prvo proveri ishod čuvanja. Tvoj unos je zadržan.');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Odbaci izmene' })).toHaveLength(0);
  await act(async () => finish({ ok: false, kod: 'TIMEOUT', poruka: 'unknown' }));
  goBack();
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Odbaci izmene' })).toHaveLength(0);
  expect(control('Ime na radnom profilu').props.value).toBe('Potvrđeno ime');
  mockRead.mockResolvedValue({ ...profile, ime: 'Potvrđeno ime' });
  click('Pogledaj sačuvani profil'); await settle();
  expect(texts()).toContain('Izmene profila su sačuvane i proverene');
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
  await render();
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
    expect(control('Izmeni: Alat i oprema').props.accessibilityState.expanded).toBe(false);
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
  mockRead.mockResolvedValue({ ...profile, stanje: 'SUSPENDED' }); await render();
  input('Ime na radnom profilu', 'Lokalna izmena'); click('Piši podršci');
  expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(texts()).toContain('Sačuvaj unos pre nego što pišeš podršci.');
  expect(texts()).not.toContain('Sačuvaj unos pre otvaranja drugog podešavanja.');
});

describe('activation checklist', () => {
  it('names what a draft is missing, item by item', async () => {
    mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT', vestine: [] }); await render();
    expect(control('Ime i bar jedna veština: nedostaje')).toBeTruthy();
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
    input('Ime na radnom profilu', 'Ana Petrović');
    expect(control('Sačuvaj izmene')).toBeTruthy(); expect(texts()).not.toContain('Sve je spremno za aktivaciju.');
  });
});
