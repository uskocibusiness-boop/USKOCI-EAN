import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * EX-07 S06 flag OFF: this baseline was recorded before the displayed-name client. It still asserts that a build without
 * EXPO_PUBLIC_EX07_SAFETY_TARGET_NAME uses the same service methods, never reads a safety target, and adds no target-name UI.
 * The 2026-10-03 approved safety presentation adds five decorative radio markers in every state. Snapshots explicitly include
 * those markers; all previous text, controls, block/read-error states and flag-off behavior remain checked without filtering.
 * UI/UX pass 2026-10-08 (F6) re-recorded the three snapshots: the blocks are named by the system's section (a `title` instead of a text
 * line) and two sentences follow the text revision ("Izaberi vrstu prijave i upiši kratak razlog.", one sentence about who receives the
 * report). The same 27 words, controls and states are drawn, and the flag-off behaviour is asserted exactly as before.
 */
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', K = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const P = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
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

let tree: ReactTestRenderer;
const props = () => ({ targetAccountId: B, needId: null, agreementId: null });
const render = async (extra: Record<string, unknown> = {}) => { await act(async () => { tree = create(<SafetyScreen {...props()} {...extra} />); }); await act(async () => {}); };
/** The tree as drawn, without the styles and without anything that is a function or an element: what a person could tell apart. */
const isElement = (value: unknown) => !!value && typeof value === 'object' && /react\.(?:transitional\.)?element/.test(String((value as { $$typeof?: symbol }).$$typeof));
const structure = () => JSON.stringify(tree.toJSON(), (key, value) => key === 'style' ? undefined : isElement(value) ? '[element]' : value, 1);

beforeEach(() => {
  delete process.env.EXPO_PUBLIC_EX07_SAFETY_TARGET_NAME;
  jest.clearAllMocks(); for (const f of Object.values(mockStorage)) f.mockReset(); for (const f of Object.values(mockSafety)) f.mockReset();
  mockSession = { user: { id: A }, accountRevision: 1 };
  mockStorage.getItem.mockResolvedValue(null); mockStorage.setItem.mockResolvedValue(undefined); mockStorage.removeItem.mockResolvedValue(undefined);
  mockSafety.readBlock.mockImplementation(async (targetAccountId: string) => ({ ok: true,
    podatak: { accountId: A, targetAccountId, blocked: false, revision: 0, authoritative: true } }));
  mockSafety.readReportCommand.mockResolvedValue({ ok: true, podatak: { found: false, receipt: null } });
  mockSafety.readTarget.mockResolvedValue({ ok: true, podatak: { profileId: P, available: true, displayName: 'Marko Petrovic',
    target: { accountId: A, targetAccountId: B, blocked: false, revision: 0, authoritative: true } } });
});
afterEach(async () => { await act(async () => tree?.unmount()); delete process.env.EXPO_PUBLIC_EX07_SAFETY_TARGET_NAME; });

it('draws the screen as before for a person who is not blocked', async () => {
  await render();
  expect(structure()).toMatchSnapshot();
  expect(mockSafety.readBlock.mock.calls).toEqual([[B]]);
  expect(mockSafety.readTarget).not.toHaveBeenCalled();
});

it('draws the screen as before for a blocked person', async () => {
  mockSafety.readBlock.mockResolvedValue({ ok: true, podatak: { accountId: A, targetAccountId: B, blocked: true, revision: 4, authoritative: true } });
  await render();
  expect(structure()).toMatchSnapshot();
  expect(mockSafety.readTarget).not.toHaveBeenCalled();
});

it('draws the screen as before when the read of the block failed', async () => {
  mockSafety.readBlock.mockResolvedValue({ ok: false, kod: 'BLOCK_READ_UNAVAILABLE', poruka: 'Podaci trenutno nisu dostupni. Proveri vezu i pokušaj ponovo.' });
  await render();
  expect(structure()).toMatchSnapshot();
  expect(mockSafety.readTarget).not.toHaveBeenCalled();
});

it('ignores a profile it is handed while the flag is off: same tree, no safety target read', async () => {
  await render();
  const without = structure();
  await act(async () => tree.unmount());
  await render({ profileId: P });
  expect(structure()).toBe(without);
  expect(mockSafety.readTarget).not.toHaveBeenCalled();
});

it.each(['0', 'true', 'on', ' 1', '1 ', ''])('stays off for the flag value %p', async value => {
  process.env.EXPO_PUBLIC_EX07_SAFETY_TARGET_NAME = value;
  await render({ profileId: P });
  expect(mockSafety.readTarget).not.toHaveBeenCalled();
});
