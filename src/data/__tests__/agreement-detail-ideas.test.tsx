import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ADDRESS_REQUEST_TEXT } from '../../ui/agreements/agreementContactModel';

/**
 * The Dogovor's overview as its route draws it, for the ideas of the UI pass of 2026-10-08 (`POTREBE_KORISNIKA_20261007.md`):
 * R01a (a number is offered only to an account that has one), R03 (the question for the address is written into the conversation's draft,
 * never sent), R04 (three ways on after a problem was reported), CANCEL-INFO (who cancelled, when and why, read once for a cancelled
 * Dogovor) and the states while the Dogovor is read. The state machine, the guards and the journals are the other route suites'.
 */
const mockAccount = '10000000-0000-4000-8000-000000000001', mockOther = '10000000-0000-4000-8000-000000000002', mockAgreementId = '20000000-0000-4000-8000-000000000001';
const mockRouter = { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn() };
const mockRead = jest.fn(), mockMessages = jest.fn(), mockProblemRead = jest.fn(), mockCancellationRead = jest.fn(), mockDisplayed = jest.fn();
const mockOutboxModel = { reconcile: jest.fn().mockResolvedValue(undefined), setDraft: jest.fn().mockResolvedValue(undefined) };
let mockOutboxState: { phase: string; entries: unknown[]; draft?: string } = { phase: 'ready', entries: [], draft: '' };
let mockAccountPhone: string | undefined = '+381601234567';
let mockParams: Record<string, string> = { id: mockAgreementId };
const mockSource = { dogovor: mockRead, poruke: mockMessages, oznaciZavrsetak: jest.fn(), potvrdiZavrsetak: jest.fn(), podeliTelefon: jest.fn(), opoziviTelefon: jest.fn(),
  oznaciPorukeProcitanim: jest.fn() };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'android' };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, fontScale: 1, scale: 3 });
    if (key === 'AppState') return { currentState: 'active', addEventListener: () => ({ remove: () => {} }) };
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => effect(), [effect]) }));
jest.mock('../agreementClientService', () => ({ agreementProblemService: { submit: jest.fn(), read: (...args: unknown[]) => mockProblemRead(...args) } }));
jest.mock('../groupConversationService', () => ({ groupConversationService: { context: jest.fn().mockResolvedValue({ ok: true, podatak: { group: null } }) } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' } }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/AgreementChat', () => ({ AgreementChat: (props: { context?: React.ReactNode }) => require('react').createElement('AgreementChat', props, props.context) }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'PrivateMap' }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount, phone: mockAccountPhone }, accountRevision: 0 }),
  sesijaSada: () => ({ user: { id: mockAccount, phone: mockAccountPhone }, accountRevision: 0 }) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource }));
jest.mock('../../hooks/useAgreementOutbox', () => ({ useAgreementOutbox: () => ({ model: mockOutboxModel, state: mockOutboxState }) }));
jest.mock('../../hooks/useAgreementPhotos', () => ({ useAgreementPhotos: () => ({ agreementId: mockAgreementId, loaded: true, busy: false, items: [] }) }));
jest.mock('../agreementMessageHistoryService', () => ({
  compareAgreementMessageCursors: (left: any, right: any) => left.createdAt.localeCompare(right.createdAt) || left.messageId.localeCompare(right.messageId),
  agreementMessageHistoryService: {
    page: async (id: string, _options: unknown, scope: any) => ({ ok: true, podatak: { accountId: scope.accountId, agreementId: id, messages: [], olderCursor: null, asOf: '2026-09-27T13:00:00.123456Z' } }),
    window: async (id: string, target: string, _options: unknown, scope: any) => ({ ok: true, podatak: { accountId: scope.accountId, agreementId: id, targetMessageId: target,
      messages: [], beforeCursor: null, afterCursor: null, asOf: '2026-09-27T13:00:00.123456Z' } }),
    markDisplayed: (...args: unknown[]) => mockDisplayed(...args),
  },
}));
jest.mock('../reviewsClientService', () => ({ reviewsClientService: { context: jest.fn().mockResolvedValue({ ok: true, podatak: { eligible: true, review: null } }) } }));
jest.mock('../agreementCancellationClientService', () => ({
  agreementCancellationService: { read: (...args: unknown[]) => mockCancellationRead(...args) },
  cancellationOf: (all: Map<string, unknown> | null | undefined, id: string) => all?.get(id.toLowerCase()) ?? null,
}));
import Dogovor from '../../app/dogovor/[id]';

