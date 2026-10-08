import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * Dostupnost had a standing "Osveži dostupnost" button under the form (plan step 0, 2026-09-23). It is a pull to
 * refresh now, calling the same read; the loaded week stays on screen while it reads instead of being swapped for a
 * loading card, and edits wait until the read is back.
 */
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Modal', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
// Reduced motion is read from the one store (ui/system/motion) since 2026-09-24, no longer from Reanimated.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
// The screen asks before unsaved changes are dropped, and hears the hardware Back while it has focus (owner step 10).
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, []) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: 'owned-account' }, accountRevision: 0 }) }));
jest.mock('../workerAvailabilityClientService', () => ({ workerAvailabilityClientService: { read: jest.fn(), save: jest.fn() } }));
jest.mock('../ownProfileClientService', () => ({ ownProfileClientService: { read: jest.fn() } }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: () => ({ data: null, loading: false, error: false, refresh: jest.fn() }) }));
let mockEditor: Record<string, unknown> = {};
jest.mock('../../hooks/useOwnedEditor', () => ({ useOwnedEditor: () => mockEditor }));
import Dostupnost from '../../app/(app)/profil/dostupnost';

const data = { accountId: 'owned-account', profileId: 'owned-profile', revision: 'a'.repeat(64), timezone: 'Europe/Belgrade',
  availableNow: false, rules: [], windows: [] };
const editor = (patch: Record<string, unknown> = {}) => ({ data, loading: false, busy: false, error: null, uncertain: false, saved: false,
  refresh: jest.fn().mockResolvedValue(undefined), save: jest.fn(), ...patch });
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const labelled = (label: string) => tree.root.findAll(node => node.props.label === label || node.props.accessibilityLabel === label);
const scroll = () => tree.root.findAll(node => node.type === ('ScrollView' as React.ElementType) && node.props.refreshControl)[0];
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

it('offers pull to refresh on the week instead of a standing refresh button, and it calls the same read', async () => {
  mockEditor = editor();
  await act(async () => { tree = create(<Dostupnost />); });
  expect(labelled('Osveži dostupnost')).toHaveLength(0);
  const control = scroll().props.refreshControl;
  expect(control.props.refreshing).toBe(false);
  await act(async () => control.props.onRefresh());
  expect(mockEditor.refresh).toHaveBeenCalledTimes(1);
});

it('keeps the loaded week on screen while it reads again, and holds edits until it is back', async () => {
  mockEditor = editor({ loading: true });
  await act(async () => { tree = create(<Dostupnost />); });
  expect(texts()).not.toContain('Učitavamo sačuvanu dostupnost');
  expect(tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.disabled).toBe(true);
});

// The owner's phone, 8 Oct 2026: a read that starts by itself (the screen came into focus) raised Android's white disc over the top of the week. The spinner is the
// pull's own (`usePullRefresh`): it is up for a read the person pulled, for as long as that read runs, and never for one that started by itself.
it('raises the spinner only for a pull, never for a read the screen started by itself', async () => {
  mockEditor = editor({ loading: true });
  await act(async () => { tree = create(<Dostupnost />); });
  // The read that is running started by itself: edits wait for it, but no spinner is drawn over the week.
  expect(scroll().props.refreshControl.props.refreshing).toBe(false);
  // Pulled while it runs: no second read starts, and the spinner stays for as long as the running read does.
  await act(async () => scroll().props.refreshControl.props.onRefresh());
  expect(mockEditor.refresh).not.toHaveBeenCalled();
  expect(scroll().props.refreshControl.props.refreshing).toBe(true);
  // The read ends: the spinner goes with it.
  mockEditor = editor({ loading: false });
  await act(async () => tree.update(<Dostupnost />));
  expect(scroll().props.refreshControl.props.refreshing).toBe(false);
});

it('shows the loading card only for the first read, with nothing to show yet', async () => {
  mockEditor = editor({ data: null, loading: true });
  await act(async () => { tree = create(<Dostupnost />); });
  expect(texts()).toContain('Učitavamo sačuvanu dostupnost');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Mogu odmah' })).toHaveLength(0);
});

it('does not start a second read while a save is in flight', async () => {
  mockEditor = editor({ busy: true });
  await act(async () => { tree = create(<Dostupnost />); });
  await act(async () => scroll().props.refreshControl.props.onRefresh());
  expect(mockEditor.refresh).not.toHaveBeenCalled();
});
