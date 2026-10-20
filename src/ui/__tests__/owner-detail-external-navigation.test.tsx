import React, { useSyncExternalStore } from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockLinks = new Set<(event: { url: string }) => void>();
let mockReady = true;
const mockReadiness = new Set<() => void>();
let mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get: (target, key) => key === 'useWindowDimensions' ? () => mockWindow : Reflect.get(target, key) });
});
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-linking', () => ({
  ...jest.requireActual('expo-linking'),
  createURL: (path: string) => 'uskociapp://' + path,
  resolveScheme: () => 'uskociapp',
  addEventListener: (_event: string, callback: (event: { url: string }) => void) => {
    mockLinks.add(callback);
    return { remove: () => mockLinks.delete(callback) };
  },
}));
jest.mock('../Press', () => {
  const React = require('react'); const { Pressable } = require('react-native');
  return { Press: (props: object) => React.createElement(Pressable, props) };
});
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => 'Icon' }));
jest.mock('../system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../hooks/useSystemReducedMotion', () => ({ useSystemReducedMotion: () => false }));
jest.mock('../Text', () => ({ T: 'T' }));

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ExpoRoot, router, Stack, useLocalSearchParams } from 'expo-router';
import { inMemoryContext } from 'expo-router/build/testing-library/context-stubs';
import RealTabsLayout from '../../app/(app)/_layout';

// Match the real root boundary: the private navigator is absent until local session restore completes.
function RootLayout() {
  const ready = useSyncExternalStore(callback => {
    mockReadiness.add(callback); return () => { mockReadiness.delete(callback); };
  }, () => mockReady);
  if (!ready) return <Text>Restoring session</Text>;
  return <Stack initialRouteName="(app)" screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={true}><Stack.Screen name="(app)" /></Stack.Protected>
  </Stack>;
}
const Screen = (name: string) => function Stub() {
  const params = useLocalSearchParams();
  return <Text>{`screen:${name}:${params.id ?? ''}`}</Text>;
};
function names(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap(name => statSync(join(dir, name)).isDirectory()
    ? names(join(dir, name), `${prefix}${name}/`)
    : name.endsWith('.tsx') && name !== '_layout.tsx' ? [`${prefix}${name.slice(0, -4)}`] : []);
}
const routes = inMemoryContext({
  _layout: RootLayout,
  '(app)/_layout': RealTabsLayout,
  ...Object.fromEntries(names(join(__dirname, '../../app/(app)')).map(name => [`(app)/${name}`, Screen(name)])),
});
const NEED = '5657548c-709c-4a2a-a33c-913fe9fa6275';
const detail = `/potrebe/${NEED}/pregled`;
let tree: ReactTestRenderer;
async function settle() { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); }
async function open(path: string) {
  expect(mockLinks.size).toBeGreaterThan(0);
  await act(async () => { for (const callback of [...mockLinks]) callback({ url: `uskociapp://${path.replace(/^\//, '')}` }); });
  await settle();
}
type Nav = { type?: string; index?: number; routes?: { name: string; key: string; params?: { id?: string }; state?: Nav }[];
  history?: { key: string }[] };
function tabState() {
  const find = (state: Nav | undefined): Nav | undefined => !state ? undefined : state.type === 'tab' ? state
    : state.routes?.map(route => find(route.state)).find(Boolean);
  const tabs = find(require('expo-router/build/global-state/store').store.navigationRef.current.getRootState())!;
  return { tabs, focused: tabs.routes![tabs.index!] };
}
function expectDetailFocused() {
  expect(tabState().focused).toMatchObject({ name: 'potrebe/[id]/pregled', params: { id: NEED } });
  const text = tree.root.findAllByType(Text).find(node => node.props.children === `screen:potrebe/[id]/pregled:${NEED}`);
  expect(text).toBeDefined();
  // Actual navigator accessibility ownership, not merely a mounted retained screen.
  for (let node = text?.parent; node; node = node.parent) expect(node.props['aria-hidden']).not.toBe(true);
}
beforeEach(() => {
  mockReady = true; mockLinks.clear(); mockReadiness.clear();
  mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.useRealTimers(); jest.restoreAllMocks();
});
jest.setTimeout(20000);

// This exercises Expo's real external URL subscriber/parser and our actual Tabs layout.
// Jest does not exercise Android native screen attachment or the GPU opacity animation.
test('external repeated owner links retain exact route identity through a width/font change and another tab', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); }); await settle();
  await open(detail);
  const original = tabState().focused;
  expectDetailFocused();
  mockWindow = { ...mockWindow, width: 412, fontScale: 1.3 };
  await act(async () => tree.update(<ExpoRoot context={routes} location="/" />)); await settle();
  await open(detail);
  expect(tabState().focused.key).toBe(original.key);
  expectDetailFocused();
  await open('/zadaci');
  await open(detail);
  expect(tabState().focused).toMatchObject({ key: original.key, name: original.name, params: { id: NEED } });
  expect(tabState().tabs.history?.filter(entry => entry.key === original.key)).toHaveLength(1);
  expectDetailFocused();
  await act(async () => router.back()); await settle();
  expect(tabState().focused.name).toBe('zadaci');
});

test('an external owner link received while session restoration hides the navigator survives its registration', async () => {
  mockReady = false;
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); }); await settle();
  await open(detail);
  await act(async () => { mockReady = true; for (const notify of [...mockReadiness]) notify(); }); await settle();
  expectDetailFocused();
});
