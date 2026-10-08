import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * EX-07 S06 flag ON: the safety screen shows the name of the person it is about, and the name comes from the server result of rpc_read_safety_target for the
 * PROFILE the person came from, bound to the target account the route names; it is never read from a route, never logged, never stored and never a reason to
 * stop a safety action. When there is no name the screen is the screen of the flag-off baseline (safety-screen-flag-off-baseline.test.tsx), word for word.
 */
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const P = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', Q = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const NAME = 'EXPO_PUBLIC_EX07_SAFETY_TARGET_NAME';
const PERSON = 'Marko Petrović';
let mockSession = { user: { id: A }, accountRevision: 1 };
const mockStorage = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
const mockSafety = { readBlock: jest.fn(), setBlock: jest.fn(), report: jest.fn(), readReportCommand: jest.fn(), readTarget: jest.fn() };
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (...args: unknown[]) => mockStorage.getItem(...args), setItem: (...args: unknown[]) => mockStorage.setItem(...args), removeItem: (...args: unknown[]) => mockStorage.removeItem(...args),
} }));
jest.mock('../../../data/safetyClientService', () => ({ safetyClientService: {
  readBlock: (...args: unknown[]) => mockSafety.readBlock(...args), setBlock: (...args: unknown[]) => mockSafety.setBlock(...args),
  report: (...args: unknown[]) => mockSafety.report(...args), readReportCommand: (...args: unknown[]) => mockSafety.readReportCommand(...args),
  readTarget: (...args: unknown[]) => mockSafety.readTarget(...args),
}, SAFETY_CATEGORIES: ['HARASSMENT', 'FRAUD', 'UNSAFE_WORK', 'DISCRIMINATION', 'OTHER'] }));
jest.mock('../../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../../lib/idempotencija', () => ({ noviUuidZahtevId: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => effect(), [effect]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  return key === 'View' ? 'View' : key === 'TextInput' ? 'Input' : Reflect.get(target, key);
} }); });
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../settings/SettingsPresentation', () => ({ SettingsScreen: 'Screen', SettingsPanel: 'Panel', SettingsGroup: 'Group', SettingsText: 'T', SettingsAction: 'Action' }));
import { SafetyScreen } from '../SafetyScreen';
import { poruka } from '../../system/Poruka';

let tree: ReactTestRenderer;
type Props = { targetAccountId: string; needId: string | null; agreementId: string | null; profileId?: string };
let mockProps: Props = { targetAccountId: B, needId: null, agreementId: null, profileId: P };
const page = () => <SafetyScreen {...mockProps} />;
const render = async () => { await act(async () => { tree = create(page()); }); await act(async () => {}); };
const update = async () => { await act(async () => tree.update(page())); await act(async () => {}); };
const copy = () => tree.root.findAll(n => String(n.type) === 'T').flatMap(n => n.children.filter(c => typeof c === 'string')).join(' | ');
const nameLines = () => tree.root.findAll(n => String(n.type) === 'T' && n.props.testID === 'safety-target-name').map(n => n.children.join(''));
const action = (label: string) => tree.root.findByProps({ label }).props;
const isElement = (value: unknown) => !!value && typeof value === 'object' && /react\.(?:transitional\.)?element/.test(String((value as { $$typeof?: symbol }).$$typeof));
const structure = () => JSON.stringify(tree.toJSON(), (key, value) => key === 'style' ? undefined : isElement(value) ? '[element]' : value, 1);
const resolved = (over: Record<string, unknown> = {}, target: Record<string, unknown> = {}) => ({ ok: true, podatak: { profileId: P, available: true, displayName: PERSON,
  target: { accountId: A, targetAccountId: B, blocked: false, revision: 0, authoritative: true, ...target }, ...over } });
