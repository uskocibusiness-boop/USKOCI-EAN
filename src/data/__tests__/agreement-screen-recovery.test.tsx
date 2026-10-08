import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockAccount = '10000000-0000-4000-8000-000000000001';
let mockAccountRevision = 0;
let mockPlatform = 'android';
let mockWindow = { width: 390, height: 844, fontScale: 1, scale: 3 };
let mockFocused = true;
const mockAppListeners = require('react-native').AppState.__testListeners as Set<(state: string) => void>;
const mockBackListeners = new Set<() => boolean>();
let mockKeyboardVisible = false;
const mockDismissKeyboard = jest.fn(() => { mockKeyboardVisible = false; });
let mockId: string | string[] = '20000000-0000-4000-8000-000000000001';
let mockTab: string | string[] | undefined;
let mockMessageId: string | string[] | undefined;
const mockHistoryWindow = jest.fn();
const mockRouter = { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn(), push: jest.fn() };
const mockGroupContext = jest.fn();
const mockRead = jest.fn();
const mockMessages = jest.fn();
const mockProblemSubmit = jest.fn(), mockProblemRead = jest.fn();
const mockDisplayed = jest.fn();
const mockSource = { dogovor: mockRead, poruke: mockMessages, oznaciZavrsetak: jest.fn(), potvrdiZavrsetak: jest.fn(),
  prijaviProblem: jest.fn(), podeliTelefon: jest.fn(), opoziviTelefon: jest.fn(), oznaciPorukeProcitanim: jest.fn().mockResolvedValue(0) };
const mockOutbox = { reconcile: jest.fn().mockResolvedValue(undefined) };
let mockOutboxState = { phase: 'loading', entries: [] as any[] };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  // Imports may subscribe before this test module's top-level initializers run (B3c -> supabaseClient).
  // Own the real listener set in the hoisted factory; route recovery still adds/removes and receives every event.
  const appListeners = new Set<unknown>();
  const appState = { currentState: 'active', __testListeners: appListeners,
    addEventListener: (_event: string, listener: (state: string) => void) => {
      appListeners.add(listener); return { remove: () => appListeners.delete(listener) };
    } };
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: mockPlatform };
    if (key === 'useWindowDimensions') return () => mockWindow;
    if (key === 'Keyboard') return { isVisible: () => mockKeyboardVisible, dismiss: mockDismissKeyboard };
    if (key === 'BackHandler') return { addEventListener: (_event: string, listener: () => boolean) => {
      mockBackListeners.add(listener); return { remove: () => mockBackListeners.delete(listener) };
    } };
    if (key === 'AppState') return appState;
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ id: mockId, tab: mockTab, messageId: mockMessageId }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../agreementClientService', () => ({ agreementProblemService: { submit: (...args: unknown[]) => mockProblemSubmit(...args), read: (...args: unknown[]) => mockProblemRead(...args) } }));
jest.mock('../groupConversationService', () => ({ groupConversationService: { context: (...args: unknown[]) => mockGroupContext(...args) } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' }, FadeIn: { duration: () => undefined } }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
// One store answers both names (ui/system/motion, 2026-09-24): mocking it covers useSystemReducedMotion and every
// component that reads useReducedMotion directly, so the whole tree sees the value this suite chose.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
// The Dogovor shows each side's photograph since pkg024a, and that module reaches supabaseClient,
// which registers an AppState listener the moment it is required — before this suite's own
// listener set exists. Every screen suite in this repo stubs the media module for that reason.
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto', NeedPhotos: 'NeedPhotos' }));
jest.mock('../../ui/AgreementChat', () => ({ AgreementChat: 'AgreementChat' }));
// Keep the real private-location/session boundary; only the native map renderer is external to this route test.
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'PrivateMap' }));
// The account has a phone number unless a test says otherwise ("Podeli svoj broj" is offered only to an account that has one).
let mockAccountPhone: string | undefined = '+381601234567';
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount, phone: mockAccountPhone }, accountRevision: mockAccountRevision }), sesijaSada: () => ({ user: { id: mockAccount, phone: mockAccountPhone }, accountRevision: mockAccountRevision }) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource }));
jest.mock('../../hooks/useAgreementOutbox', () => ({ useAgreementOutbox: () => ({ model: mockOutbox, state: mockOutboxState }) }));
jest.mock('../../hooks/useAgreementPhotos', () => ({ useAgreementPhotos: () => ({ agreementId: mockId, loaded: true, busy: false, items: [] }) }));
jest.mock('../agreementMessageHistoryService', () => ({
  compareAgreementMessageCursors: (left: any, right: any) => left.createdAt.localeCompare(right.createdAt) || left.messageId.localeCompare(right.messageId),
  agreementMessageHistoryService: {
    page: async (id: string, _options: unknown, scope: any) => ({ ok: true, podatak: {
      accountId: scope.accountId, agreementId: id, messages: await mockMessages(id, scope.accountId), olderCursor: null,
      asOf: '2026-09-27T13:00:00.123456Z' } }),
    window: async (id: string, target: string, options: unknown, scope: any) => { mockHistoryWindow(id,target,options,scope); return ({ ok: true, podatak: {
      accountId: scope.accountId, agreementId: id, targetMessageId: target,
      messages: await mockMessages(id, scope.accountId), beforeCursor: null, afterCursor: null, asOf: '2026-09-27T13:00:00.123457Z' } }); },
    markDisplayed: (...args: unknown[]) => mockDisplayed(...args),
  },
}));
// Since 2026-09-23 a finished Dogovor asks the own-review read whether "Oceni saradnju" is still due. The real module
// reaches supabaseClient, which registers an AppState listener before this suite's listener set exists; the default
// answer below ("still due") keeps every existing expectation about a finished Dogovor unchanged.
const mockReviewContext = jest.fn();
jest.mock('../reviewsClientService', () => ({ reviewsClientService: { context: (...args: unknown[]) => mockReviewContext(...args) } }));
// When and by whom a cancelled Dogovor was cancelled (CANCEL-INFO): the real module reaches supabaseClient, like the review read above. Default: the server says nothing.
const mockCancellationRead = jest.fn();
jest.mock('../agreementCancellationClientService', () => ({
  agreementCancellationService: { read: (...args: unknown[]) => mockCancellationRead(...args) },
  cancellationOf: (all: Map<string, unknown> | null | undefined, id: string) => all?.get(id.toLowerCase()) ?? null,
}));
import Dogovor from '../../app/dogovor/[id]';
import { poruka } from '../../ui/system/Poruka';

const workspace = { id: '20000000-0000-4000-8000-000000000001', naslov: 'Pomoć pri selidbi', stanje: 'CONFIRMED',
  verzija: 1, cena: { prikaz: '3.000 RSD' }, pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0 },
  ucesnici: [{ id: '10000000-0000-4000-8000-000000000001', ime: 'Ana', inicijali: 'AN', uloga: 'narucilac', mesta: null, viSte: true },
    { id: '10000000-0000-4000-8000-000000000002', ime: 'Marko', inicijali: 'MA', uloga: 'uskocer', mesta: 1, viSte: false }],
  hronologija: [], kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: false },
  chatDostupan: true, vremeTekst: 'Fleksibilno', putanjaTekst: 'Beograd', problemOtvoren: false, rokPotvrdeIso: null,
  radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true, izmenaNaCekanju: false } };