const base = (patch: Record<string, unknown> = {}, mine: 'narucilac' | 'uskocer' = 'narucilac') => ({
  id: mockAgreementId, naslov: 'Pomoć pri selidbi', stanje: 'CONFIRMED', verzija: 1, cena: { prikaz: '3.000 RSD' }, pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0 },
  ucesnici: [{ id: mockAccount, ime: 'Ana', inicijali: 'AN', uloga: mine, mesta: mine === 'uskocer' ? 1 : null, viSte: true },
    { id: mockOther, ime: 'Marko', inicijali: 'MA', uloga: mine === 'narucilac' ? 'uskocer' : 'narucilac', mesta: mine === 'narucilac' ? 1 : null, viSte: false }],
  hronologija: [], kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: false },
  chatDostupan: true, vremeTekst: 'Fleksibilno', putanjaTekst: 'Beograd', problemOtvoren: false, rokPotvrdeIso: null, rezim: 'FIZICKI',
  radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false, predlogIzmene: null },
  izvor: { zadatakId: '30000000-0000-4000-8000-000000000001', prijavaId: '40000000-0000-4000-8000-000000000001' }, ...patch });
const physical = { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true };
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAll(node => String(node.type) === 'Press');
const labels = () => presses().map(node => node.props.accessibilityLabel);
const press = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
const chat = () => tree.root.findAll(node => String(node.type) === 'AgreementChat');
async function render(workspace: Record<string, unknown> | null) {
  mockRead.mockResolvedValue(workspace); mockMessages.mockResolvedValue([]);
  await act(async () => { tree = create(<Dogovor />); });
}
beforeEach(() => {
  jest.clearAllMocks(); mockParams = { id: mockAgreementId }; mockAccountPhone = '+381601234567'; mockOutboxState = { phase: 'ready', entries: [], draft: '' };
  mockDisplayed.mockReset().mockResolvedValue({ ok: true, podatak: {} }); mockProblemRead.mockReset();
  mockCancellationRead.mockReset().mockResolvedValue({ ok: true, podatak: new Map() });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

describe('R01a: a number is offered only to an account that has one', () => {
  it('tells an account without a number where contact happens, and the row takes it to Poruke', async () => {
    mockAccountPhone = undefined;
    await render(base());
    expect(labels()).toContain('Kontakt kroz Poruke'); expect(labels()).not.toContain('Podeli svoj broj');
    expect(chat()).toHaveLength(0);
    await act(async () => press('Kontakt kroz Poruke').props.onPress());
    expect(chat()).toHaveLength(1);
  });

  it('treats an empty number as none', async () => {
    mockAccountPhone = '   ';
    await render(base());
    expect(labels()).toContain('Kontakt kroz Poruke'); expect(labels()).not.toContain('Podeli svoj broj');
  });

  it('keeps "Podeli svoj broj" for an account that has one', async () => {
    await render(base());
    expect(labels()).toContain('Podeli svoj broj'); expect(labels()).not.toContain('Kontakt kroz Poruke');
  });

  it('leaves the number out of the "···" of the conversation too, yet lets a number that was shared be taken back', async () => {
    mockAccountPhone = undefined;
    // The overview has no menu (its actions are rows of the page); the "···" is the conversation's.
    mockParams = { id: mockAgreementId, tab: 'poruke' };
    const menu = () => presses().filter(node => node.props.accessibilityRole === 'menuitem').map(node => node.props.accessibilityLabel);
    await render(base());
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Više radnji' }).props.onPress());
    expect(menu()).not.toContain('Podeli svoj broj');
    await act(async () => tree.unmount());
    await render(base({ kontakt: { mojTelefonPodeljen: true, njihovTelefon: null, lokacijaPostoji: false } }));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Više radnji' }).props.onPress());
    expect(menu()).toContain('Opozovi deljenje broja');
  });

  it('calls the number the other side shared, with one press', async () => {
    await render(base({ kontakt: { mojTelefonPodeljen: false, njihovTelefon: '064 123 4567', lokacijaPostoji: false } }));
    expect(labels()).toContain('Pozovi, 064 123 4567');
  });
});

describe('R03: the address is asked for in the conversation, never sent for the person', () => {
  it('writes the question into an empty, loaded draft and opens the conversation', async () => {
    await render(base({ kontakt: physical }, 'uskocer'));
    expect(texts()).toContain('Adresa još nije podeljena.');
    await act(async () => press('Zatraži adresu').props.onPress());
    expect(mockOutboxModel.setDraft).toHaveBeenCalledTimes(1);
    expect(mockOutboxModel.setDraft).toHaveBeenCalledWith(ADDRESS_REQUEST_TEXT);
    expect(chat()).toHaveLength(1);
  });

  it('never writes over a draft the person already has, and never into a draft that has not been read', async () => {
    mockOutboxState = { phase: 'ready', entries: [], draft: 'Stižem u šest.' };
    await render(base({ kontakt: physical }, 'uskocer'));
    await act(async () => press('Zatraži adresu').props.onPress());
    expect(mockOutboxModel.setDraft).not.toHaveBeenCalled(); expect(chat()).toHaveLength(1);
    await act(async () => tree.unmount());
    mockOutboxState = { phase: 'loading', entries: [], draft: '' };
    await render(base({ kontakt: physical }, 'uskocer'));
    await act(async () => press('Zatraži adresu').props.onPress());
    expect(mockOutboxModel.setDraft).not.toHaveBeenCalled();
  });

  it('tells the side that owns the address to share it when ready, and offers it no question', async () => {
    await render(base({ kontakt: physical }));
    expect(texts()).toContain('Podeli adresu kad budete spremni.'); expect(labels()).not.toContain('Zatraži adresu');
  });
});

describe('R04: three ways on after a problem was reported', () => {
  const reported = (patch: Record<string, unknown> = {}, mine: 'narucilac' | 'uskocer' = 'narucilac') => {
    mockProblemRead.mockResolvedValue({ ok: true, podatak: { state: 'AVAILABLE', report: { openedBy: mockOther, openedAt: '2026-09-10T18:00:00Z', narrative: 'Nije došao.' } } });
    return render(base({ problemOtvoren: true, ...patch }, mine));
  };

  it('are rows of one list under their own title, and "Prijavi problem" is gone', async () => {
    await reported();
    expect(texts()).toContain('Šta dalje');
    expect(labels()).toEqual(expect.arrayContaining(['Dogovorite se u Porukama', 'Otkaži Dogovor', 'Prijavi nedolazak']));
    expect(labels()).not.toContain('Prijavi problem');
    // One place for one action (J1): the cancelling is the ways-on's while they stand, and the actions of the page do not draw it a second time.
    expect(labels().filter(label => label === 'Otkaži Dogovor')).toHaveLength(1);
  });

  it('say what each is by its title alone: no line of explanation under a row, what it does is spoken', async () => {
    await reported();
    for (const sentence of ['Napišite šta je ostalo nerešeno.', 'Uz razlog. Posle toga možeš ponovo da tražiš ljude.', 'Otvara podršku sa ovim Dogovorom.']) expect(texts()).not.toContain(sentence);
    expect(press('Otkaži Dogovor').props.accessibilityHint).toBe('Uz razlog. Posle toga možeš ponovo da tražiš ljude.');
  });

  it('are one tinted note, and the sentence in it is one: who sees the words, and that a problem decides no one is guilty or owes', async () => {
    await reported();
    expect(texts()).toContain('Opis vide oba učesnika, a problem sam po sebi ne određuje krivicu ili dug.');
    // The stopped completion is said by the head of the Dogovor (while the confirmation is awaited), not by a second sentence in the note.
    expect(texts()).not.toContain('Automatski završetak je zaustavljen. Završetak se i dalje može potvrditi.');
  });

  it('lead to the conversation, to the cancelling with its reason, and to support with this Dogovor already chosen', async () => {
    await reported();
    await act(async () => press('Dogovorite se u Porukama').props.onPress());
    expect(chat()).toHaveLength(1);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pregled' }).props.onPress());
    await act(async () => press('Otkaži Dogovor').props.onPress());
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/dogovor/[id]/izmene', params: { id: mockAgreementId, start: 'cancel' } });
    await act(async () => press('Prijavi nedolazak').props.onPress());
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/podrska/novi', params: { contextKind: 'AGREEMENT', contextId: mockAgreementId, contextRevision: '1' } });
  });

  it('offer no cancelling to the requester once the work is reported done (the Dogovor has nothing left to cancel for them)', async () => {
    await reported({ stanje: 'AWAITING_REQUESTER' });
    expect(labels()).not.toContain('Otkaži Dogovor');
    expect(labels()).toEqual(expect.arrayContaining(['Dogovorite se u Porukama', 'Prijavi nedolazak']));
  });

  it('are not drawn for a Dogovor that is over: there is nothing left to agree on, to cancel or to report', async () => {
    await reported({ stanje: 'COMPLETED' });
    expect(texts()).not.toContain('Šta dalje');
  });
});

describe('CANCEL-INFO: who cancelled, when and why', () => {
  const cancelled = (patch: Record<string, unknown> = {}) => base({ stanje: 'CANCELLED', chatDostupan: false, ...patch });
  const line = () => tree.root.findAllByProps({ testID: 'agreement-steps-cancelled' }).map(node => node.props.children)[0];

  it('is read once, for a cancelled Dogovor only, and drawn as one line under the steps', async () => {
    mockCancellationRead.mockResolvedValue({ ok: true, podatak: new Map([[mockAgreementId, { agreementId: mockAgreementId, cancelledAt: '2026-10-05T12:00:00Z',
      by: 'WORKER', byMe: false, reason: 'Promenio se termin', reasonState: 'KEPT' }]]) });
    await render(cancelled());
    expect(mockCancellationRead).toHaveBeenCalledTimes(1);
    expect(mockCancellationRead).toHaveBeenCalledWith([mockAgreementId], { accountId: mockAccount, accountRevision: 0 });
    expect(line()).toMatch(/^Otkazano 5\. okt( 2026)? · 14:00 · Marko · Promenio se termin$/);
  });

  it('says "Ti" when I cancelled, and in words why there is no reason when none was kept', async () => {
    mockCancellationRead.mockResolvedValue({ ok: true, podatak: new Map([[mockAgreementId, { agreementId: mockAgreementId, cancelledAt: '2026-10-05T12:00:00Z',
      by: 'REQUESTER', byMe: true, reason: null, reasonState: 'NOT_KEPT' }]]) });
    await render(cancelled());
    expect(line()).toMatch(/^Otkazano 5\. okt( 2026)? · 14:00 · Ti · Razlog nije sačuvan$/);
  });

  it('says only "Otkazano" when the server says nothing, and invents no side, time or reason', async () => {
    mockCancellationRead.mockResolvedValue({ ok: false, kod: 'CANCELLATION_READ_FAILED', poruka: 'x' });
    await render(cancelled());
    expect(line()).toBe('Otkazano');
    await act(async () => tree.unmount());
    mockCancellationRead.mockRejectedValue(new Error('offline'));
    await render(cancelled());
    expect(line()).toBe('Otkazano');
  });

  it('is not asked for a Dogovor that is not cancelled', async () => {
    await render(base());
    expect(mockCancellationRead).not.toHaveBeenCalled();
  });
});

describe('the Dogovor while it is read', () => {
  it('says that one the person cannot open cannot be opened, and has one way forward: back to the Dogovori', async () => {
    await render(null);
    expect(texts()).toContain('Dogovor nije dostupan');
    await act(async () => press('Nazad na Dogovore').props.onPress());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('says that a failed read failed, and reads it again on the one button', async () => {
    mockRead.mockRejectedValueOnce(new Error('offline'));
    mockMessages.mockResolvedValue([]);
    await act(async () => { tree = create(<Dogovor />); });
    expect(texts()).toContain('Dogovor nije učitan');
    mockRead.mockResolvedValue(base());
    await act(async () => press('Ponovo učitaj Dogovor').props.onPress());
    expect(texts()).toContain('Pomoć pri selidbi');
  });
});
