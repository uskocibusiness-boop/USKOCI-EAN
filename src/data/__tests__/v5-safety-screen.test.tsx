import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', K = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let mockSession = { user: { id: A }, accountRevision: 1 }, mockFocused = true;
let mockContext: { targetAccountId: string; needId: string | null; agreementId: string | null } = { targetAccountId: B, needId: null, agreementId: null };
const mockRequestId = jest.fn(() => K);
const mockStorage = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
const mockSafety = { readBlock: jest.fn(), setBlock: jest.fn(), report: jest.fn(), readReportCommand: jest.fn() };
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (...args: unknown[]) => mockStorage.getItem(...args), setItem: (...args: unknown[]) => mockStorage.setItem(...args), removeItem: (...args: unknown[]) => mockStorage.removeItem(...args),
} }));
jest.mock('../safetyClientService', () => ({ safetyClientService: {
  readBlock: (...args: unknown[]) => mockSafety.readBlock(...args), setBlock: (...args: unknown[]) => mockSafety.setBlock(...args),
  report: (...args: unknown[]) => mockSafety.report(...args), readReportCommand: (...args: unknown[]) => mockSafety.readReportCommand(...args),
}, SAFETY_CATEGORIES: ['HARASSMENT','FRAUD','UNSAFE_WORK','DISCRIMINATION','OTHER'] }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => mockRequestId() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  return key === 'View' ? 'View' : key === 'TextInput' ? 'Input' : Reflect.get(target, key);
} }); });
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsScreen: 'Screen', SettingsPanel: 'Panel', SettingsText: 'T', SettingsAction: 'Action' }));
import { SafetyScreen } from '../../ui/safety/SafetyScreen';
import { poruka } from '../../ui/system/Poruka';
import { SuccessMark } from '../../ui/system/SuccessMark';
let tree: ReactTestRenderer;
const page = () => <SafetyScreen {...mockContext} />;
const render = async () => { await act(async () => { tree = create(page()); }); };
const update = async () => { await act(async () => tree.update(page())); };
const action = (label: string) => tree.root.findByProps({ label }).props;
const confirmButton = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.testID === 'confirm-sheet-confirm')[0];
const confirmBlock = async () => { const confirm = confirmButton(); expect(confirm).toBeDefined(); await act(async () => confirm.props.onPress()); };
const copy = () => tree.root.findAll(n => String(n.type) === 'T').flatMap(n => n.children.filter(c => typeof c === 'string')).join(' ');
const receipt = () => ({ reportId: K, received: true, clientRequestId: K, createdAt: '2026-09-13T00:00:00Z', idempotentReplay: true, authoritative: true });
const fill = async () => { await act(async () => {
  tree.root.findByProps({ accessibilityLabel: 'Uznemiravanje' }).props.onPress();
  tree.root.findByProps({ accessibilityLabel: 'Kratak razlog privatne prijave' }).props.onChangeText('Privatan razlog');
  tree.root.findByProps({ accessibilityLabel: 'Dodatni privatni opis' }).props.onChangeText('Privatan opis');
}); };
beforeEach(() => { jest.clearAllMocks(); for (const f of Object.values(mockStorage)) f.mockReset(); for (const f of Object.values(mockSafety)) f.mockReset();
  mockSession = { user: { id: A }, accountRevision: 1 }; mockFocused = true;
  mockContext = { targetAccountId: B, needId: null, agreementId: null };
  mockStorage.getItem.mockResolvedValue(null); mockStorage.setItem.mockResolvedValue(undefined); mockStorage.removeItem.mockResolvedValue(undefined);
  mockSafety.readBlock.mockImplementation(async (targetAccountId: string) => ({ ok: true,
    podatak: { accountId: mockSession.user.id, targetAccountId, blocked: false, revision: 0, authoritative: true } }));
  mockSafety.setBlock.mockImplementation(async (command: { targetAccountId: string; blocked: boolean; expectedRevision: number; clientRequestId: string }) => ({ ok: true,
    podatak: { accountId: mockSession.user.id, targetAccountId: command.targetAccountId, blocked: command.blocked,
      revision: command.expectedRevision + 1, clientRequestId: command.clientRequestId, authoritative: true, idempotentReplay: false } }));
  mockSafety.report.mockResolvedValue({ ok: false, kod: 'UNKNOWN', poruka: 'Ishod nije potvrđen.' });
  mockSafety.readReportCommand.mockResolvedValue({ ok: true, podatak: { found: false, receipt: null } });
});
afterEach(async () => { await act(async () => tree?.unmount()); poruka.hide(); });
it('asks the existing block consequence first; cancel sends nothing and a fresh confirmation sends the exact choice once', async () => {
  await render(); await act(async () => action('Blokiraj osobu').onPress());
  expect(copy()).toContain('Blokirati osobu?');
  expect(copy()).toContain('Blokiranje zaustavlja običan kontakt i nova povezivanja. Završetak, otkazivanje i prijava problema u postojećem Dogovoru ostaju dostupni.');
  expect(mockSafety.setBlock).not.toHaveBeenCalled(); expect(mockRequestId).not.toHaveBeenCalled();
  const canceled = confirmButton().props.onPress;
  await act(async () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.testID === 'confirm-sheet-cancel')[0].props.onPress());
  await act(async () => canceled());
  expect(confirmButton()).toBeUndefined(); expect(mockSafety.setBlock).not.toHaveBeenCalled(); expect(mockRequestId).not.toHaveBeenCalled();
  await act(async () => action('Blokiraj osobu').onPress());
  const confirm = confirmButton().props.onPress; await act(async () => { confirm(); confirm(); });
  expect(mockSafety.setBlock.mock.calls).toEqual([[{ targetAccountId: B, blocked: true, expectedRevision: 0, clientRequestId: K }]]);
  expect(mockRequestId).toHaveBeenCalledTimes(1); expect(copy()).toContain('Osoba je blokirana.'); expect(mockSafety.report).not.toHaveBeenCalled();
});
it.each(['blur', 'account', 'incarnation', 'target', 'need', 'agreement'] as const)('retires a block question after %s changes and rejects its retained confirmation and opener', async change => {
  await render(); const open = action('Blokiraj osobu').onPress; await act(async () => open());
  const late = confirmButton().props.onPress;
  if (change === 'blur') mockFocused = false;
  else if (change === 'account') mockSession = { user: { id: K }, accountRevision: 2 };
  else if (change === 'incarnation') mockSession = { user: { id: A }, accountRevision: 3 };
  else if (change === 'target') mockContext = { ...mockContext, targetAccountId: K };
  else if (change === 'need') mockContext = { ...mockContext, needId: K };
  else mockContext = { ...mockContext, agreementId: K };
  await update(); expect(confirmButton()).toBeUndefined();
  await act(async () => { late(); open(); });
  expect(confirmButton()).toBeUndefined(); expect(mockSafety.setBlock).not.toHaveBeenCalled(); expect(mockRequestId).not.toHaveBeenCalled();
  if (change === 'blur') { mockFocused = true; await update(); }
  await act(async () => action('Blokiraj osobu').onPress()); await confirmBlock();
  expect(mockSafety.setBlock).toHaveBeenCalledTimes(1); expect(mockSafety.setBlock.mock.calls[0][0].targetAccountId).toBe(mockContext.targetAccountId);
});
it('retires a question before a new read generation, including a retained refresh of the same revision', async () => {
  mockSafety.readBlock.mockRejectedValueOnce(new Error('offline'));
  await render(); const refresh = action('Proveri blokiranje').onPress; await act(async () => refresh());
  const open = action('Blokiraj osobu').onPress; await act(async () => open()); const late = confirmButton().props.onPress;
  await act(async () => { refresh(); late(); }); expect(confirmButton()).toBeUndefined();
  await act(async () => open()); expect(confirmButton()).toBeUndefined(); expect(mockSafety.setBlock).not.toHaveBeenCalled();
  await act(async () => action('Blokiraj osobu').onPress()); await confirmBlock(); expect(mockSafety.setBlock).toHaveBeenCalledTimes(1);
});
it('keeps an unknown block fenced until readback and then replays only the exact confirmed command', async () => {
  mockSafety.setBlock.mockResolvedValueOnce({ ok: false, kod: 'BLOCK_OUTCOME_UNKNOWN', poruka: 'Ishod blokiranja nije potvrđen.' });
  await render(); await act(async () => action('Blokiraj osobu').onPress()); await confirmBlock();
  expect(action('Blokiraj osobu').disabled).toBe(true); expect(copy()).toContain('Ishod blokiranja nije potvrđen.');
  await act(async () => action('Blokiraj osobu').onPress()); expect(confirmButton()).toBeUndefined(); expect(mockSafety.setBlock).toHaveBeenCalledTimes(1);
  await act(async () => action('Proveri blokiranje').onPress());
  await act(async () => action('Blokiraj osobu').onPress());
  expect(confirmButton()).toBeUndefined(); expect(mockSafety.setBlock).toHaveBeenCalledTimes(2);
  expect(mockSafety.setBlock.mock.calls[1][0]).toEqual(mockSafety.setBlock.mock.calls[0][0]); expect(mockRequestId).toHaveBeenCalledTimes(1);
});
// UI/UX pass 2026-10-07 (plan 2.3): the unblock asks too, in the centred dialog, with what follows in one sentence; and each
// confirmed change is said in the one outcome bar with the way to put it back.
it('unblocking asks first with what follows; only the confirm sends the exact revision, once', async () => {
  mockSafety.readBlock.mockResolvedValueOnce({ ok: true, podatak: { accountId: A, targetAccountId: B, blocked: true, revision: 4, authoritative: true } });
  await render(); await act(async () => action('Odblokiraj osobu').onPress());
  expect(copy()).toContain('Odblokirati osobu?');
  expect(copy()).toContain('Odblokiranje ne vraća ranije dozvole za deljenje kontakta ili tačne lokacije.');
  expect(mockSafety.setBlock).not.toHaveBeenCalled(); expect(mockRequestId).not.toHaveBeenCalled();
  const canceled = confirmButton().props.onPress;
  await act(async () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.testID === 'confirm-sheet-cancel')[0].props.onPress());
  await act(async () => canceled());
  expect(confirmButton()).toBeUndefined(); expect(mockSafety.setBlock).not.toHaveBeenCalled();
  await act(async () => action('Odblokiraj osobu').onPress());
  const confirm = confirmButton().props.onPress; await act(async () => { confirm(); confirm(); });
  expect(mockSafety.setBlock.mock.calls).toEqual([[{ targetAccountId: B, blocked: false, expectedRevision: 4, clientRequestId: K }]]);
  expect(copy()).toContain('Osoba nije blokirana.');
});
it('a confirmed block is said in the outcome bar with "Vrati", which unblocks with a command of its own from the receipt\'s revision', async () => {
  await render(); await act(async () => action('Blokiraj osobu').onPress()); await confirmBlock();
  expect(poruka.current()).toMatchObject({ text: 'Blokiranje je sačuvano.', confirmed: true, action: { label: 'Vrati' } });
  mockRequestId.mockClear();
  await act(async () => poruka.current()!.action!.onPress());
  expect(mockSafety.setBlock).toHaveBeenCalledTimes(2);
  expect(mockSafety.setBlock.mock.calls[1][0]).toEqual({ targetAccountId: B, blocked: false, expectedRevision: 1, clientRequestId: K });
  expect(mockRequestId).toHaveBeenCalledTimes(1);
  expect(poruka.current()).toMatchObject({ text: 'Blokiranje je uklonjeno.', confirmed: true }); expect(poruka.current()?.action).toBeUndefined();
});
it('a confirmed unblock is said with "Vrati", which blocks again from the receipt\'s revision', async () => {
  mockSafety.readBlock.mockResolvedValueOnce({ ok: true, podatak: { accountId: A, targetAccountId: B, blocked: true, revision: 4, authoritative: true } });
  await render(); await act(async () => action('Odblokiraj osobu').onPress()); await confirmBlock();
  expect(poruka.current()).toMatchObject({ text: 'Blokiranje je uklonjeno.', confirmed: true, action: { label: 'Vrati' } });
  await act(async () => poruka.current()!.action!.onPress());
  expect(mockSafety.setBlock.mock.calls[1][0]).toEqual({ targetAccountId: B, blocked: true, expectedRevision: 5, clientRequestId: K });
  expect(poruka.current()).toMatchObject({ text: 'Blokiranje je vraćeno.' });
});
it('an undo the server does not confirm says so and offers nothing more; and a "Vrati" of another account does nothing', async () => {
  await render(); await act(async () => action('Blokiraj osobu').onPress()); await confirmBlock();
  mockSafety.setBlock.mockResolvedValueOnce({ ok: false, kod: 'BLOCK_OUTCOME_UNKNOWN', poruka: 'Ishod nije potvrđen.' });
  await act(async () => poruka.current()!.action!.onPress());
  expect(poruka.current()).toMatchObject({ text: 'Promena nije potvrđena. Proveri stanje pa pokušaj ponovo.' }); expect(poruka.current()?.action).toBeUndefined();
  // The bar of a change made by account A, pressed after the account changed under it, sends nothing.
  poruka.hide(); await act(async () => tree.unmount());
  await render(); await act(async () => action('Blokiraj osobu').onPress()); await confirmBlock();
  const onPress = poruka.current()!.action!.onPress; mockSession = { user: { id: K }, accountRevision: 2 }; mockSafety.setBlock.mockClear();
  await act(async () => onPress()); expect(mockSafety.setBlock).not.toHaveBeenCalled();
});
it('a refused block says nothing in the outcome bar: only a confirmed change is announced', async () => {
  mockSafety.setBlock.mockResolvedValueOnce({ ok: false, kod: 'BLOCK_OUTCOME_UNKNOWN', poruka: 'Ishod blokiranja nije potvrđen.' });
  await render(); await act(async () => action('Blokiraj osobu').onPress()); await confirmBlock();
  expect(poruka.current()).toBeNull();
});
it('keeps five categories and sends only once on retained double tap, storing no report text', async () => {
  await render(); expect(tree.root.findAllByProps({ accessibilityRole: 'radio' })).toHaveLength(5);
  expect(tree.root.findAllByProps({ testID: 'safety-category-selected' })).toHaveLength(0);
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Prevara' }).props.onPress());
  expect(tree.root.findByProps({ accessibilityLabel: 'Prevara' }).props.accessibilityState.checked).toBe(true);
  expect(tree.root.findByProps({ accessibilityLabel: 'Prevara' }).findAllByProps({ testID: 'safety-category-selected' })).toHaveLength(1);
  await fill();
  expect(tree.root.findByProps({ accessibilityLabel: 'Prevara' }).props.accessibilityState.checked).toBe(false);
  expect(tree.root.findByProps({ accessibilityLabel: 'Uznemiravanje' }).findAllByProps({ testID: 'safety-category-selected' })).toHaveLength(1);
  expect(tree.root.findAllByProps({ testID: 'safety-category-selected' })).toHaveLength(1);
  const send = action('Pošalji privatnu prijavu').onPress;
  await act(async () => { send(); send(); });
  expect(mockSafety.report).toHaveBeenCalledTimes(1);
  expect(mockStorage.setItem).toHaveBeenCalledWith(expect.stringContaining(`${A}:${B}`), K);
  expect(JSON.stringify(mockStorage.setItem.mock.calls)).not.toContain('Privatan');
  expect(mockSafety.report.mock.calls[0][0]).toMatchObject({ targetAccountId: B, category: 'HARASSMENT', reason: 'Privatan razlog', narrative: 'Privatan opis', clientRequestId: K });
  expect(mockSafety.setBlock).not.toHaveBeenCalled();
});
it('reads unknown receipt without another report and repeats only the frozen same request when asked', async () => {
  await render(); await fill(); await act(async () => action('Pošalji privatnu prijavu').onPress());
  await act(async () => action('Proveri potvrdu prijave').onPress());
  expect(mockSafety.report).toHaveBeenCalledTimes(1);
  await act(async () => action('Pošalji ponovo').onPress());
  expect(mockSafety.report.mock.calls[1][0]).toEqual(mockSafety.report.mock.calls[0][0]);
});
it('restores receipt after app recreation from opaque key without auto-submit', async () => {
  mockStorage.getItem.mockResolvedValue(K); mockSafety.readReportCommand.mockResolvedValue({ ok: true, podatak: { found: true, receipt: receipt() } });
  await render(); expect(mockSafety.readReportCommand).toHaveBeenCalledWith(K); expect(mockSafety.report).not.toHaveBeenCalled();
  expect(action('Nova privatna prijava')).toBeDefined();
});
it('cannot bypass a failed restore with a new command or send after blur', async () => {
  mockStorage.getItem.mockRejectedValue(new Error('LOCAL_READ_FAILED')); await render();
  expect(action('Pošalji privatnu prijavu').disabled).toBe(true); await act(async () => action('Pošalji privatnu prijavu').onPress());
  expect(mockStorage.setItem).not.toHaveBeenCalled();
  await act(async () => tree.unmount()); mockStorage.getItem.mockResolvedValue(null); await render(); await fill();
  const send = action('Pošalji privatnu prijavu').onPress; mockFocused = false; await act(async () => tree.update(page()));
  await act(async () => send()); expect(mockSafety.report).not.toHaveBeenCalled();
});
it('a grey send button carries its reason until a category and a short reason are given', async () => {
  // The reason is the button's own (V2Action draws it under the button and speaks it as the hint), as on the support screens.
  await render(); expect(action('Pošalji privatnu prijavu').disabled).toBe(true);
  expect(action('Pošalji privatnu prijavu').reason).toBe('Izaberi kategoriju i upiši kratak razlog da bi slanje bilo dostupno.');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Uznemiravanje' }).props.onPress());
  expect(action('Pošalji privatnu prijavu').reason).toBe('Upiši kratak razlog da bi slanje bilo dostupno.');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Kratak razlog privatne prijave' }).props.onChangeText('Privatan razlog'));
  expect(action('Pošalji privatnu prijavu').disabled).toBe(false); expect(action('Pošalji privatnu prijavu').reason).toBeNull();
  expect(mockSafety.report).not.toHaveBeenCalled();
});
it('while the earlier report is being looked up the send is grey and says so; while it sends it keeps its words with a spinner', async () => {
  let release!: (value: unknown) => void; mockStorage.getItem.mockReturnValue(new Promise(resolve => { release = resolve; }));
  await render(); expect(action('Pošalji privatnu prijavu')).toMatchObject({ disabled: true, reason: 'Proveravamo prijavu…' });
  await act(async () => release(null));
  await fill(); let finish!: (value: unknown) => void; mockSafety.report.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await act(async () => { void action('Pošalji privatnu prijavu').onPress(); });
  expect(action('Pošalji privatnu prijavu')).toMatchObject({ loading: true, disabled: true });
  await act(async () => finish({ ok: true, podatak: receipt() }));
});
it('the report ends in a state of its own: the form is gone, the receipt says what happened and when, with the one way to a new report', async () => {
  mockSafety.report.mockResolvedValue({ ok: true, podatak: receipt() });
  await render(); await fill(); await act(async () => action('Pošalji privatnu prijavu').onPress());
  expect(copy()).toContain('Prijava je primljena.'); expect(copy()).toContain('Primljeno:');
  expect(tree.root.findAllByProps({ accessibilityRole: 'radio' })).toHaveLength(0); expect(tree.root.findAllByProps({ accessibilityLabel: 'Dodatni privatni opis' })).toHaveLength(0);
  expect(action('Nova privatna prijava')).toBeDefined(); expect(tree.root.findAllByProps({ label: 'Pošalji privatnu prijavu' })).toHaveLength(0);
  // News this visit is a fresh mark; the same receipt restored from an earlier visit is a still one.
  expect(tree.root.findByType(SuccessMark).props.fresh).toBe(true);
  await act(async () => tree.unmount());
  mockStorage.getItem.mockResolvedValue(K); mockSafety.readReportCommand.mockResolvedValue({ ok: true, podatak: { found: true, receipt: receipt() } });
  await render(); expect(tree.root.findByType(SuccessMark).props.fresh).toBe(false);
});
it('checks account again after pending local persistence before network I/O', async () => {
  let resolve!: () => void; mockStorage.setItem.mockImplementation(() => new Promise<void>(r => { resolve = r; }));
  await render(); await fill(); await act(async () => action('Pošalji privatnu prijavu').onPress());
  mockSession = { user: { id: B }, accountRevision: 2 }; await act(async () => resolve()); expect(mockSafety.report).not.toHaveBeenCalled();
});
// UI/UX pass 2026-10-07: the first read of the block is a skeleton; a read the screen does again keeps the state and the action on screen.
it('the first read of the block is a skeleton of what will stand there, and a read again keeps the state with the action grey and its reason', async () => {
  let first!: (value: unknown) => void; mockSafety.readBlock.mockReturnValueOnce(new Promise(resolve => { first = resolve; }));
  await render();
  expect(copy()).toContain('Proveravamo blokiranje…'); expect(tree.root.findAllByProps({ label: 'Blokiraj osobu' })).toHaveLength(0);
  await act(async () => first({ ok: true, podatak: { accountId: A, targetAccountId: B, blocked: false, revision: 0, authoritative: true } }));
  expect(action('Blokiraj osobu')).toMatchObject({ disabled: false, reason: null }); expect(copy()).not.toContain('Proveravamo blokiranje…');
  let again!: (value: unknown) => void; mockSafety.readBlock.mockReturnValueOnce(new Promise(resolve => { again = resolve; }));
  mockFocused = false; await update(); mockFocused = true; await update();
  expect(copy()).toContain('Osoba nije blokirana.'); expect(copy()).not.toContain('Proveravamo blokiranje…');
  expect(action('Blokiraj osobu')).toMatchObject({ disabled: true, reason: 'Proveravamo blokiranje…' });
  await act(async () => again({ ok: true, podatak: { accountId: A, targetAccountId: B, blocked: false, revision: 0, authoritative: true } }));
  expect(action('Blokiraj osobu')).toMatchObject({ disabled: false, reason: null });
});
it('a failed read of the block says what happened and has one way to look again; the screen around it stays', async () => {
  mockSafety.readBlock.mockResolvedValue({ ok: false, kod: 'BLOCK_READ_UNAVAILABLE', poruka: 'Podaci trenutno nisu dostupni. Proveri vezu i pokušaj ponovo.' });
  await render();
  expect(copy()).toContain('Podaci trenutno nisu dostupni. Proveri vezu i pokušaj ponovo.'); expect(action('Proveri blokiranje')).toBeDefined();
  expect(tree.root.findAllByProps({ label: 'Blokiraj osobu' })).toHaveLength(0);
  // The report below it is still a whole form.
  expect(tree.root.findAllByProps({ accessibilityRole: 'radio' })).toHaveLength(5);
});