const ownMessage = { id: '30000000-0000-4000-8000-000000000001', clientMessageId: 'poruka_retry_123',
  dogovorVerzija: 2, posiljalacAccountId: '10000000-0000-4000-8000-000000000001', telo: 'Stižem.', moja: true,
  createdAt: '2026-09-27T10:00:00.123456Z', kind: 'TEXT' };
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
async function render() { await act(async () => { tree = create(<Dogovor />); }); }
async function hardwareBack() {
  await act(async () => {
    // The navigator receives Back only when the focused screen did not consume it.
    const handled = [...mockBackListeners].reverse().some(listener => listener());
    if (!handled) mockRouter.back();
  });
}
async function completionConfirmation(worker = false) {
  await act(async () => button(worker ? 'Zadatak je gotov' : 'Potvrdi završetak').props.onPress());
  return button(worker ? 'Da, zadatak je gotov' : 'Da, potvrdi završetak').props.onPress as () => void;
}
async function confirmCompletion(worker = false) {
  const confirm = await completionConfirmation(worker);
  await act(async () => confirm());
}
beforeEach(() => {
  jest.clearAllMocks(); mockRead.mockReset(); mockMessages.mockReset();
  mockAccount = ownMessage.posiljalacAccountId; mockId = workspace.id; mockTab = undefined; mockMessageId = undefined;
  mockAccountRevision = 0;
  mockFocused = true;
  mockBackListeners.clear(); mockKeyboardVisible = false;
  mockPlatform = 'android';
  mockWindow = { width: 390, height: 844, fontScale: 1, scale: 3 };
  mockRouter.canGoBack.mockReturnValue(true);
  mockRead.mockResolvedValue(workspace); mockMessages.mockResolvedValue([ownMessage]);
  mockProblemSubmit.mockReset().mockResolvedValue({ ok: false, kod: 'NOT_CONFIGURED', poruka: 'unconfirmed' });
  mockProblemRead.mockReset();
  mockDisplayed.mockReset().mockResolvedValue({ ok: true, podatak: {} });
  mockGroupContext.mockReset().mockResolvedValue({ ok: true, podatak: { group: null } });
  mockReviewContext.mockReset().mockResolvedValue({ ok: true, podatak: { eligible: true, review: null } });
  mockCancellationRead.mockReset().mockResolvedValue({ ok: true, podatak: new Map() });
  mockAccountPhone = '+381601234567';
  mockOutboxState = { phase: 'loading', entries: [] };
  for (const name of ['oznaciZavrsetak', 'potvrdiZavrsetak', 'prijaviProblem', 'podeliTelefon', 'opoziviTelefon'] as const) {
    mockSource[name].mockReset().mockResolvedValue({ ok: true, podatak: null });
  }
});
// The outcome bar belongs to a store that outlives a screen: a test that shares the number must not leave its timer behind.
afterEach(async () => { await act(async () => tree?.unmount()); poruka.hide(); jest.useRealTimers(); });
describe('D03 actual route and scoped resource integration', () => {
  it('opens the exact notification window without acknowledging loaded rows or replacing the outbox owner',async()=>{
    mockTab='poruke';mockMessageId=ownMessage.id;
    const pending={phase:'ready',entries:[{state:'unknown',command:{clientMessageId:'kept-command'}}]};
    mockOutboxState=pending;
    await render();
    const chat=()=>tree.root.findByType('AgreementChat' as any).props;
    expect(mockHistoryWindow).toHaveBeenCalledWith(workspace.id,ownMessage.id,
      expect.objectContaining({beforeCount:24,afterCount:25}),{accountId:mockAccount,accountRevision:0});
    expect(chat().readingPosition.current).toEqual({following:false,offset:0,anchor:{messageId:ownMessage.id,within:0}});
    expect(chat().state).toBe(pending);expect(chat().outbox).toBe(mockOutbox);expect(mockDisplayed).not.toHaveBeenCalled();
    const reads=mockRead.mock.calls.length,originalPosition=chat().readingPosition;
    const display=chat().onDisplayedMessageIds;
    const next='30000000-0000-4000-8000-000000000002';
    mockMessageId=next;mockMessages.mockResolvedValue([{...ownMessage,id:next}]);
    await act(async()=>tree.update(<Dogovor/>));
    expect(mockHistoryWindow).toHaveBeenLastCalledWith(workspace.id,next,
      expect.objectContaining({beforeCount:24,afterCount:25}),{accountId:mockAccount,accountRevision:0});
    expect(chat().readingPosition).not.toBe(originalPosition);
    expect(chat().readingPosition.current.anchor.messageId).toBe(next);
    expect(chat().state).toBe(pending);expect(chat().outbox).toBe(mockOutbox);expect(mockRead).toHaveBeenCalledTimes(reads);
    await act(async()=>display([ownMessage.id]));expect(mockDisplayed).not.toHaveBeenCalled();
    await hardwareBack();await act(async()=>tree.update(<Dogovor/>));
    expect(tree.root.findAllByType('AgreementChat' as any)).toHaveLength(0);
  });
  it('keeps a failed exact window distinct from latest messages and permits an explicit latest recovery',async()=>{
    mockTab='poruke';mockMessageId=ownMessage.id;mockMessages.mockRejectedValue(new Error('CHAT_MESSAGE_NOT_AVAILABLE'));
    await render();const chat=()=>tree.root.findByType('AgreementChat' as any).props;
    expect(chat().error).toBe(true);expect(chat().messages).toEqual([]);expect(mockHistoryWindow).toHaveBeenCalledTimes(1);
    expect(mockDisplayed).not.toHaveBeenCalled();
    mockMessages.mockResolvedValue([ownMessage]);
    await act(async()=>chat().onShowLatest());
    expect(chat().error).toBe(false);expect(chat().messages[0].id).toBe(ownMessage.id);
    expect(mockHistoryWindow).toHaveBeenCalledTimes(1);
  });
  it.each(['not-an-id',['30000000-0000-4000-8000-000000000001']])('rejects malformed exact-message route intent %s',async target=>{
    mockTab='poruke';mockMessageId=target;await render();
    expect(tree.root.findAllByType('AgreementChat' as any)).toHaveLength(0);
    expect(mockRead).not.toHaveBeenCalled();expect(mockMessages).not.toHaveBeenCalled();
  });
  it('opens a changed message-tab route intent without replacing the retained conversation owners or overriding later Back', async () => {
    await render(); await act(async () => button('Poruke').props.onPress());
    const chat = () => tree.root.findByType('AgreementChat' as any).props;
    const position = chat().readingPosition;
    position.current = { following: false, offset: 85, anchor: { messageId: ownMessage.id, within: 5 } };
    const pending = { phase: 'ready', entries: [{ status: 'unknown', command: { clientMessageId: 'pending-message' } }] };
    mockOutboxState = pending;
    await hardwareBack();
    expect(tree.root.findAllByType('AgreementChat' as any)).toHaveLength(0);
    const workspaceReads = mockRead.mock.calls.length, historyReads = mockMessages.mock.calls.length;
    mockTab = 'poruke'; await act(async () => tree.update(<Dogovor />));
    expect(chat().readingPosition).toBe(position);
    expect(chat().readingPosition.current.anchor.messageId).toBe(ownMessage.id);
    expect(chat().state).toBe(pending);
    expect(mockRead).toHaveBeenCalledTimes(workspaceReads);
    expect(mockMessages).toHaveBeenCalledTimes(historyReads);
    expect(mockDisplayed).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();

    // The parameter is an arriving request, not a permanent tab lock. Renders,
    // background recovery and returning to this route must respect the user's Back.
    await hardwareBack(); await act(async () => tree.update(<Dogovor />));
    mockFocused = false; await act(async () => tree.update(<Dogovor />));
    mockFocused = true; await act(async () => tree.update(<Dogovor />));
    await act(async () => mockAppListeners.forEach(listener => listener('background')));
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    expect(tree.root.findAllByType('AgreementChat' as any)).toHaveLength(0);
    expect(mockDisplayed).not.toHaveBeenCalled();
  });

  it('acknowledges only measured incoming canonical IDs, never a loaded page or a legacy Agreement sweep', async () => {
    const incoming = { ...ownMessage, id: '30000000-0000-4000-8000-000000000002', moja: false,
      posiljalacAccountId: workspace.ucesnici[1].id };
    const omitted = { ...incoming, id: '30000000-0000-4000-8000-000000000003' };
    mockMessages.mockResolvedValue([ownMessage, incoming, omitted]);
    await render(); await act(async () => button('Poruke').props.onPress());
    expect(mockDisplayed).not.toHaveBeenCalled();
    const display = tree.root.findByType('AgreementChat' as any).props.onDisplayedMessageIds;
    await act(async () => display([ownMessage.id, incoming.id, incoming.id, 'foreign-id']));
    expect(mockDisplayed).toHaveBeenCalledTimes(1);
    expect(mockDisplayed).toHaveBeenCalledWith(workspace.id, [incoming.id], { accountId: mockAccount, accountRevision: 0 });
    await act(async () => display([incoming.id]));
    expect(mockDisplayed).toHaveBeenCalledTimes(1);
    expect(mockSource.oznaciPorukeProcitanim).not.toHaveBeenCalled();
  });
  it.each(['tab visit', 'blur/focus', 'background', 'account ABA', 'row snapshot'] as const)(
    'rejects retained display callbacks after %s', async change => {
      const incoming = { ...ownMessage, moja: false, posiljalacAccountId: workspace.ucesnici[1].id };
      mockMessages.mockResolvedValue([incoming]); await render(); await act(async () => button('Poruke').props.onPress());
      const chat = () => tree.root.findByType('AgreementChat' as any).props;
      const display = chat().onDisplayedMessageIds;
      if (change === 'tab visit') {
        await hardwareBack(); await act(async () => button('Poruke').props.onPress());
      } else if (change === 'blur/focus') {
        mockFocused = false; await act(async () => tree.update(<Dogovor />));
        mockFocused = true; await act(async () => tree.update(<Dogovor />));
      } else if (change === 'background') {
        await act(async () => mockAppListeners.forEach(listener => listener('background')));
        await act(async () => mockAppListeners.forEach(listener => listener('active')));
      } else if (change === 'account ABA') mockAccountRevision += 2;
      else { mockMessages.mockResolvedValue([{ ...incoming }]); await act(async () => chat().refresh()); }
      await act(async () => display([incoming.id]));
      expect(mockDisplayed).not.toHaveBeenCalled();
      expect(mockSource.oznaciPorukeProcitanim).not.toHaveBeenCalled();
    });
  it.each([true, false])('hardware Back leaves chat for the same overview (writable=%s), then lets the navigator leave', async writable => {
    mockRead.mockResolvedValue({ ...workspace, chatDostupan: writable, stanje: writable ? 'CONFIRMED' : 'COMPLETED' });
    await render(); await act(async () => button('Poruke').props.onPress());
    const chat = tree.root.findByType('AgreementChat' as React.ElementType).props;
    expect(chat.writable).toBe(writable);
    await hardwareBack();
    expect(tree.root.findAllByType('AgreementChat' as React.ElementType)).toHaveLength(0);
    expect(button('Poruke')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockBackListeners.size).toBe(0);
    await hardwareBack();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
  it('hardware Back dismisses a visible keyboard before leaving chat and keeps its pending outbox', async () => {
    await render(); await act(async () => button('Poruke').props.onPress());
    const pending = { phase: 'ready', entries: [{ status: 'unknown', command: { clientMessageId: 'pending-message' } }] };
    mockOutboxState = pending;
    await act(async () => tree.update(<Dogovor />));
    mockKeyboardVisible = true;
    await hardwareBack();
    expect(mockDismissKeyboard).toHaveBeenCalledTimes(1);
    expect(tree.root.findByType('AgreementChat' as React.ElementType).props.state).toBe(pending);
    expect(mockRouter.back).not.toHaveBeenCalled();
    await hardwareBack();
    expect(tree.root.findAllByType('AgreementChat' as React.ElementType)).toHaveLength(0);
    await act(async () => button('Poruke').props.onPress());
    expect(tree.root.findByType('AgreementChat' as React.ElementType).props.state).toBe(pending);
    expect(mockSource.oznaciZavrsetak).not.toHaveBeenCalled();
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
  });
  it('retires a hardware Back callback on blur, account ABA and unmount', async () => {
    await render(); await act(async () => button('Poruke').props.onPress());
    const old = [...mockBackListeners][0]; expect(old).toBeDefined();
    mockFocused = false; await act(async () => tree.update(<Dogovor />));
    expect(mockBackListeners.size).toBe(0); expect(old()).toBe(false);
    mockFocused = true; await act(async () => tree.update(<Dogovor />));
    expect(old()).toBe(false);
    const current = [...mockBackListeners][0]; expect(current).toBeDefined();
    mockAccountRevision += 2; // A → B → A before React has rendered the changed incarnation.
    expect(current()).toBe(false);
    expect(tree.root.findByType('AgreementChat' as React.ElementType)).toBeTruthy();
    await act(async () => tree.unmount());
    expect(mockBackListeners.size).toBe(0); expect(current()).toBe(false);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
  it.each(['narucilac', 'uskocer'])('names the work first, then where the Dogovor stands and its terms; the linked task is one row of the links for %s', async role => {
    const taskId = '40000000-0000-4000-8000-000000000001';
    mockRead.mockResolvedValue({ ...workspace, izvor: { zadatakId: taskId, prijavaId: null },
      ucesnici: workspace.ucesnici.map(party => ({ ...party, uloga: party.viSte ? role : role === 'narucilac' ? 'uskocer' : 'narucilac' })) });
    await render();
    const open = button(`Otvori zadatak: ${workspace.naslov}. ${workspace.putanjaTekst}`);
    const taskCopy = open.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
    // The row only leads to the task: its words are "Otvori zadatak" (the work's name and place are on the page already, and in the row's spoken label).
    expect(taskCopy).toBe('Otvori zadatak');
    // The head is the work's own name (a header), then the state (a header), then the four steps of its way, then the accepted terms.
    const order = tree.root.findAll(node => String(node.type) === 'T')
      .map(node => ({ text: node.children.filter(child => typeof child === 'string').join(''), header: node.props.accessibilityRole === 'header' }));
    const at = (match: (word: { text: string; header: boolean }) => boolean) => order.findIndex(match);
    const title = at(word => word.text === workspace.naslov && word.header), step = at(word => word.text === 'Dogovoreno' && word.header);
    const bar = at(word => word.text === 'Dogovoreno' && !word.header), terms = at(word => word.text === 'Uslovi' && word.header);
    expect(title).toBeGreaterThanOrEqual(0); expect(title).toBeLessThan(step);
    expect(step).toBeLessThan(bar); expect(bar).toBeLessThan(terms);
    expect(tree.root.findByProps({ accessibilityLabel: 'Dogovoreno ukupno: 3.000 RSD' })).toBeTruthy();
    await act(async () => open.props.onPress());
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: role === 'narucilac' ? '/potrebe/[id]/pregled' : '/prilike/[id]', params: { id: taskId } });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Zadatak' })).toHaveLength(0);
    // The retained callback is still guarded when a different account owns the screen.
    const retained = open.props.onPress;
    mockRouter.push.mockClear(); mockAccountRevision++;
    await act(async () => retained());
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
  it('keeps accepted terms readable without a fake task destination when the source is absent', async () => {
    await render();
    expect(texts()).toContain(workspace.naslov);
    expect(texts()).toContain('3.000 RSD');
    expect(tree.root.findAllByProps({ accessibilityLabel: `Otvori zadatak: ${workspace.naslov}` })).toHaveLength(0);
  });
  it('bounds a stalled B3 history read, admits explicit retry, and ignores the late retired answer', async () => {
    jest.useFakeTimers();
    let late!: (rows: unknown[]) => void;
    const stalled = new Promise<unknown[]>(resolve => { late = resolve; });
    mockMessages.mockReturnValueOnce(stalled);
    await render(); await act(async () => button('Poruke').props.onPress());
    const chat = () => tree.root.findByType('AgreementChat' as any).props;
    expect(chat()).toMatchObject({ loading: true, error: false, messages: [] });
    await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });
    expect(chat()).toMatchObject({ loading: false, error: true, messages: [] });
    const fresh = { ...ownMessage, telo: 'Sveža poruka posle ponovnog čitanja.' };
    mockMessages.mockResolvedValueOnce([fresh]);
    await act(async () => { await chat().refresh(); });
    expect(chat()).toMatchObject({ loading: false, error: false, messages: [fresh], refreshing: false });
    await act(async () => { late([{ ...ownMessage, telo: 'Zakasnela poruka.' }]); });
    expect(chat().messages).toEqual([fresh]); expect(mockMessages).toHaveBeenCalledTimes(2);
  });

  it('retains messages, outbox and photo controller during refresh, failure and a coalesced send refresh', async () => {
    await render(); await act(async () => button('Poruke').props.onPress());
    const chat = () => tree.root.findByType('AgreementChat' as any).props;
    let rejectRefresh!: (error: Error) => void;
    let resolveTrailing!: (rows: unknown[]) => void;
    mockMessages.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRefresh = reject; }));
    let first!: Promise<void>;
    await act(async () => { first = chat().refresh(); });
    expect(chat()).toMatchObject({ messages: [ownMessage], refreshing: true, loading: false, error: false });
    expect(chat().outbox).toBe(mockOutbox); expect(chat().state).toBe(mockOutboxState);
    expect(chat().photos).toMatchObject({ agreementId: mockId, loaded: true });
    await act(async () => { rejectRefresh(new Error('offline')); await first; });
    expect(chat()).toMatchObject({ messages: [ownMessage], refreshing: false, loading: false, error: false, refreshError: true });
    let resolveRefresh!: (rows: unknown[]) => void;
    mockMessages.mockImplementationOnce(() => new Promise(resolve => { resolveRefresh = resolve; }))
      .mockResolvedValueOnce([ownMessage]) // bounded newest probe alongside the anchor window
      .mockImplementationOnce(() => new Promise(resolve => { resolveTrailing = resolve; }));
    let shared!: Promise<void>;
    await act(async () => { shared = chat().refresh(); void chat().refresh(); void chat().refresh(); });
    expect(mockMessages).toHaveBeenCalledTimes(5);
    await act(async () => { resolveRefresh([ownMessage]); });
    expect(mockMessages).toHaveBeenCalledTimes(7); expect(chat().refreshing).toBe(true);
    const second = { ...ownMessage, id: '30000000-0000-4000-8000-000000000002', clientMessageId: 'another_message', telo: 'Kod ulaza sam.' };
    await act(async () => { resolveTrailing([ownMessage, second]); await shared; });
    expect(chat()).toMatchObject({ messages: [ownMessage, second], refreshing: false, loading: false, error: false });
    expect(chat().refreshError).toBeFalsy(); expect(chat().outbox).toBe(mockOutbox);
    expect(mockOutbox.reconcile).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ clientMessageId: second.clientMessageId, messageId: second.id })]));
  });

  it('opens the server-admitted group for this owned Agreement with its unread count', async () => {
    // A group joins the Dogovori of one Zadatak that needs more than one person; requiredSlots is that Zadatak's size.
    mockRead.mockResolvedValue({ ...workspace, pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1 } });
    mockGroupContext.mockResolvedValue({ ok: true, podatak: { accountId: mockAccount, agreementId: workspace.id, needId: workspace.id,
      available: true, authoritative: true, group: { groupId: '30000000-0000-4000-8000-000000000001', title: workspace.naslov,
        canSend: true, terminal: false, role: 'PARTICIPANT', members: [], management: null, managementNextId: null, unreadCount: 2 } } });
    await render();
    expect(mockGroupContext).toHaveBeenCalledWith(workspace.id, { accountId: mockAccount, accountRevision: 0 });
    await act(async () => button('Grupni razgovor · 2 nepročitana').props.onPress());
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/dogovor/[id]/grupa', params: { id: workspace.id } });
  });
  it('says nothing about a group on a Dogovor for a Zadatak of one person, where a group can never exist', async () => {
    mockGroupContext.mockResolvedValue({ ok: true, podatak: { available: false, group: null } });
    await render();
    expect(mockGroupContext).not.toHaveBeenCalled();
    expect(texts()).not.toContain('Grupni razgovor');
  });
  it.each(['android', 'ios'])('owns keyboard avoidance at the full-screen boundary on %s without changing workspace/outbox authority', async platform => {
    mockPlatform = platform;
    await render();
    const avoidance = tree.root.findByType('KeyboardAvoidingView' as any);
    expect(avoidance.parent?.type).toBe('SafeAreaView');
    expect(avoidance.props.enabled).toBe(false);
    expect(avoidance.props.behavior).toBe(platform === 'ios' ? 'padding' : 'height');
    expect(avoidance.props.keyboardVerticalOffset).toBeUndefined();
    expect(avoidance.findByProps({ accessibilityLabel: 'Nazad' })).toBeTruthy();
    await act(async () => button('Poruke').props.onPress());
    expect(tree.root.findAllByType('KeyboardAvoidingView' as any)).toHaveLength(1);
    expect(avoidance.props.enabled).toBe(true);
    const chat = avoidance.findByType('AgreementChat' as any);
    expect(chat.props.outbox).toBe(mockOutbox);
    expect(chat.props.state).toBe(mockOutboxState);
    expect(chat.props.writable).toBe(true);
    expect(chat.props.messages).toEqual([ownMessage]);
    await act(async () => button('Dogovor: Pomoć pri selidbi. Marko').props.onPress());
    expect(avoidance.props.enabled).toBe(false);
    expect(texts()).toContain(workspace.naslov);
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(mockMessages).toHaveBeenCalledTimes(1);
  });
  it('opens the same accepted overview from the compact thread without replacing its owned outbox or rereading', async () => {
    mockWindow = { width: 320, height: 718, fontScale: 2, scale: 3 };
    await render();
    await act(async () => button('Poruke').props.onPress());
    const chat = tree.root.findByType('AgreementChat' as any);
    expect(chat.props.compact).toBe(true);
    expect(chat.props.outbox).toBe(mockOutbox);
    expect(chat.props.state).toBe(mockOutboxState);
    await act(async () => button(`Uslovi Dogovora: ${workspace.naslov}`).props.onPress());
    expect(texts()).toContain('3.000 RSD');
    expect(texts()).toContain('Fleksibilno');
    await act(async () => button('Poruke').props.onPress());
    expect(tree.root.findByType('AgreementChat' as any).props.outbox).toBe(mockOutbox);
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(mockMessages).toHaveBeenCalledTimes(1);
  });
  it('reconciles a server read again after outbox hydration becomes ready', async () => {
    await render(); expect(mockMessages).toHaveBeenCalledWith(workspace.id, mockAccount);
    mockOutbox.reconcile.mockClear(); mockOutboxState = { phase: 'ready', entries: [] };
    await act(async () => tree.update(<Dogovor />));
    expect(mockOutbox.reconcile).toHaveBeenCalledWith([{ senderAccountId: mockAccount,
      clientMessageId: ownMessage.clientMessageId, messageId: ownMessage.id, body: ownMessage.telo }]);
  });
  it('invalid/array route cannot read private data and retains a safe Back destination', async () => {
    mockId = [workspace.id]; mockRouter.canGoBack.mockReturnValue(false);
    await render(); expect(mockRead).not.toHaveBeenCalled(); expect(mockMessages).not.toHaveBeenCalled();
    await act(async () => button('Nazad').props.onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith('/dogovori');
  });
  it('loading and read failure both retain Back; retry recovers the actual workspace', async () => {
    let rejectRead!: (error: Error) => void;
    mockRead.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRead = reject; }));
    await render(); expect(button('Nazad')).toBeTruthy();
    await act(async () => rejectRead(new Error('offline')));
    expect(texts()).toContain('Dogovor nije učitan'); expect(texts()).not.toContain('Dogovor nije dostupan');
    await act(async () => button('Ponovo učitaj Dogovor').props.onPress());
    expect(texts()).toContain(workspace.naslov);
  });
  it('late account A message read cannot reconcile into the new account B screen', async () => {
    let resolveA!: (data: unknown) => void;
    mockMessages.mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; })).mockResolvedValue([]);
    await render(); mockOutbox.reconcile.mockClear();
    mockAccount = '10000000-0000-4000-8000-000000000002';
    await act(async () => tree.update(<Dogovor />));
    mockOutbox.reconcile.mockClear();
    await act(async () => resolveA([ownMessage]));
    expect(mockOutbox.reconcile).not.toHaveBeenCalled();
  });
  it('a server read-only refusal rechecks the workspace instead of keeping a stale composer active', async () => {
    mockOutboxState = { phase: 'ready', entries: [] }; await render();
    mockRead.mockResolvedValue({ ...workspace, chatDostupan: false });
    mockOutboxState = { phase: 'ready', entries: [{ command: { clientMessageId: 'poruka_retry_123' }, error: 'READ_ONLY', attempt: 1 }] };
    await act(async () => tree.update(<Dogovor />));
    await act(async () => button('Poruke').props.onPress());
    const chat = tree.root.findByType('AgreementChat' as any);
    expect(chat.props.terminal).toBe(true); expect(chat.props.writable).toBe(false);
    expect(mockRead).toHaveBeenCalledTimes(2);
  });
  it('batched A→B→A cannot revive an old message read even before React renders the changed session', async () => {
    let resolveA!: (data: unknown) => void;
    mockMessages.mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; }));
    await render(); mockOutbox.reconcile.mockClear();
    mockAccountRevision += 2; // Auth store observed both transitions; visible ID is A again.
    await act(async () => resolveA([ownMessage]));
    expect(mockOutbox.reconcile).not.toHaveBeenCalled();
  });
  it('uses the actual Agreement party role for completion even with the opposite selected intent', async () => {
    mockRead.mockResolvedValue({ ...workspace, radnje: { mozeOznacitiZavrsetak: true, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false },
      ucesnici: workspace.ucesnici.map(party => ({ ...party, uloga: party.viSte ? 'uskocer' : 'narucilac' })) });
    await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Potvrdi završetak' })).toHaveLength(0);
    await confirmCompletion(true);
    expect(mockSource.oznaciZavrsetak).toHaveBeenCalledWith(workspace.id);
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    expect(mockRead).toHaveBeenCalledTimes(2);
  });
  it('serializes double completion and blocks cross-action writes until authoritative readback', async () => {
    let resolve!: (result: unknown) => void;
    mockSource.potvrdiZavrsetak.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await render();
    // (The number and the place are one open section now: nothing to open before the share command is there.)
    const complete = await completionConfirmation();
    const share = button('Podeli svoj broj').props.onPress;
    await act(async () => { complete(); complete(); share(); });
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
    expect(mockSource.podeliTelefon).not.toHaveBeenCalled();
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(button('Potvrdi završetak').props.accessibilityState.busy).toBe(true);
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED' });
    await act(async () => resolve({ ok: true, podatak: null }));
    expect(texts()).toContain('Dogovor je završen');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Potvrdi završetak' })).toHaveLength(0);
  });
  it('keeps completion idle while a different command is being saved', async () => {
    let resolve!: (result: unknown) => void;
    mockSource.podeliTelefon.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await render();
    await act(async () => button('Podeli svoj broj').props.onPress());
    expect(mockSource.podeliTelefon).toHaveBeenCalledTimes(1);
    expect(button('Potvrdi završetak').props.disabled).toBe(true);
    expect(button('Potvrdi završetak').props.accessibilityState.busy).not.toBe(true);
    expect(tree.root.findByProps({ testID: 'agreement-action-footer' })
      .findAll(node => String(node.type) === 'T').flatMap(node => node.children)).toContain('Čuvamo promenu…');
    await act(async () => resolve({ ok: true, podatak: null }));
    expect(button('Potvrdi završetak').props.disabled).toBe(false);
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    // The confirmed command is said once, by the outcome bar this screen hosts.
    expect(poruka.current()).toMatchObject({ text: 'Broj je podeljen. Marko ga sada vidi.', confirmed: true });
  });
  it('an unknown completion remains fenced until explicit successful reconciliation', async () => {
    mockSource.potvrdiZavrsetak.mockResolvedValueOnce({ ok: false, kod: 'TIMEOUT', poruka: 'secret upstream detail' });
    await render();
    const complete = await completionConfirmation();
    await act(async () => complete());
    expect(texts()).toContain('Ne znamo da li je promena sačuvana');
    expect(texts()).not.toContain('secret upstream detail');
    await act(async () => complete());
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
    expect(button('Potvrdi završetak').props.disabled).toBe(true);
    const readsBeforeLocalBack = mockRead.mock.calls.length;
    await act(async () => button('Poruke').props.onPress());
    await hardwareBack();
    expect(button('Potvrdi završetak').props.disabled).toBe(true);
    expect(mockRead).toHaveBeenCalledTimes(readsBeforeLocalBack);
    expect(mockRouter.back).not.toHaveBeenCalled();
    // The recovery command is in the fixed action region, not below all Agreement sections.
    const footer = tree.root.findByProps({ testID: 'agreement-action-footer' });
    expect(footer.findByProps({ accessibilityLabel: 'Osveži status Dogovora' })).toBeTruthy();
    expect(footer.findByProps({ testID: 'agreement-action-recovery' })
      .findByProps({ accessibilityRole: 'alert' }).props.children).toContain('Ne znamo da li je promena sačuvana');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Osveži status Dogovora' })).toHaveLength(1);
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED' });
    await act(async () => button('Osveži status Dogovora').props.onPress());
    expect(texts()).toContain('Dogovor je završen');
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
  });
  it('a retained action cannot submit after an A→B→A auth incarnation change', async () => {
    await render(); const complete = await completionConfirmation();
    mockAccountRevision += 2;
    await act(async () => complete());
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
  });
  it('a dismissed confirmation cannot send or dismiss a newly opened review', async () => {
    await render();
    const oldConfirm = await completionConfirmation();
    const oldBack = button('Nazad na Dogovor').props.onPress;
    await act(async () => oldBack());
    await completionConfirmation();
    await act(async () => { oldConfirm(); oldBack(); });
    expect(button('Da, potvrdi završetak')).toBeTruthy();
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
  });
  it('a review is discarded across blur/refocus even when the same Agreement returns', async () => {
    await render(); const confirm = await completionConfirmation();
    mockFocused = false; await act(async () => tree.update(<Dogovor />));
    await act(async () => confirm());
    expect(tree.root.findAllByType('Modal' as any)).toHaveLength(0);
    mockFocused = true; await act(async () => tree.update(<Dogovor />));
    await act(async () => confirm());
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('Modal' as any)).toHaveLength(0);
    expect(button('Potvrdi završetak').props.disabled).toBe(false);
  });
  it.each(['same read facts', 'new accepted version', 'revoked permission'] as const)(
    'a new read invalidates review and opener before yielding, including %s', async change => {
    await render();
    await act(async () => button('Poruke').props.onPress());
    const refresh = tree.root.findByType('AgreementChat' as any).props.refreshWorkspace;
    await act(async () => button('Dogovor: Pomoć pri selidbi. Marko').props.onPress());
    const open = button('Potvrdi završetak').props.onPress;
    const confirm = await completionConfirmation();
    let resolve!: (data: unknown) => void;
    mockRead.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    let read!: Promise<void>;
    await act(async () => { read = refresh(); confirm(); open(); });
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('Modal' as any)).toHaveLength(0);
    const next = { ...workspace,
      ...(change === 'new accepted version' ? { verzija: 2, cena: { prikaz: '4.200 RSD' }, vremeTekst: 'Novi prihvaćeni termin' } : {}),
      ...(change === 'revoked permission' ? { radnje: { ...workspace.radnje, mozePotvrditiZavrsetak: false } } : {}) };
    await act(async () => { resolve(next); await read; });
    await act(async () => { confirm(); open(); });
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('Modal' as any)).toHaveLength(0);
    if (change === 'revoked permission') expect(tree.root.findAllByProps({ accessibilityLabel: 'Potvrdi završetak' })).toHaveLength(0);
    else {
      await completionConfirmation();
      const modal = tree.root.findByType('Modal' as any);
      expect(modal.findByProps({ accessibilityLabel: `Dogovoreno ukupno: ${next.cena.prikaz}` })).toBeTruthy();
      expect(modal.findByProps({ accessibilityLabel: `Dogovoreni termin: ${next.vremeTekst}` })).toBeTruthy();
    }
  });
  it.each(['CANCELLED', 'COMPLETED'])('a %s Agreement has no completion action', async state => {
    mockRead.mockResolvedValue({ ...workspace, stanje: state }); await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Potvrdi završetak' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Zadatak je gotov' })).toHaveLength(0);
  });
  it('requires an explicit narrative for a problem and preserves its draft on failure', async () => {
    mockRead.mockResolvedValue({ ...workspace, stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-12T14:00:00Z' });
    mockProblemSubmit.mockResolvedValueOnce({ ok: false, kod: 'OFFLINE', poruka: 'provider detail' });
    await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Opiši problem' })).toHaveLength(0);
    await act(async () => button('Prijavi problem').props.onPress());
    expect(button('Pošalji prijavu problema').props.disabled).toBe(true);
    expect(tree.root.findByType('KeyboardAvoidingView' as any).props.enabled).toBe(true);
    await act(async () => button('Opiši problem').props.onChangeText('  Nisu prenete poslednje kutije.  '));
    await act(async () => button('Pošalji prijavu problema').props.onPress());
    expect(mockProblemSubmit).toHaveBeenCalledWith(workspace.id, 'Nisu prenete poslednje kutije.', { accountId: mockAccount, accountRevision: 0 });
    expect(button('Opiši problem').props.value).toBe('  Nisu prenete poslednje kutije.  ');
    expect(button('Pošalji ponovo').props.disabled).toBe(true);
    expect(texts()).not.toContain('provider detail');
  });
  it.each([
    ['narucilac', 'CONFIRMED'], ['uskocer', 'CONFIRMED'],
    ['narucilac', 'AWAITING_REQUESTER'], ['uskocer', 'AWAITING_REQUESTER'],
  ])('allows the actual %s participant to report while %s and explains the shared description', async (role, state) => {
    mockRead.mockResolvedValue({ ...workspace, stanje: state, ucesnici: workspace.ucesnici.map(party => ({ ...party,
      uloga: party.viSte ? role : role === 'narucilac' ? 'uskocer' : 'narucilac' })) });
    await render();
    act(() => button('Prijavi problem').props.onPress());
    expect(texts()).toContain('Opis će videti druga strana u Porukama. Ovo nije poverljiva prijava podršci.');
    expect(button('Opiši problem').props.value).toBe('');
    expect(mockProblemSubmit).not.toHaveBeenCalled();
  });
  it('shows only the first stored report after a bound receipt and still permits explicit requester completion', async () => {
    const openedAt = '2026-09-10T18:00:00.123456+00:00';
    const narrative = 'Nisu prenete poslednje kutije.';
    mockProblemSubmit.mockImplementationOnce(async () => {
      mockRead.mockResolvedValue({ ...workspace, problemOtvoren: true });
      return { ok: true, podatak: { agreementId: workspace.id, problemOpenedAt: '2026-09-10T18:00:00.123456Z',
        problemOpenedBy: mockAccount, idempotentReplay: false, authoritative: true, noAutomaticFaultOrDebt: true } };
    });
    mockProblemRead.mockResolvedValue({ ok: true, podatak: { agreementId: workspace.id, agreementVersion: 1, state: 'AVAILABLE',
      report: { openedAt, openedBy: mockAccount, narrative } } });
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText(narrative));
    await act(async () => button('Pošalji prijavu problema').props.onPress());
    expect(mockProblemRead).toHaveBeenCalledWith(workspace.id, 1, workspace.ucesnici.map(party => party.id),
      { accountId: mockAccount, accountRevision: 0 });
    expect(texts()).toContain('Problem je prijavljen'); expect(texts()).toContain(narrative);
    expect(texts()).toContain('Problem je prijavljen sa tvog naloga.');
    // One sentence in the note (J5): who reads it, and that a problem alone decides nobody's guilt or debt. The stopped completion is the head's.
    expect(texts()).toContain('Opis vide oba učesnika, a problem sam po sebi ne određuje krivicu ili dug.');
    expect(texts()).not.toContain('Završetak se i dalje može potvrditi.');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Prijavi problem' })).toHaveLength(0);
    expect(button('Potvrdi završetak').props.disabled).toBe(false);
  });
  it('preserves a counterparty first report instead of claiming that a racing new description was saved', async () => {
    const openedAt = '2026-09-10T18:00:00Z', openedBy = workspace.ucesnici[1].id;
    mockProblemSubmit.mockImplementationOnce(async () => {
      mockRead.mockResolvedValue({ ...workspace, problemOtvoren: true });
      return { ok: true, podatak: { agreementId: workspace.id, problemOpenedAt: openedAt, problemOpenedBy: openedBy,
        idempotentReplay: true, authoritative: true, noAutomaticFaultOrDebt: true } };
    });
    mockProblemRead.mockResolvedValue({ ok: true, podatak: { agreementId: workspace.id, agreementVersion: 1, state: 'AVAILABLE',
      report: { openedAt, openedBy, narrative: 'Opis prve prijave druge strane.' } } });
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText('Moj drugačiji opis.'));
    await act(async () => button('Pošalji prijavu problema').props.onPress());
    expect(texts()).toContain('Problem je prijavila druga strana.');
    expect(texts()).toContain('Opis prve prijave druge strane.');
    expect(texts()).toContain('Sačuvan je prvi opis, a tvoj novi nije dodat. Za dopunu koristi Poruke.');
    expect(texts()).not.toContain('Moj drugačiji opis.');
  });
  it.each(['CONFIRMED', 'AWAITING_REQUESTER'])('preserves a legacy report on %s, chat and explicit completion without enabling an overwrite', async stanje => {
    mockRead.mockResolvedValue({ ...workspace, stanje, problemOtvoren: true });
    mockProblemRead.mockResolvedValue({ ok: true, podatak: { agreementId: workspace.id, agreementVersion: 1, state: 'LEGACY_UNAVAILABLE', report: null } });
    await render();
    expect(texts()).toContain(workspace.naslov);
    expect(texts()).toContain('Detalji ranije prijavljenog problema nisu dostupni');
    expect(texts()).not.toContain('Problem je prijavljen sa tvog naloga.');
    expect(texts()).not.toContain('sačuvan je u Porukama');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Prijavi problem' })).toHaveLength(0);
    expect(button('Potvrdi završetak').props.disabled).toBe(false);
    // PKG-007: only the server's terminal COMPLETED readback confirms the explicit completion.
    mockSource.potvrdiZavrsetak.mockImplementationOnce(async () => {
      mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED', problemOtvoren: true, radnje: null });
      return { ok: true, podatak: { zavrsenoIso: '2026-09-16T10:00:00Z', ponovljeno: false } };
    });
    await confirmCompletion();
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledWith(workspace.id);
    expect(texts()).toContain('Dogovor je završen');
    await act(async () => button('Poruke').props.onPress());
    expect(tree.root.findByType('AgreementChat' as any).props.writable).toBe(true);
    expect(mockProblemSubmit).not.toHaveBeenCalled();
  });
  it.each(['failure', 'absent', 'throw'])('preserves the known Agreement when optional report detail is %s', async kind => {
    mockRead.mockResolvedValue({ ...workspace, problemOtvoren: true });
    if (kind === 'throw') mockProblemRead.mockRejectedValue(new Error('private detail'));
    else mockProblemRead.mockResolvedValue(kind === 'absent'
      ? { ok: true, podatak: { agreementId: workspace.id, agreementVersion: 1, state: 'ABSENT', report: null } }
      : { ok: false, kod: 'PROBLEM_REPORT_INVALID', poruka: 'private detail' });
    await render();
    expect(texts()).toContain(workspace.naslov);
    expect(texts()).toContain('Detalji prijave trenutno nisu učitani.');
    expect(texts()).not.toContain('private detail');
    expect(texts()).not.toContain('Detalji ranije prijavljenog problema');
    expect(button('Potvrdi završetak').props.disabled).toBe(false);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Prijavi problem' })).toHaveLength(0);
    await act(async () => button('Osveži detalje prijave').props.onPress());
    expect(mockProblemRead).toHaveBeenCalledTimes(2);
    await act(async () => button('Poruke').props.onPress());
    expect(tree.root.findByType('AgreementChat' as any).props.writable).toBe(true);
  });
  it.each(['LEGACY_UNAVAILABLE', 'UNAVAILABLE'])('cannot confirm a newly submitted report from %s details', async state => {
    mockProblemSubmit.mockImplementationOnce(async () => {
      mockRead.mockResolvedValue({ ...workspace, problemOtvoren: true });
      return { ok: true, podatak: { agreementId: workspace.id, problemOpenedAt: '2026-09-10T18:00:00Z',
        problemOpenedBy: mockAccount, idempotentReplay: false, authoritative: true, noAutomaticFaultOrDebt: true } };
    });
    mockProblemRead.mockResolvedValue(state === 'LEGACY_UNAVAILABLE'
      ? { ok: true, podatak: { agreementId: workspace.id, agreementVersion: 1, state, report: null } }
      : { ok: false, kod: 'PROBLEM_REPORT_READ_FAILED', poruka: 'unconfirmed' });
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText('Opis mora biti potvrđen.'));
    await act(async () => button('Pošalji prijavu problema').props.onPress());
    expect(texts()).toContain('Ne znamo da li je problem prijavljen. Osveži Dogovor.');
    expect(texts()).not.toContain('Problem je prijavljen');
    expect(button('Pošalji ponovo').props.disabled).toBe(true);
    await act(async () => button('Osveži status Dogovora').props.onPress());
    expect(texts()).toContain('Problem je prijavljen');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pošalji ponovo' })).toHaveLength(0);
    expect(button('Potvrdi završetak').props.disabled).toBe(false);
    expect(mockProblemSubmit).toHaveBeenCalledTimes(1);
  });
  it('serializes duplicate and cross-action taps; after unknown readback retries only the original description', async () => {
    let resolve!: (value: unknown) => void;
    mockProblemSubmit.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText('  Prvi opis.  '));
    const retainedInput = button('Opiši problem').props.onChangeText;
    const submit = button('Pošalji prijavu problema').props.onPress;
    const complete = button('Potvrdi završetak').props.onPress;
    act(() => { submit(); submit(); complete(); });
    expect(mockProblemSubmit).toHaveBeenCalledTimes(1);
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    await act(async () => resolve({ ok: false, kod: 'TIMEOUT', poruka: 'private provider detail' }));
    act(() => submit());
    expect(mockProblemSubmit).toHaveBeenCalledTimes(1);
    expect(button('Opiši problem').props.editable).toBe(false);
    expect(button('Pošalji ponovo').props.disabled).toBe(true);
    await act(async () => button('Osveži status Dogovora').props.onPress());
    act(() => { submit(); retainedInput('Promenjen opis.'); });
    expect(mockProblemSubmit).toHaveBeenCalledTimes(1);
    expect(button('Opiši problem').props.value).toBe('  Prvi opis.  ');
    expect(button('Pošalji ponovo').props.disabled).toBe(false);
    await act(async () => button('Pošalji ponovo').props.onPress());
    expect(mockProblemSubmit).toHaveBeenCalledTimes(2);
    expect(mockProblemSubmit.mock.calls.map(args => args[1])).toEqual(['Prvi opis.', 'Prvi opis.']);
  });
  it('does not confirm a receipt when authoritative readback lacks the report, preserving the draft', async () => {
    mockProblemSubmit.mockResolvedValue({ ok: true, podatak: { agreementId: workspace.id,
      problemOpenedAt: '2026-09-10T18:00:00Z', problemOpenedBy: mockAccount, idempotentReplay: false,
      authoritative: true, noAutomaticFaultOrDebt: true } });
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText('Sačuvati opis.'));
    await act(async () => button('Pošalji prijavu problema').props.onPress());
    expect(texts()).not.toContain('Problem je prijavljen');
    expect(texts()).toContain('Ne znamo da li je problem prijavljen. Osveži Dogovor.');
    expect(button('Opiši problem').props.value).toBe('Sačuvati opis.');
    expect(button('Pošalji ponovo').props.disabled).toBe(true);
  });
  it('clears the displayed workspace on blur and cannot revive a late report or retained write on refocus', async () => {
    let resolve!: (value: unknown) => void;
    mockProblemSubmit.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText('Opis pre izlaska.'));
    const submit = button('Pošalji prijavu problema').props.onPress;
    act(() => submit());
    mockFocused = false; await act(async () => tree.update(<Dogovor />));
    await act(async () => resolve({ ok: false, kod: 'OFFLINE', poruka: 'late private detail' }));
    expect(texts()).not.toContain(workspace.naslov);
    expect(texts()).not.toContain('late private detail');
    mockFocused = true; await act(async () => tree.update(<Dogovor />));
    act(() => submit());
    expect(mockProblemSubmit).toHaveBeenCalledTimes(1);
    expect(button('Opiši problem').props.value).toBe('Opis pre izlaska.');
    expect(button('Pošalji ponovo').props.disabled).toBe(false);
  });
  it('an account incarnation change drops the old report result and does not issue its private readback', async () => {
    let resolve!: (value: unknown) => void;
    mockProblemSubmit.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText('Privatni opis naloga A.'));
    act(() => button('Pošalji prijavu problema').props.onPress());
    mockAccountRevision += 2;
    await act(async () => tree.update(<Dogovor />));
    const readsBeforeLateReceipt = mockRead.mock.calls.length;
    await act(async () => resolve({ ok: true, podatak: { agreementId: workspace.id,
      problemOpenedAt: '2026-09-10T18:00:00Z', problemOpenedBy: mockAccount, idempotentReplay: false,
      authoritative: true, noAutomaticFaultOrDebt: true } }));
    expect(mockRead).toHaveBeenCalledTimes(readsBeforeLateReceipt);
    expect(mockProblemRead).not.toHaveBeenCalled();
    expect(texts()).not.toContain('Privatni opis naloga A.');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Opiši problem' })).toHaveLength(0);
  });
  it.each(['CANCELLED', 'COMPLETED'])('shows a saved first report on %s without offering a new report', async state => {
    mockRead.mockResolvedValue({ ...workspace, stanje: state, problemOtvoren: true });
    mockProblemRead.mockResolvedValue({ ok: true, podatak: { agreementId: workspace.id, agreementVersion: 1, state: 'AVAILABLE',
      report: { openedAt: '2026-09-10T18:00:00Z', openedBy: mockAccount, narrative: 'Sačuvani opis.' } } });
    await render(); expect(texts()).toContain('Sačuvani opis.');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Prijavi problem' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pošalji prijavu problema' })).toHaveLength(0);
  });
  it('Remote never mounts the private physical location surface', async () => {
    mockRead.mockResolvedValue({ ...workspace, rezim: 'DALJINSKI', kontakt: { ...workspace.kontakt, lokacijaPostoji: true } });
    await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Lokacija i pristup' })).toHaveLength(0);
    expect(texts()).toContain('Na daljinu');
    expect(texts()).not.toContain(workspace.putanjaTekst);
  });
  it('hides private workspace on background and fences retained actions until foreground readback', async () => {
    mockRead.mockResolvedValueOnce({ ...workspace, kontakt: { ...workspace.kontakt, njihovTelefon: '+38160111222' } });
    await render();
    expect(texts()).toContain('+38160111222');
    const complete = await completionConfirmation();
    await act(async () => { mockAppListeners.forEach(listener => listener('background')); complete(); });
    expect(texts()).not.toContain('+38160111222');
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    let resolve!: (data: unknown) => void;
    mockRead.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await act(async () => { mockAppListeners.forEach(listener => listener('active')); complete(); });
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    expect(texts()).not.toContain('+38160111222');
    await act(async () => resolve({ ...workspace, stanje: 'CANCELLED' }));
    expect(texts()).toContain('Dogovor je otkazan');
    await act(async () => complete());
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
  });
  it('resumes only after an in-flight completion settles and rereads the changed workspace', async () => {
    let finish!: (result: unknown) => void;
    mockSource.potvrdiZavrsetak.mockImplementationOnce(() => new Promise(done => { finish = done; }));
    await render();
    await confirmCompletion();
    await act(async () => mockAppListeners.forEach(listener => listener('background')));
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    // Back in the foreground the page keeps its last content, quietly, and nothing on it can be pressed until the fresh read.
    expect(texts()).toContain(workspace.naslov); expect(texts()).toContain('Osvežavamo…');
    expect(button('Potvrdi završetak').props.disabled).toBe(true);
    expect(mockRead).toHaveBeenCalledTimes(1);
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED' });
    await act(async () => finish({ ok: true, podatak: null }));
    expect(texts()).toContain('Dogovor je završen');
    expect(texts()).not.toContain('Osvežavamo…');
    expect(mockRead).toHaveBeenCalledTimes(3); // successful command readback, then resume snapshot
  });
  // Plan 2.6: coming back from the background used to turn the whole screen into a skeleton.
  it('back from the background the overview keeps its last content with a quiet "Osvežavamo…" line; nothing private, nothing pressable', async () => {
    mockRead.mockResolvedValueOnce({ ...workspace, kontakt: { ...workspace.kontakt, njihovTelefon: '+38160111222' } });
    await render();
    expect(texts()).toContain('+38160111222'); expect(texts()).not.toContain('Osvežavamo…');
    await act(async () => mockAppListeners.forEach(listener => listener('background')));
    // In the background itself nothing is drawn, as before.
    expect(texts()).not.toContain(workspace.naslov); expect(texts()).not.toContain('+38160111222'); expect(texts()).toContain('Učitavamo Dogovor');
    let resolve!: (data: unknown) => void;
    mockRead.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    // The read is on its way: the page is what it was, not a skeleton...
    expect(texts()).toContain(workspace.naslov); expect(texts()).toContain('Uslovi'); expect(texts()).toContain('Osvežavamo…');
    expect(texts()).not.toContain('Učitavamo Dogovor');
    // ...with the private part held back until the fresh read has landed, and every command closed.
    expect(texts()).not.toContain('+38160111222'); expect(texts()).toContain('Proveravamo broj druge strane…');
    expect(button('Potvrdi završetak').props.disabled).toBe(true); expect(button('Podeli svoj broj').props.disabled).toBe(true);
    await act(async () => resolve({ ...workspace, naslov: 'Novi naslov' }));
    expect(texts()).toContain('Novi naslov'); expect(texts()).not.toContain('Osvežavamo…'); expect(texts()).not.toContain('Proveravamo broj druge strane…');
    expect(button('Potvrdi završetak').props.disabled).toBe(false);
  });
  it('the conversation does not keep its content that way: it waits for the fresh read in a skeleton, as it always did', async () => {
    mockTab = 'poruke';
    await render();
    expect(tree.root.findAllByType('AgreementChat' as any)).toHaveLength(1);
    await act(async () => mockAppListeners.forEach(listener => listener('background')));
    mockRead.mockImplementationOnce(() => new Promise(() => {}));
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    expect(tree.root.findAllByType('AgreementChat' as any)).toHaveLength(0); expect(texts()).toContain('Učitavamo Dogovor');
  });
  it('duplicate active events preserve the admitted chat visit and do not reread workspace or history', async () => {
    mockTab = 'poruke';
    await render();
    const before = tree.root.findByType('AgreementChat' as any).props;
    const voiceScope = before.voiceScope;
    const workspaceReads = mockRead.mock.calls.length, historyReads = mockMessages.mock.calls.length;
    expect(voiceScope.isCurrent()).toBe(true);
    await act(async () => {
      mockAppListeners.forEach(listener => listener('active'));
      mockAppListeners.forEach(listener => listener('active'));
    });
    const after = tree.root.findByType('AgreementChat' as any).props;
    expect(voiceScope.isCurrent()).toBe(true);
    expect(after.voiceScope.isCurrent()).toBe(true);
    expect(after.readingPosition).toBe(before.readingPosition);
    expect(after.outbox).toBe(before.outbox);
    expect(after.messages).toEqual(before.messages);
    expect(mockRead).toHaveBeenCalledTimes(workspaceReads);
    expect(mockMessages).toHaveBeenCalledTimes(historyReads);
    // Ignoring a duplicate lifecycle event never relaxes the retained account-incarnation fence.
    mockAccountRevision++;
    expect(voiceScope.isCurrent()).toBe(false);
  });
  it('a second real background/foreground transition supersedes a pending resume read without revealing its stale result', async () => {
    await render();
    let first!: (data: unknown) => void, second!: (data: unknown) => void;
    mockRead.mockImplementationOnce(() => new Promise(done => { first = done; }))
      .mockImplementationOnce(() => new Promise(done => { second = done; }));
    await act(async () => mockAppListeners.forEach(listener => listener('background')));
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    await act(async () => mockAppListeners.forEach(listener => listener('background')));
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    await act(async () => first({ ...workspace, naslov: 'Stari rezultat' }));
    expect(texts()).not.toContain('Stari rezultat');
    await act(async () => second({ ...workspace, stanje: 'CANCELLED' }));
    expect(texts()).toContain('Dogovor je otkazan');
  });
  it('a hanging workspace request offers bounded retry and cannot overwrite its successful replacement', async () => {
    jest.useFakeTimers();
    let late!: (data: unknown) => void;
    mockRead.mockImplementationOnce(() => new Promise(done => { late = done; }));
    await render();
    await act(async () => jest.advanceTimersByTime(15_000));
    expect(texts()).toContain('Dogovor nije učitan');
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED' });
    await act(async () => button('Ponovo učitaj Dogovor').props.onPress());
    expect(texts()).toContain('Dogovor je završen');
    await act(async () => late({ ...workspace, naslov: 'Istekli rezultat' }));
    expect(texts()).not.toContain('Istekli rezultat');
  });
  it('a hanging completion becomes unknown, ignores its late result and permits authoritative refresh', async () => {
    jest.useFakeTimers();
    let late!: (result: unknown) => void;
    mockSource.potvrdiZavrsetak.mockImplementationOnce(() => new Promise(done => { late = done; }));
    await render(); const complete = await completionConfirmation();
    await act(async () => complete());
    await act(async () => jest.advanceTimersByTime(15_000));
    expect(texts()).toContain('Čuvanje nije potvrđeno');
    expect(button('Potvrdi završetak').props.disabled).toBe(true);
    expect(button('Osveži status Dogovora').props.disabled).toBe(false);
    await act(async () => late({ ok: true, podatak: null }));
    expect(mockRead).toHaveBeenCalledTimes(1);
    await act(async () => complete());
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED' });
    await act(async () => button('Osveži status Dogovora').props.onPress());
    expect(texts()).toContain('Dogovor je završen');
  });
  it('keeps the support selection exit for readable terminal history and latches its navigation', async () => {
    mockRead.mockResolvedValue({ ...workspace, verzija: 7, stanje: 'COMPLETED', chatDostupan: false }); await render();
    await act(async () => button('Poruke').props.onPress()); const chat = tree.root.findByType('AgreementChat' as React.ElementType).props;
    expect(chat.writable).toBe(false); expect(chat.messages[0].dogovorVerzija).toBe(2); expect(chat.support.canAct()).toBe(true);
    const open = jest.fn(); await act(async () => { chat.support.navigate(open); chat.support.navigate(open); });
    expect(open).toHaveBeenCalledTimes(1); expect(chat.support.canAct()).toBe(false);
    expect(mockSource.prijaviProblem).not.toHaveBeenCalled(); expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
  });
  it.each(['blur/focus', 'account ABA'] as const)('fences an old message support entry after %s', async change => {
    await render(); await act(async () => button('Poruke').props.onPress()); const old = tree.root.findByType('AgreementChat' as React.ElementType).props.support;
    expect(old.canAct()).toBe(true);
    if (change === 'blur/focus') { mockFocused = false; await act(async () => tree.update(<Dogovor />)); mockFocused = true; }
    else mockAccountRevision = 2;
    await act(async () => tree.update(<Dogovor />)); const open = jest.fn(); await act(async () => old.navigate(open));
    expect(old.canAct()).toBe(false); expect(open).not.toHaveBeenCalled();
  });
});
describe('PKG-007 server completion permissions and terminal readback', () => {
  const none = { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false };
  const pendingChange = { ...none, izmenaNaCekanju: true };
  const asParty = (radnje: unknown, role: 'narucilac' | 'uskocer', state = 'CONFIRMED') => ({ ...workspace, radnje, stanje: state,
    ucesnici: workspace.ucesnici.map(party => ({ ...party, uloga: party.viSte ? role : role === 'narucilac' ? 'uskocer' : 'narucilac' })) });
  const absent = (label: string) => expect(tree.root.findAllByProps({ accessibilityLabel: label })).toHaveLength(0);
  const receipt = { ok: true, podatak: { zavrsenoIso: '2026-09-16T10:00:00.123456+00:00', ponovljeno: false } };
  it.each([['narucilac', 'CONFIRMED'], ['uskocer', 'CONFIRMED'], ['narucilac', 'AWAITING_REQUESTER']])(
    'a pending change hides the %s completion action while %s and explains why', async (role, state) => {
    mockRead.mockResolvedValue(asParty(pendingChange, role as 'narucilac' | 'uskocer', state));
    await render();
    absent('Potvrdi završetak'); absent('Zadatak je gotov');
    expect(texts()).toContain('Predlog izmene čeka odgovor');
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    expect(mockSource.oznaciZavrsetak).not.toHaveBeenCalled();
  });
  it.each([null, undefined])('missing server permissions (%s) fail closed until an explicit readback restores the action', async radnje => {
    mockRead.mockResolvedValueOnce({ ...workspace, radnje });
    await render();
    absent('Potvrdi završetak'); absent('Zadatak je gotov');
    expect(texts()).toContain('Ne možemo da proverimo da li možeš da završiš zadatak');
    await act(async () => button('Osveži Dogovor').props.onPress());
    expect(mockRead).toHaveBeenCalledTimes(2);
    expect(button('Potvrdi završetak').props.disabled).toBe(false);
    expect(texts()).not.toContain('Ne možemo da proverimo da li možeš da završiš zadatak');
  });
  it('a server-denied requester permission hides the action even without a pending change', async () => {
    mockRead.mockResolvedValue({ ...workspace, radnje: none });
    await render();
    absent('Potvrdi završetak');
    expect(texts()).not.toContain('Predlog izmene čeka odgovor');
    expect(texts()).not.toContain('Ne možemo da proverimo da li možeš da završiš zadatak');
  });
  it.each([['narucilac', { ...none, mozeOznacitiZavrsetak: true }], ['uskocer', { ...none, mozePotvrditiZavrsetak: true }]])(
    'a permission granted to the other party does not enable the %s', async (role, radnje) => {
    mockRead.mockResolvedValue(asParty(radnje, role as 'narucilac' | 'uskocer'));
    await render();
    absent('Potvrdi završetak'); absent('Zadatak je gotov');
  });
  it('an unchanged readback after a valid confirmation receipt stays unconfirmed until explicit reconciliation', async () => {
    mockSource.potvrdiZavrsetak.mockResolvedValueOnce(receipt);
    await render();
    await confirmCompletion();
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledWith(workspace.id);
    expect(mockRead).toHaveBeenCalledTimes(2);
    // Review r3b: this pinned "Završetak nije potvrđen", which read like the normal wait for the other side. The line now
    // says what did not get written; the requester's is the confirmation.
    expect(texts()).toContain('Nismo uspeli da zabeležimo potvrdu završetka. Osveži Dogovor pa pokušaj ponovo.');
    expect(texts()).not.toContain('Dogovor je završen');
    expect(button('Potvrdi završetak').props.disabled).toBe(true);
    await act(async () => button('Potvrdi završetak').props.onPress());
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED', radnje: none });
    await act(async () => button('Osveži status Dogovora').props.onPress());
    expect(texts()).toContain('Dogovor je završen');
    absent('Potvrdi završetak');
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
  });
  it('a valid COMPLETED readback confirms the requester completion', async () => {
    mockSource.potvrdiZavrsetak.mockImplementationOnce(async () => {
      mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED', radnje: none });
      return receipt;
    });
    await render();
    await confirmCompletion();
    expect(texts()).toContain('Dogovor je završen');
    expect(texts()).not.toContain('Nismo uspeli da zabeležimo potvrdu završetka');
    expect(button('Oceni saradnju')).toBeTruthy();
    absent('Potvrdi završetak');
  });
  it('shows the known server denial copy, never the adapter text, and does not read back', async () => {
    mockSource.potvrdiZavrsetak.mockResolvedValueOnce({ ok: false, kod: 'AGREEMENT_CHANGE_PENDING', poruka: 'adapter text' });
    await render();
    await confirmCompletion();
    expect(texts()).toContain('Najpre odgovori na postojeći predlog izmene.');
    expect(texts()).not.toContain('adapter text');
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(button('Potvrdi završetak').props.disabled).toBe(true);
    mockRead.mockResolvedValue({ ...workspace, radnje: pendingChange });
    await act(async () => button('Osveži status Dogovora').props.onPress());
    absent('Potvrdi završetak');
    expect(texts()).toContain('Predlog izmene čeka odgovor');
  });
  it('the worker mark is confirmed only by an AWAITING_REQUESTER or COMPLETED readback', async () => {
    const asWorker = asParty({ ...none, mozeOznacitiZavrsetak: true }, 'uskocer');
    mockRead.mockResolvedValue(asWorker);
    mockSource.oznaciZavrsetak.mockResolvedValueOnce({ ok: true, podatak: { rokPotvrdeIso: '2026-09-18T10:00:00Z' } });
    await render();
    await confirmCompletion(true);
    expect(mockSource.oznaciZavrsetak).toHaveBeenCalledWith(workspace.id);
    // Review r3b: the worker's line names the mark that did not get written ("Završetak nije potvrđen" before).
    expect(texts()).toContain('Nismo uspeli da zabeležimo da je zadatak gotov. Osveži Dogovor pa pokušaj ponovo.');
    expect(button('Zadatak je gotov').props.disabled).toBe(true);
    mockRead.mockResolvedValue({ ...asWorker, stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z', radnje: none });
    await act(async () => button('Osveži status Dogovora').props.onPress());
    expect(texts()).toContain('Čeka se potvrda druge strane');
    absent('Zadatak je gotov');
    expect(mockSource.oznaciZavrsetak).toHaveBeenCalledTimes(1);
  });
  it('a completion receipt arriving after an A→B→A auth incarnation change cannot apply or read back', async () => {
    let resolve!: (value: unknown) => void;
    mockSource.potvrdiZavrsetak.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await render();
    await confirmCompletion();
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
    mockAccountRevision += 2;
    await act(async () => tree.update(<Dogovor />));
    const readsBeforeLateReceipt = mockRead.mock.calls.length;
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED', radnje: none });
    await act(async () => resolve(receipt));
    expect(mockRead).toHaveBeenCalledTimes(readsBeforeLateReceipt);
    expect(texts()).not.toContain('Dogovor je završen');
  });
});
