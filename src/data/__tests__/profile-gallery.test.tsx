import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The internal profile gallery (uskociapp://dizajn-profil): every scene the lead photographs must draw, reachable by its
 * visible name, with a "Nazad" back to the list, and none may read or write anything.
 */
const mockBack = jest.fn();
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args) }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  const MockImage = Object.assign((props: object) => require('react').createElement('Image', props),
    { resolveAssetSource: native.Image.resolveAssetSource });
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    if (key === 'Image') return MockImage;
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Image'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ router: { back: (...a: unknown[]) => mockBack(...a), canGoBack: () => true, replace: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]) }));
// Review of step 9 (2026-09-24): a thrown client alone could not catch a read, because the services turn the throw into an
// error state and the scene still draws. Every call is counted and must stay at zero, and nothing may be stored.
const mockClient = jest.fn(() => { throw new Error('The gallery must not reach the data layer.'); });
const mockStore = { getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}), removeItem: jest.fn(async () => {}) };
jest.mock('../supabaseClient', () => ({
  supabaseKonfigurisan: () => false,
  supabaseKlijent: (...a: unknown[]) => (mockClient as (...args: unknown[]) => unknown)(...a),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (...a: unknown[]) => (mockStore.getItem as (...args: unknown[]) => unknown)(...a),
  setItem: (...a: unknown[]) => (mockStore.setItem as (...args: unknown[]) => unknown)(...a),
  removeItem: (...a: unknown[]) => (mockStore.removeItem as (...args: unknown[]) => unknown)(...a) } }));
const nothingReadOrWritten = () => {
  expect(mockClient).not.toHaveBeenCalled();
  expect(mockStore.setItem).not.toHaveBeenCalled(); expect(mockStore.removeItem).not.toHaveBeenCalled();
};
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'ResolvedPinMap' }));

import Gallery from '../../app/dizajn-profil';

let tree: ReactTestRenderer;
const presses = () => tree.root.findAll(node => String(node.type) === 'Press');
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
afterEach(async () => { await act(async () => tree?.unmount()); });

it('lists every scene by its visible name and draws each one, with Nazad back to the list', async () => {
  await act(async () => { tree = create(<Gallery />); });
  const labels = presses().map(node => node.props.accessibilityLabel as string).filter(label => label.includes(':'));
  expect(labels.length).toBeGreaterThanOrEqual(40);
  for (const label of labels) {
    expect(texts()).toContain(label);
    await act(async () => presses().find(node => node.props.accessibilityLabel === label)!.props.onPress());
    expect(presses().some(node => node.props.accessibilityLabel === 'Nazad na listu scena')).toBe(true);
    expect(texts()).toContain('Nazad');
    await act(async () => presses().find(node => node.props.accessibilityLabel === 'Nazad na listu scena')!.props.onPress());
    expect(presses().some(node => node.props.accessibilityLabel === label)).toBe(true);
  }
  expect(mockBack).not.toHaveBeenCalled();
  nothingReadOrWritten();
  // About fifty scenes in one walk: under the full parallel run this takes longer than the 5 s default.
}, 60_000);

it('a scene edits only its own copy: a free-text vehicle is retained locally and nothing is sent', async () => {
  await act(async () => { tree = create(<Gallery />); });
  await act(async () => presses().find(node => node.props.accessibilityLabel === 'Radni profil: aktivan')!.props.onPress());
  await act(async () => presses().find(node => node.props.accessibilityLabel === 'Izmeni: Vozila')!.props.onPress());
  const input = () => tree.root.findAll(node => String(node.type) === 'TextInput')
    .find(node => node.props.accessibilityLabel === 'Nova stavka: Vozila')!;
  await act(async () => input().props.onChangeText('Automobil'));
  await act(async () => presses().find(node => node.props.accessibilityLabel === 'Dodaj: Vozila')!.props.onPress());
  expect(texts()).toContain('Automobil');
  expect(input().props.value).toBe('');
  await act(async () => presses().find(node => node.props.accessibilityLabel === 'Nazad na listu scena')!.props.onPress());
  await act(async () => presses().find(node => node.props.accessibilityLabel === 'Radni profil: aktivan')!.props.onPress());
  expect(texts()).not.toContain('Automobil');
  nothingReadOrWritten();
});
