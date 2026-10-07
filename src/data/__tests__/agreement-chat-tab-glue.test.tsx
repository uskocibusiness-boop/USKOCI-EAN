import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { sys } from '../../ui/system/tokens';
const mockAccount = '10000000-0000-4000-8000-000000000001', mockOther = '10000000-0000-4000-8000-000000000002', mockAgreementId = '20000000-0000-4000-8000-000000000001';
const mockRouter = { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn() };
const mockRead = jest.fn(), mockMessages = jest.fn(), mockDisplayed = jest.fn();
const mockScrollTo = jest.fn();
let mockParams: Record<string, string> = { id: mockAgreementId };
const mockWindow = { width: 390, height: 844, fontScale: 1, scale: 3 };
const mockSource = { dogovor: mockRead, poruke: mockMessages, oznaciZavrsetak: jest.fn(), potvrdiZavrsetak: jest.fn(), podeliTelefon: jest.fn(), opoziviTelefon: jest.fn(), oznaciPorukeProcitanim: jest.fn() };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'android' };
    if (key === 'useWindowDimensions') return () => mockWindow;
    if (key === 'AppState') return { currentState: 'active', addEventListener: () => ({ remove: () => {} }) };
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => effect(), [effect]) }));
jest.mock('../agreementClientService', () => ({ agreementProblemService: { submit: jest.fn(), read: jest.fn() } }));
jest.mock('../groupConversationService', () => ({ groupConversationService: { context: jest.fn().mockResolvedValue({ ok: true, podatak: { group: null } }) } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' } }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/AgreementChat', () => ({ AgreementChat: (props: { context?: React.ReactNode }) => require('react').createElement('AgreementChat', props, props.context) }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'PrivateMap' }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: 0 }), sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: 0 }) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource }));
jest.mock('../../hooks/useAgreementOutbox', () => ({ useAgreementOutbox: () => ({ model: { reconcile: jest.fn().mockResolvedValue(undefined) }, state: { phase: 'ready', entries: [] } }) }));
jest.mock('../../hooks/useAgreementPhotos', () => ({ useAgreementPhotos: () => ({ agreementId: mockAgreementId, loaded: true, busy: false, items: [] }) }));
jest.mock('../agreementMessageHistoryService', () => ({
  compareAgreementMessageCursors: (left: any, right: any) => left.createdAt.localeCompare(right.createdAt) || left.messageId.localeCompare(right.messageId),
  agreementMessageHistoryService: {
    page: async (id: string, _options: unknown, scope: any) => ({ ok: true, podatak: {
      accountId: scope.accountId, agreementId: id, messages: await mockMessages(id, scope.accountId), olderCursor: null, asOf: '2026-09-27T13:00:00.123456Z' } }),
    window: async (id: string, target: string, _options: unknown, scope: any) => ({ ok: true, podatak: {
      accountId: scope.accountId, agreementId: id, targetMessageId: target, messages: await mockMessages(id, scope.accountId),
      beforeCursor: null, afterCursor: null, asOf: '2026-09-27T13:00:00.123456Z' } }),
    markDisplayed: (...args: unknown[]) => mockDisplayed(...args),
  },
}));
jest.mock('../reviewsClientService', () => ({ reviewsClientService: { context: jest.fn().mockResolvedValue({ ok: true, podatak: { eligible: true, review: null } }) } }));
import Dogovor from '../../app/dogovor/[id]';

/**
 * The conversation's bar has the Dogovor's own "···" (team T3c): while Poruke is shown, "Prijavi ili blokiraj osobu" and the rest of
 * the overview's menu are one tap away, and an entry that names a section of the overview takes the person there and scrolls to it.
 */
const base = (patch: Record<string, unknown> = {}) => ({
  id: mockAgreementId, naslov: 'Pomoć pri selidbi', stanje: 'CONFIRMED', verzija: 1, cena: { prikaz: '3.000 RSD' }, pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0 },
  ucesnici: [{ id: mockAccount, ime: 'Ana', inicijali: 'AN', uloga: 'narucilac', mesta: null, viSte: true },
    { id: mockOther, ime: 'Marko', inicijali: 'MA', uloga: 'uskocer', mesta: 1, viSte: false }],
  hronologija: [], kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true },
  chatDostupan: true, vremeTekst: 'Fleksibilno', putanjaTekst: 'Beograd', problemOtvoren: false, rokPotvrdeIso: null, rezim: 'FIZICKI',
  radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false, predlogIzmene: null },
  izvor: { zadatakId: '30000000-0000-4000-8000-000000000001', prijavaId: '40000000-0000-4000-8000-000000000001' }, ...patch });
