import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockAccount = '10000000-0000-4000-8000-000000000001', mockRevision = 1;
let mockIntent = 'uskocer', mockFocused = true, mockPlatform = 'android';
// ONE NAME (owner, 8 Oct 2026): the work profile has no field for the name, it takes the ACCOUNT's. The hook is mocked (the real one reads the server).
let mockAccountName: { state: 'loading' } | { state: 'error'; retry: () => void } | { state: 'ready'; name: string | null; profileId?: string | null } = { state: 'ready', name: 'Ana' };
// "Lični podaci" leads here with `uredi=o-meni` and a nonce `n` (a link of the router).
let mockParams: { uredi?: string; n?: string } = {};
let mockModeView: import('../../hooks/useWorkerExecutionModes').WorkerExecutionModeView = { kind: 'confirmed', modes: ['ON_SITE'] };
jest.mock('../../hooks/useWorkerExecutionModes', () => ({ useWorkerExecutionModes: () => ({ view: mockModeView, refresh: jest.fn() }) }));
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
import { takeAiCorrection } from '../aiCorrectionIntent';
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
const settle = async () => { await act(async () => {}); };
async function renderReading() { await act(async () => { tree = create(<Profile />, {
  createNodeMock: element => element.type === 'ScrollView' ? { scrollTo: mockScrollTo } : element.type === 'TextInput' ? { focus: mockFocusField } : null,
}); }); }
async function render() { await renderReading(); }
beforeEach(() => {
  jest.clearAllMocks(); mockRead.mockReset().mockResolvedValue(profile); mockWrite.mockReset().mockResolvedValue({ ok: true, podatak: null });
  mockAccount = '10000000-0000-4000-8000-000000000001'; mockRevision = 1; mockIntent = 'uskocer'; mockFocused = true; mockPlatform = 'android';
  mockAccountName = { state: 'ready', name: 'Ana' }; mockParams = {};
  mockModeView = { kind: 'confirmed', modes: ['ON_SITE'] };
  mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

it('opens a dedicated map confirmation bound to the saved worker and leaves area edits in AI', async () => {
  await renderReading();
  await click('Potvrdi tačku na mapi');
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/profil/lokacija', params: { mode: 'point', profileId: profile.id } });
  expect(mockWrite).not.toHaveBeenCalled();
  const retained = tree.root.findByType(WorkerProfileForm).props.confirmMap;
  mockModeView = { kind: 'confirmed', modes: ['REMOTE'] };
  await act(async () => tree.update(<Profile />));
  mockRouter.navigate.mockClear();
  await act(async () => retained());
  expect(mockRouter.navigate).not.toHaveBeenCalled();
});

it('passes owned remote mode into the saved profile instead of assuming its city is coverage', async () => {
  mockModeView = { kind: 'confirmed', modes: ['REMOTE'] };
  await renderReading();
  expect(texts()).toContain('Na daljinu'); expect(texts()).toContain('Grad profila');
  expect(texts()).not.toContain('20 km');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Područje dolaska' })).toHaveLength(0);
});

it('an absent pristine profile opens the guarded conversation without creating an empty profile', async () => {
  mockRead.mockResolvedValue(null); await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Sačuvaj profil' })).toHaveLength(0);
  click('Uredi kroz razgovor');
  expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/razgovor');
  expect(mockWrite).not.toHaveBeenCalled();
});

it('read failure offers retry without constructing a false/15km draft', async () => {
  mockRead.mockRejectedValueOnce(new Error('private diagnostic')); await render();
  expect(texts()).toContain('Profil nije učitan'); expect(texts()).not.toContain('private diagnostic');
  expect(tree.root.findAllByProps({ label: 'Dostupnost' })).toHaveLength(0);
  click('Ponovo učitaj profil'); await settle(); expect(texts()).toContain('Mogu odmah');
});

const readingScroll = () => tree.root.findByType('ScrollView' as any);
const scrollEvent = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y } } });
const formLayout = () => tree.root.findByProps({ testID: 'worker-profile-reading' }).props.onLayout();
async function focusProfile(focused: boolean) { mockFocused = focused; await act(async () => tree.update(<Profile />)); }

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

