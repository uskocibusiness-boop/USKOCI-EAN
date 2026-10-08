import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const overrides: Record<string, unknown> = {
    AppState: { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
    StyleSheet: { ...actual.StyleSheet, create: (value: unknown) => value },
    View: 'View',
  };
  return new Proxy(actual, { get: (target, key) => typeof key === 'string' && key in overrides ? overrides[key] : Reflect.get(target, key) });
});
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('../../store/sesija', () => ({
  useSesija: () => ({ user: { id: '10000000-0000-4000-8000-000000000010' }, accountRevision: 7 }),
  sesijaSada: () => ({ user: { id: '10000000-0000-4000-8000-000000000010' }, accountRevision: 7 }),
}));
jest.mock('../../store/uloga', () => {
  const mojePotrebe = jest.fn();
  const source = { mojePotrebe };
  return {
    useIzvor: () => source,
    __testMocks: { mojePotrebe },
  };
});
jest.mock('../needLifecycleClientService', () => {
  const readCommandReceipt = jest.fn();
  const cancelNeed = jest.fn();
  const deleteDraftNeed = jest.fn();
  return {
    ...jest.requireActual('../needLifecycleClientService'),
    needLifecycleClientService: { readCommandReceipt, cancelNeed, deleteDraftNeed },
    __testMocks: { readCommandReceipt, cancelNeed, deleteDraftNeed },
  };
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'V2Action' }));
jest.mock('../../ui/aiFirst/tokens', () => ({
  aiFirst: { color: { line: '#000', ink: '#000', muted: '#000', danger: '#000' } },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NeedLifecycleActions } from '../../ui/needs/NeedLifecycleActions';

const ACCOUNT = '10000000-0000-4000-8000-000000000010';
const NEED = '10000000-0000-4000-8000-000000000011';
const command = Object.freeze({ action: 'DELETE_DRAFT' as const, needId: NEED, expectedRevision: 4, reason: '' });
const serviceMocks = (jest.requireMock('../needLifecycleClientService') as {
  __testMocks: { readCommandReceipt: jest.Mock; cancelNeed: jest.Mock; deleteDraftNeed: jest.Mock };
}).__testMocks;
const { mojePotrebe } = (jest.requireMock('../../store/uloga') as { __testMocks: { mojePotrebe: jest.Mock } }).__testMocks;
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

let tree: ReactTestRenderer | undefined;
const actions = () => tree!.root.findAll(node => String(node.type) === 'V2Action');
const text = () => tree!.root.findAll(node => String(node.type) === 'T')
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
async function render() {
  const active = jest.fn();
  await act(async () => {
    // The screen's "···" handle (review of step 5b, 2026-09-24): the inline placement this suite used was retired, and
    // recovery without the Need row runs the same way in the placement the app uses.
    tree = create(<NeedLifecycleActions need={null} needId={NEED} disabled={false}
      onActiveChange={active} onRefresh={jest.fn()} menu={{ current: null }} />);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  });
  return active;
}

beforeEach(() => {
  jest.clearAllMocks();
  storage.getItem.mockResolvedValue(JSON.stringify(command));
  storage.setItem.mockResolvedValue();
  storage.removeItem.mockResolvedValue();
  mojePotrebe.mockResolvedValue([]);
});
afterEach(async () => { await act(async () => { tree?.unmount(); }); tree = undefined; });

describe('PKG-004 lifecycle recovery without the Need row', () => {
  it('reconciles a lost DELETE acknowledgement from the original persisted command after the row disappeared', async () => {
    serviceMocks.readCommandReceipt.mockResolvedValue({
      ok: true,
      podatak: { state: 'CONFIRMED', confirmation: { action: 'DELETE_DRAFT', receipt: {
        needId: NEED, revision: 4, deleted: true, idempotentReplay: true,
      } } },
    });

    const active = await render();

    expect(storage.getItem).toHaveBeenCalledWith(`uskoci:need-lifecycle:v5:${ACCOUNT}:${NEED}`);
    expect(serviceMocks.readCommandReceipt).toHaveBeenCalledWith(command);
    expect(serviceMocks.deleteDraftNeed).not.toHaveBeenCalled();
    expect(serviceMocks.cancelNeed).not.toHaveBeenCalled();
    expect(mojePotrebe).toHaveBeenCalledTimes(1);
    // The outcome in plain words since the review of step 5b (no "server" wording); the confirmed receipt is the same.
    expect(text()).toContain('Nacrt je obrisan.');
    expect(actions().some(node => node.props.label === 'Moji zadaci')).toBe(true);
    expect(active).toHaveBeenLastCalledWith(true);
  });

  it('keeps NOT_CONFIRMED uncertain and never auto-replays a destructive command', async () => {
    serviceMocks.readCommandReceipt.mockResolvedValue({ ok: true, podatak: { state: 'NOT_CONFIRMED' } });

    await render();

    expect(serviceMocks.readCommandReceipt).toHaveBeenCalledWith(command);
    expect(serviceMocks.deleteDraftNeed).not.toHaveBeenCalled();
    expect(serviceMocks.cancelNeed).not.toHaveBeenCalled();
    expect(mojePotrebe).not.toHaveBeenCalled();
    expect(text()).toContain('Ne znamo da li je radnja uspela');
    const retry = actions().find(node => node.props.label === 'Pošalji ponovo');
    expect(retry).toBeDefined();
    expect(retry?.props.disabled).toBe(false);
  });
});