let tree: ReactTestRenderer;
const presses = () => tree.root.findAll(node => String(node.type) === 'Press');
const labels = () => presses().map(node => node.props.accessibilityLabel);
const menuLabels = () => presses().filter(node => node.props.accessibilityRole === 'menuitem').map(node => node.props.accessibilityLabel);
const chat = () => tree.root.findAll(node => String(node.type) === 'AgreementChat');
async function render(workspace: Record<string, unknown>) {
  mockRead.mockResolvedValue(workspace); mockMessages.mockResolvedValue([]);
  await act(async () => {
    tree = create(<Dogovor />, { createNodeMock: element => element.type === ('ScrollView' as never) ? { scrollTo: mockScrollTo } : null });
  });
}
beforeEach(() => { jest.clearAllMocks(); mockParams = { id: mockAgreementId, tab: 'poruke' }; mockDisplayed.mockResolvedValue({ ok: true, podatak: {} }); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

describe('the conversation\'s "···"', () => {
  it('is in the conversation bar and opens the same menu as the overview, ending with "Prijavi ili blokiraj osobu"', async () => {
    await render(base());
    expect(chat()).toHaveLength(1);                                                  // Poruke is what is shown
    expect(labels()).toContain('Više radnji');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Više radnji' }).props.onPress());
    expect(menuLabels()).toEqual(['Izmeni uslove', 'Podeli svoj broj', 'Podeli lokaciju', 'Prijavi problem', 'Otkaži Dogovor', 'Prijavi ili blokiraj osobu']);
  });

  it('"Prijavi ili blokiraj osobu" goes where the overview\'s safety row goes, for this person and this Dogovor', async () => {
    await render(base());
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Više radnji' }).props.onPress());
    await act(async () => presses().find(node => node.props.accessibilityLabel === 'Prijavi ili blokiraj osobu')!.props.onPress());
    expect(mockRouter.navigate).toHaveBeenLastCalledWith({ pathname: '/bezbednost', params: { targetAccountId: mockOther, agreementId: mockAgreementId } });
  });

  it('on a finished Dogovor the conversation\'s menu is the safety entry alone, still reachable', async () => {
    await render(base({ stanje: 'COMPLETED', chatDostupan: false }));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Više radnji' }).props.onPress());
    expect(menuLabels()).toEqual(['Prijavi ili blokiraj osobu']);
  });

  it('is absent when the Dogovor offers no entry at all (a Dogovor that does not name the other side)', async () => {
    const lone = base({ stanje: 'COMPLETED' }) as { ucesnici: { viSte: boolean }[] };
    await render({ ...lone, ucesnici: lone.ucesnici.filter(person => person.viSte) });
    expect(labels()).not.toContain('Više radnji');
  });

  it('choosing "Otkaži Dogovor" from the conversation opens its form once, with the cancel step', async () => {
    await render(base());
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Više radnji' }).props.onPress());
    await act(async () => presses().find(node => node.props.accessibilityLabel === 'Otkaži Dogovor')!.props.onPress());
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/dogovor/[id]/izmene', params: { id: mockAgreementId, start: 'cancel' } });
  });
});

describe('an entry that names a section of the overview', () => {
  const problemWrapper = () => tree.root.findAll(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function'
    && node.findAllByProps({ accessibilityLabel: 'Opiši problem' }).length > 0 && node.findAll(child => String(child.type) === 'View' && typeof child.props.onLayout === 'function').length === 1)[0];

  it('"Prijavi problem" returns to the overview, opens the form for it and scrolls to it once it has been laid out', async () => {
    await render(base());
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Opiši problem' })).toHaveLength(0);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Više radnji' }).props.onPress());
    await act(async () => presses().find(node => node.props.accessibilityLabel === 'Prijavi problem')!.props.onPress());
    // The overview is shown: its form is there and the conversation is gone.
    expect(chat()).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Opiši problem' }).length).toBeGreaterThan(0);
    expect(mockScrollTo).not.toHaveBeenCalled();                                     // not before the section has a place
    await act(async () => problemWrapper().props.onLayout({ nativeEvent: { layout: { y: 640 } } }));
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 640 - sys.space.sm, animated: true });
    // The wish is spent: the next layout of the section (a refresh, a keyboard) does not pull the person back.
    await act(async () => problemWrapper().props.onLayout({ nativeEvent: { layout: { y: 700 } } }));
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
  });

  it('"Podeli lokaciju" returns to the overview and scrolls to the place section', async () => {
    await render(base());
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Više radnji' }).props.onPress());
    await act(async () => presses().find(node => node.props.accessibilityLabel === 'Podeli lokaciju')!.props.onPress());
    expect(chat()).toHaveLength(0);
    const place = tree.root.findAll(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function'
      && node.findAll(child => String(child.type) === 'View' && typeof child.props.onLayout === 'function').length === 1
      && node.findAllByProps({ accessibilityLabel: 'Osveži dozvolu za lokaciju' }).length > 0)[0];
    await act(async () => place.props.onLayout({ nativeEvent: { layout: { y: 320 } } }));
    expect(mockScrollTo).toHaveBeenCalledWith({ y: 320 - sys.space.sm, animated: true });
  });

  it('chosen in the overview itself, an entry behaves exactly as before: no tab change', async () => {
    mockParams = { id: mockAgreementId };
    await render(base());
    expect(chat()).toHaveLength(0);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Više radnji' }).props.onPress());
    await act(async () => presses().find(node => node.props.accessibilityLabel === 'Prijavi problem')!.props.onPress());
    expect(chat()).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Opiši problem' }).length).toBeGreaterThan(0);
  });
});