// A finished profile is read first. Its primary action and contextual area/week entries open AI;
// reading a fact or opening a conversation never writes the profile.
describe('the saved profile is read first', () => {
  it('reads the identity and facts with one AI edit action, no manual fields or duplicate title', async () => {
    await renderReading();
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
    expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
    expect(texts()).not.toContain('Tvoj radni profil'); expect(texts()).toContain('Ana');
    expect(texts()).toContain('Šta radiš'); expect(texts()).toContain('Prevoz, utovar');
    expect(texts()).toContain('Područje dolaska'); expect(texts()).toContain('Novi Sad · do 20 km');
    expect(texts()).toContain('Kada'); expect(texts()).toContain('Mogu odmah'); expect(texts()).not.toContain('Mogu odmah · dostupnost'); expect(texts()).toContain('Dostupnost');
    expect(texts()).not.toMatch(/Oprema|Bušilica|Kombi/);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Izmeni: O meni' })).toHaveLength(0);
    // The two buttons of the older reading ("Izmeni razgovorom" and "Izmeni ručno") are gone, and so is the notifications row: the rows lead to the part they change.
    for (const gone of ['Izmeni razgovorom', 'Izmeni ručno', 'Obaveštenja o zadacima', 'Područje rada']) expect([gone, tree.root.findAllByProps({ accessibilityLabel: gone }).length]).toEqual([gone, 0]);
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
  it('keeps optional saved equipment out of the MVP profile reading', async () => {
    await renderReading();
    expect(tree.root.findAllByProps({ testID: 'worker-kit-info' })).toHaveLength(0);
    expect(texts()).not.toMatch(/Oprema|Bušilica|Kombi/);
  });

  it('"Uredi kroz razgovor" opens the guarded conversation, and writes nothing', async () => {
    await renderReading(); click('Uredi kroz razgovor');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/razgovor'); expect(mockWrite).not.toHaveBeenCalled();
  });
  it('"Područje dolaska" leads to the area and "Nedeljni raspored" to the week, and neither writes anything', async () => {
    await renderReading();
    click('Područje dolaska'); expect(mockRouter.navigate).toHaveBeenLastCalledWith({pathname:'/profil/razgovor',params:{aiCorrection:expect.any(String)}});
    click('Dostupnost'); expect(mockRouter.navigate).toHaveBeenLastCalledWith({pathname:'/profil/razgovor',params:{aiCorrection:expect.any(String)}});
    expect(mockWrite).not.toHaveBeenCalled();
  });
  it.each([['Područje dolaska', 'worker.area'], ['Nedeljni raspored', 'worker.time']] as const)(
    'a saved draft opens %s in the same AI journey and keeps only its main footer action', async (label, target) => {
      mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT' }); await renderReading();
      expect(control('Pregled za aktivaciju')).toBeTruthy();
      expect(tree.root.findAllByProps({ testID: 'worker-profile-footer' })).toHaveLength(1);
      expect(tree.root.findAllByProps({ accessibilityLabel: 'Uredi kroz razgovor' })).toHaveLength(0);
      click(label);
      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      const route = mockRouter.navigate.mock.calls[0][0];
      expect(route).toEqual({ pathname: '/profil/razgovor', params: { aiCorrection: expect.any(String) } });
      expect(takeAiCorrection(route.params.aiCorrection, { accountId: mockAccount, accountRevision: mockRevision }, 'worker',
        '30000000-0000-4000-8000-000000000001')?.target).toBe(target);
      expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockWrite).not.toHaveBeenCalled();
      expect(mockAvailabilitySave).not.toHaveBeenCalled();
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
    expect(control('Uredi kroz razgovor').props.disabled).toBe(true); expect(control('Područje dolaska').props.disabled).toBe(true);
    act(() => tree.root.findByType(WorkerProfileForm).props.onEditPart('skills'));
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
    mockRead.mockResolvedValue({ ...profile, ime: 'Milos' });
    await act(async () => finish({ ok: true, podatak: null }));
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
    expect(tree.root.findAllByProps({ testID: 'worker-profile-saved' })).toHaveLength(1);
    expect(control('Pregled za aktivaciju')).toBeTruthy();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Proveri i aktiviraj profil' })).toHaveLength(0);
    click('Pregled za aktivaciju');
    expect(mockRouter.navigate).toHaveBeenCalledWith({pathname:'/profil/razgovor',params:{activationRequest:expect.any(String)}});
    expect(mockWrite).not.toHaveBeenCalled();
  });
});


// "Lični podaci" writes the account's name, and "O meni" is the work profile's text: the row leads here, to the editor of that part (`uredi=o-meni`), once for each tap
// (the nonce `n`), and it opens without putting the keyboard up.
describe('"O meni" written from "Lični podaci"', () => {
  it('a legacy edit link opens an AI topic once per tap without exposing the manual editor', async () => {
    mockParams={uredi:'o-meni',n:'1'};await renderReading();
    expect(tree.root.findAllByProps({testID:'worker-profile-saved'})).toHaveLength(1);
    expect(mockRouter.navigate).toHaveBeenCalledWith({pathname:'/profil/razgovor',params:{aiCorrection:expect.any(String)}});
    expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    await act(async()=>tree.update(<Profile/>));expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    mockParams={uredi:'o-meni',n:'2'};await act(async()=>tree.update(<Profile/>));
    expect(mockRouter.navigate).toHaveBeenCalledTimes(2);expect(mockWrite).not.toHaveBeenCalled();
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

  it('the first conversation entry of an empty account still writes nothing', async () => {
    mockAccountName = { state: 'ready', name: 'Milos' }; mockRead.mockResolvedValue(null); await render();
    click('Uredi kroz razgovor'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/razgovor'); expect(mockWrite).not.toHaveBeenCalled();
  });
});


it('suspension retires callbacks captured before a same-focus authoritative read', async () => {
  mockAccountName = { state: 'ready', name: 'Milos' };
  await renderReading(); const retained = tree.root.findByType(WorkerProfileForm).props;
  mockRead.mockResolvedValue({ ...profile, ime: 'Milos', stanje: 'SUSPENDED' });
  click('Koristi „Milos“'); await settle();
  expect(texts()).toContain('Profil je trenutno suspendovan');
  act(() => { retained.openConversation(); retained.navigate('/profil/dostupnost');
    retained.navigate('/profil/lokacija'); retained.onEditPart('skills'); retained.availableNow.onEdit(); });
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

it('a first visit is only a calm AI entry; opening it creates no profile or manual fields', async () => {
  mockRead.mockResolvedValue(null); await renderReading();
  expect(tree.root.findAllByProps({ testID: 'worker-profile-intro' })).toHaveLength(1);
  expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Izmeni: O meni' })).toHaveLength(0);
  click('Uredi kroz razgovor');
  expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/razgovor'); expect(mockWrite).not.toHaveBeenCalled();
});

it.each([true, false])('availability %s remains a saved fact and opens the time topic without a direct write', async available => {
  mockRead.mockResolvedValue({ ...profile, dostupanOdmah: available }); await renderReading();
  expect(tree.root.findAll(node => String(node.type) === 'Switch')).toHaveLength(0);
  click('Dostupnost');
  const route = mockRouter.navigate.mock.calls.at(-1)![0];
  expect(takeAiCorrection(route.params.aiCorrection, { accountId: mockAccount, accountRevision: mockRevision }, 'worker',
    '30000000-0000-4000-8000-000000000001')?.target).toBe('worker.time');
  expect(mockAvailabilityRead).not.toHaveBeenCalled(); expect(mockAvailabilitySave).not.toHaveBeenCalled(); expect(mockWrite).not.toHaveBeenCalled();
  expect(tree.root.findByType(WorkerProfileForm).props.draft.dostupanOdmah).toBe(available);
});

it('an unconfirmed name command holds Back and topic navigation until readback, then allows one explicit retry', async () => {
  mockAccountName = { state: 'ready', name: 'Milos' };
  await renderReading();
  const retained = tree.root.findByType(WorkerProfileForm).props;
  mockWrite.mockResolvedValueOnce({ ok: false, kod: 'UNKNOWN', poruka: 'Nepotvrđeno' });
  click('Koristi „Milos“'); await settle();
  click('Nazad'); expect(hardwareBack()).toBe(true);
  act(() => { retained.availableNow.onEdit(); retained.openConversation('area'); });
  expect(mockRouter.back).not.toHaveBeenCalled(); expect(mockRouter.navigate).not.toHaveBeenCalled();
  expect(mockWrite).toHaveBeenCalledTimes(1);
  click('Pogledaj sačuvani profil'); await settle();
  expect(mockWrite).toHaveBeenCalledTimes(1);
  mockRead.mockResolvedValue({ ...profile, ime: 'Milos' });
  click('Sačuvaj ponovo'); await settle();
  expect(mockWrite.mock.calls.map(call => call[0])).toEqual([{ zavrsi: false, ime: 'Milos' }, { zavrsi: false, ime: 'Milos' }]);
  expect(texts()).toContain('Ime radnog profila je promenjeno.');
});

it('late name-save completion and retained availability cannot cross an account generation', async () => {
  let finish!: (value: unknown) => void;
  mockAccountName = { state: 'ready', name: 'Milos' };
  mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await renderReading(); const retained = tree.root.findByType(WorkerProfileForm).props.availableNow.onEdit;
  click('Koristi „Milos“'); await settle();
  mockRevision += 2; await act(async () => tree.update(<Profile />));
  const reads = mockRead.mock.calls.length;
  await act(async () => { finish({ ok: true, podatak: null }); retained(); });
  expect(mockRead).toHaveBeenCalledTimes(reads); expect(mockRouter.navigate).not.toHaveBeenCalled();
  expect(texts()).not.toContain('Ime radnog profila je promenjeno.');
});

it('a retained legacy draft and unknown command remain recoverable without reopening manual fields', async () => {
  await renderReading();
  const legacy = tree.root.findByType(WorkerProfileForm).props;
  // Models local state already held by a retained route, not an exposed UI editor.
  act(() => legacy.change({ ...legacy.draft, biografija: 'Zadržani lokalni opis' }));
  expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
  mockWrite.mockResolvedValueOnce({ ok: false, kod: 'UNKNOWN', poruka: 'Nepotvrđeno' });
  click('Sačuvaj izmene'); await settle();
  click('Uredi kroz razgovor'); expect(mockRouter.navigate).not.toHaveBeenCalled();
  expect(tree.root.findByType(WorkerProfileForm).props.draft.biografija).toBe('Zadržani lokalni opis');
  mockRead.mockResolvedValue({ ...profile, biografija: 'Zadržani lokalni opis' });
  click('Pogledaj sačuvani profil'); await settle();
  expect(mockWrite).toHaveBeenCalledTimes(1); expect(texts()).toContain('Izmene profila su sačuvane.');
  expect(tree.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
});