const deferred = () => { let resolve!: (value: unknown) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

beforeEach(() => {
  process.env[NAME] = '1';
  jest.clearAllMocks(); for (const f of Object.values(mockStorage)) f.mockReset(); for (const f of Object.values(mockSafety)) f.mockReset();
  mockSession = { user: { id: A }, accountRevision: 1 }; mockProps = { targetAccountId: B, needId: null, agreementId: null, profileId: P };
  mockStorage.getItem.mockResolvedValue(null); mockStorage.setItem.mockResolvedValue(undefined); mockStorage.removeItem.mockResolvedValue(undefined);
  mockSafety.readBlock.mockImplementation(async (targetAccountId: string) => ({ ok: true,
    podatak: { accountId: mockSession.user.id, targetAccountId, blocked: false, revision: 0, authoritative: true } }));
  mockSafety.setBlock.mockImplementation(async (command: { targetAccountId: string; blocked: boolean; expectedRevision: number; clientRequestId: string }) => ({ ok: true,
    podatak: { accountId: mockSession.user.id, targetAccountId: command.targetAccountId, blocked: command.blocked, revision: command.expectedRevision + 1,
      clientRequestId: command.clientRequestId, authoritative: true, idempotentReplay: false } }));
  mockSafety.report.mockResolvedValue({ ok: false, kod: 'UNKNOWN', poruka: 'Ishod nije potvrđen.' });
  mockSafety.readReportCommand.mockResolvedValue({ ok: true, podatak: { found: false, receipt: null } });
  mockSafety.readTarget.mockResolvedValue(resolved());
});
afterEach(async () => { await act(async () => tree?.unmount()); delete process.env[NAME]; jest.restoreAllMocks(); poruka.hide(); });

describe('the name comes from the server result for the profile the person came from', () => {
  it('asks the server once for that profile and draws the name it returns above the explanation, beside the unchanged generic copy', async () => {
    await render();
    expect(mockSafety.readTarget.mock.calls).toEqual([[P]]);
    expect(nameLines()).toEqual([PERSON]);
    expect(copy()).toContain('Osoba nije blokirana.');
    // the name is the first thing on the screen, before the sentence that explains the two roles
    const viewport = tree.toJSON() as { type: string; children: Array<{ type: string; children: Array<{ props: { testID?: string; accessibilityRole?: string } }> }> };
    expect(viewport.type).toBe('View');
    expect(viewport.children).toHaveLength(1);
    const drawn = viewport.children[0];
    expect(drawn.type).toBe('Screen');
    expect(drawn.children[0].props.testID).toBe('safety-target-name');
    expect(drawn.children[0].props.accessibilityRole).toBe('header');
  });

  it('draws the name of THE profile that was asked for: another face of the same person has its own', async () => {
    mockProps = { ...mockProps, profileId: Q };
    mockSafety.readTarget.mockResolvedValue(resolved({ profileId: Q, displayName: 'Marko Majstor' }));
    await render();
    expect(mockSafety.readTarget.mock.calls).toEqual([[Q]]);
    expect(nameLines()).toEqual(['Marko Majstor']);
  });

  it('draws no name when the server says the profile belongs to another account than the route names', async () => {
    mockSafety.readTarget.mockResolvedValue(resolved({}, { targetAccountId: C }));
    await render();
    expect(nameLines()).toEqual([]);
    expect(copy()).not.toContain(PERSON);
  });

  it.each([
    ['no target', { ok: true, podatak: { profileId: P, available: false, target: null } }],
    ['a null name', resolved({ displayName: null })],
    ['a missing name', resolved({ displayName: undefined })],
    ['a refusal', { ok: false, kod: 'SAFETY_TARGET_READ_UNAVAILABLE', poruka: 'Podaci trenutno nisu dostupni. Proveri vezu i pokušaj ponovo.' }],
  ])('with %s the screen is the flag-off screen, word for word, and says nothing about the name', async (_label, answer) => {
    mockSafety.readTarget.mockResolvedValue(answer);
    await render();
    const withName = structure();
    await act(async () => tree.unmount());
    delete process.env[NAME]; mockSafety.readTarget.mockClear();
    mockProps = { ...mockProps, profileId: undefined };
    await render();
    expect(withName).toBe(structure());
    expect(mockSafety.readTarget).not.toHaveBeenCalled();
  });

  it('a rejected read draws no name and no error, and the safety actions stay usable', async () => {
    mockSafety.readTarget.mockRejectedValue(new Error('offline'));
    await render();
    expect(nameLines()).toEqual([]);
    expect(tree.root.findAll(n => n.props?.accessibilityRole === 'alert')).toHaveLength(0);
    expect(action('Blokiraj osobu').disabled).toBe(false);
    expect(copy()).toContain('Osoba nije blokirana.');
  });

  it('while the name is still being read the screen is already usable and shows no placeholder', async () => {
    const pending = deferred(); mockSafety.readTarget.mockReturnValue(pending.promise);
    await render();
    expect(nameLines()).toEqual([]);
    expect(action('Blokiraj osobu').disabled).toBe(false);
    await act(async () => { pending.resolve(resolved()); });
    expect(nameLines()).toEqual([PERSON]);
  });
});

describe('nothing is read when there is nothing to read', () => {
  it('without a profile (a Dogovor, the blocked list) the screen asks for no name', async () => {
    mockProps = { targetAccountId: B, needId: null, agreementId: A };
    await render();
    expect(mockSafety.readTarget).not.toHaveBeenCalled();
    expect(nameLines()).toEqual([]);
  });

  it.each(['0', 'true', ''])('with the flag value %p the profile is ignored', async value => {
    process.env[NAME] = value;
    await render();
    expect(mockSafety.readTarget).not.toHaveBeenCalled();
    expect(nameLines()).toEqual([]);
  });
});

describe('a late answer never lands on another screen', () => {
  it('is dropped after the screen is gone', async () => {
    const pending = deferred(); mockSafety.readTarget.mockReturnValue(pending.promise);
    await render();
    await act(async () => tree.unmount());
    await act(async () => { pending.resolve(resolved()); });
    expect(mockSafety.readTarget).toHaveBeenCalledTimes(1);
  });

  it('is dropped after the account changed, and the new account asks again', async () => {
    const first = deferred(); mockSafety.readTarget.mockReturnValueOnce(first.promise).mockResolvedValue(resolved({ displayName: 'Druga Osoba' }));
    await render();
    mockSession = { user: { id: C }, accountRevision: 2 };
    await update();
    expect(mockSafety.readTarget).toHaveBeenCalledTimes(2);
    await act(async () => { first.resolve(resolved()); });
    expect(nameLines()).toEqual(['Druga Osoba']);
    expect(copy()).not.toContain(PERSON);
  });

  it('is dropped after the profile changed, and the new profile is asked for', async () => {
    const first = deferred(); mockSafety.readTarget.mockReturnValueOnce(first.promise).mockResolvedValue(resolved({ profileId: Q, displayName: 'Marko Majstor' }));
    await render();
    mockProps = { ...mockProps, profileId: Q };
    await update();
    expect(mockSafety.readTarget.mock.calls).toEqual([[P], [Q]]);
    await act(async () => { first.resolve(resolved()); });
    expect(nameLines()).toEqual(['Marko Majstor']);
  });

  it('a name read for one profile is forgotten when the next profile has none', async () => {
    mockSafety.readTarget.mockResolvedValueOnce(resolved()).mockResolvedValue(resolved({ profileId: Q, displayName: null }));
    await render();
    expect(nameLines()).toEqual([PERSON]);
    mockProps = { ...mockProps, profileId: Q };
    await update();
    expect(nameLines()).toEqual([]);
  });
});

describe('the name is only drawn', () => {
  it('is never logged, stored, put in a command or handed to the report', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method => jest.spyOn(console, method).mockImplementation(() => {}));
    await render();
    expect(nameLines()).toEqual([PERSON]);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Uznemiravanje' }).props.onPress());
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Kratak razlog privatne prijave' }).props.onChangeText('Privatan razlog'));
    await act(async () => action('Pošalji privatnu prijavu').onPress());
    await act(async () => action('Blokiraj osobu').onPress());
    const confirm = tree.root.findAll(node => String(node.type) === 'Press' && node.props.testID === 'confirm-sheet-confirm')[0];
    await act(async () => confirm.props.onPress());
    expect(mockSafety.report).toHaveBeenCalledTimes(1);
    expect(mockSafety.setBlock).toHaveBeenCalledTimes(1);
    expect(Object.keys(mockSafety.report.mock.calls[0][0]).sort()).toEqual(['agreementId', 'category', 'clientRequestId', 'narrative', 'needId', 'reason', 'targetAccountId']);
    expect(Object.keys(mockSafety.setBlock.mock.calls[0][0]).sort()).toEqual(['blocked', 'clientRequestId', 'expectedRevision', 'targetAccountId']);
    for (const payload of [mockStorage.setItem.mock.calls, mockStorage.removeItem.mock.calls, mockSafety.report.mock.calls, mockSafety.setBlock.mock.calls, ...spies.map(spy => spy.mock.calls)]) {
      expect(JSON.stringify(payload)).not.toMatch(/Marko|Petrovi/);
    }
    expect(JSON.stringify(mockStorage.setItem.mock.calls)).not.toContain(P);
  });

  it('names the person in the block question, and leaves the wording of what follows as it was', async () => {
    await render();
    await act(async () => action('Blokiraj osobu').onPress());
    expect(copy()).toContain(`Blokirati ${PERSON}?`);
    expect(copy()).toContain('Blokiranje zaustavlja običan kontakt i nova povezivanja.');
    expect(mockSafety.readBlock.mock.calls).toEqual([[B]]);
  });

  it('with no name the question is the generic one: "Blokirati osobu?"', async () => {
    mockSafety.readTarget.mockResolvedValue(resolved({ displayName: null }));
    await render();
    await act(async () => action('Blokiraj osobu').onPress());
    expect(copy()).toContain('Blokirati osobu?'); expect(copy()).not.toContain(PERSON);
  });

  it('names the person in the unblock question too', async () => {
    mockSafety.readBlock.mockResolvedValue({ ok: true, podatak: { accountId: A, targetAccountId: B, blocked: true, revision: 3, authoritative: true } });
    await render();
    await act(async () => action('Odblokiraj osobu').onPress());
    expect(copy()).toContain(`Odblokirati ${PERSON}?`);
    expect(mockSafety.setBlock).not.toHaveBeenCalled();
  });

  it('keeps the name on the screen after the person has been blocked from it', async () => {
    await render();
    await act(async () => action('Blokiraj osobu').onPress());
    const confirm = tree.root.findAll(node => String(node.type) === 'Press' && node.props.testID === 'confirm-sheet-confirm')[0];
    await act(async () => confirm.props.onPress());
    expect(copy()).toContain('Osoba je blokirana.');
    expect(nameLines()).toEqual([PERSON]);
    expect(mockSafety.readTarget).toHaveBeenCalledTimes(1);
  });
});
