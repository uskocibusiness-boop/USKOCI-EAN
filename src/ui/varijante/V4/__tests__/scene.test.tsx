import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The V4 variants route (`app/dizajn-var-V4`): every scene it lists draws from fixtures without reading or writing anything, the
 * frozen frames included, and the list of scenes is reachable without a scene. A smoke test, one per route (zadatak §7).
 */
let mockScene: string | undefined;
const mockSetParams = jest.fn();
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args) }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web', select: (options: Record<string, unknown>) => options.web ?? options.default };
    if (key === 'useWindowDimensions') return () => ({ width: 361, height: 780, scale: 2, fontScale: 1 });
    if (key === 'FlatList') return ({ data, renderItem, ListEmptyComponent, ...props }: any) => require('react').createElement('List', props,
      data.length ? data.map((item: any, index: number) => require('react').createElement(require('react').Fragment, { key: item.id ?? index }, renderItem({ item, index }))) : ListEmptyComponent);
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'RefreshControl', 'Modal', 'Switch'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci.app.dev' } } }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn(), setParams: (...a: unknown[]) => mockSetParams(...a) },
  useLocalSearchParams: () => ({ scene: mockScene }),
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../../Text', () => ({ T: 'T' }));
jest.mock('../../../Press', () => ({ Press: 'Press' }));
jest.mock('../../../system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../../system/haptics', () => ({ tick: jest.fn(), forgetTicks: jest.fn() }));
jest.mock('../../../InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../../media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto', NeedPhotos: 'NeedPhotos' }));
jest.mock('../../../location/ResolvedPinMap', () => ({ ResolvedPinMap: 'ResolvedPinMap' }));
// The Pregled of the Dogovor reaches the private-location module, which reaches the client module; the scenes call nothing on it.
const mockClient = jest.fn(() => { throw new Error('The lab must not reach the data layer.'); });
jest.mock('../../../../data/supabaseClient', () => ({ supabaseKonfigurisan: () => false, supabaseKlijent: (...a: unknown[]) => (mockClient as (...args: unknown[]) => unknown)(...a) }));

import DizajnVarV4 from '../../../../app/dizajn-var-V4';
import { EKRANI, SCENES } from '../scenes';

let tree: ReactTestRenderer;
const open = async (scene?: string) => { mockScene = scene; await act(async () => { tree = create(<DizajnVarV4 />); }); };
const text = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
afterEach(async () => { if (tree) await act(async () => tree.unmount()); mockScene = undefined; });

it('has seven screens, each with "sada" and the three variants', () => {
  expect(EKRANI.map(ekran => ekran.id)).toEqual(['lista', 'detalj', 'potvrdjeno', 'ocena', 'sacuvano', 'profil', 'javni']);
  for (const ekran of EKRANI) for (const variant of ['sada', 'A', 'B', 'C']) {
    expect([ekran.id, variant, ekran.scenes.some(scene => scene.key === `${ekran.id}-${variant}`)]).toEqual([ekran.id, variant, true]);
  }
  expect(new Set(SCENES.map(scene => scene.key)).size).toBe(SCENES.length);
});

it('lists every scene as a link when no scene is asked for, and nothing is read', async () => {
  await open();
  const labels = tree.root.findAll(node => String(node.type) === 'Press').map(node => String(node.props.accessibilityLabel));
  for (const ekran of EKRANI) for (const scene of ekran.scenes) expect(labels).toContain(`${ekran.naziv}: ${scene.naziv}`);
  expect(mockClient).not.toHaveBeenCalled();
});

it.each(SCENES.map(scene => scene.key))('draws the scene "%s" without reading or writing anything', async key => {
  await open(key);
  expect(text().length).toBeGreaterThan(0);
  expect(mockClient).not.toHaveBeenCalled();
});

it('an unknown scene falls back to the list', async () => {
  await open('nema-takve');
  expect(text()).toContain('Varijante V4');
});
