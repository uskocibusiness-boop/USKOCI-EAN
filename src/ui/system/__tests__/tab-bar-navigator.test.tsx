import React from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

// The new bar through the REAL Expo Router runtime (UI/UX pass, wave 2, item 2.1): the real `(app)` Tabs layout and the real navigator
// draw `tabBarButton`, `tabBarIcon` and `tabBarLabel`, and the real Press and Text draw the rest. The unit suites hold each part on
// its own (`tab-bar-item.test.tsx`) and the layout's options on their own (`v5-tab-navigation.test.tsx`); this one holds what only the
// navigator can show: where the parts end up, that the navigator draws the icon TWICE (one copy per focus state), and that a change of
// tab reaches the capsule, the icon and the label of the right tab. It is still jest, not a phone: no frame of motion is seen here.
// The router mounts the thirty-eight routes of the `(app)` group: the first render alone takes a few seconds on a busy machine.
jest.setTimeout(60_000);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), createURL: (path: string) => 'uskoci://' + path,
  resolveScheme: () => 'uskoci', addEventListener: () => ({ remove() {} }) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
// The registry is tested separately; this suite follows the requested outline and tone.
jest.mock('../Glyph', () => ({ Glyph: 'Glyph' }));

import * as Haptics from 'expo-haptics';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ExpoRoot, router, Stack } from 'expo-router';
import { inMemoryContext } from 'expo-router/build/testing-library/context-stubs';
import RealTabsLayout from '../../../app/(app)/_layout';
import { TAB_ICON, TAB_POP } from '../TabBarItem';
import { sys } from '../tokens';

function RootLayout() { return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(app)" /></Stack>; }
const Screen = (name: string) => function Stub() { return <Text>{`screen:${name}`}</Text>; };
/** Every route of the real `(app)` group, read from disk, so the navigator holds the positions it has in the app. */
const APP = join(__dirname, '..', '..', '..', 'app', '(app)');
function routeNames(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap(name => statSync(join(dir, name)).isDirectory() ? routeNames(join(dir, name), `${prefix}${name}/`)
    : name.endsWith('.tsx') && name !== '_layout.tsx' ? [`${prefix}${name.slice(0, -4)}`] : []);
}
const routes = inMemoryContext({ _layout: RootLayout, '(app)/_layout': RealTabsLayout,
  ...Object.fromEntries(routeNames(APP).map(name => [`(app)/${name}`, Screen(name)])) });

let tree: ReactTestRenderer;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };
beforeEach(() => { jest.useFakeTimers(); jest.spyOn(console, 'warn').mockImplementation(() => {}); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); jest.mocked(Haptics.selectionAsync).mockClear(); });

const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const hosts = (testID: string) => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === testID);
/** The Press of a tab (our component), by what a screen reader says. */
const tab = (label: string) => tree.root.findAll(node => typeof node.type !== 'string' && node.props.accessibilityRole === 'tab'
  && node.props.accessibilityLabel === label && node.props.scaleTo === 1)[0];
const labels = ['Početna', 'Zadaci', 'Dogovori'];
const opened = async (location: string) => { await act(async () => { tree = create(<ExpoRoot context={routes} location={location} />); }); await settle(); };

describe('the three tabs as the navigator draws them', () => {
  it('puts a capsule, two copies of the icon and a label of the tab variant in each tab, in the order of the bar', async () => {
    await opened('/');
    expect(labels.map(label => tab(label)?.props.accessibilityLabel)).toEqual(labels);
    // One capsule per tab; the navigator draws every icon twice (its cross-fade by focus), so two of ours per tab.
    expect(hosts('tab-capsule')).toHaveLength(3);
    expect(hosts('tab-glyph')).toHaveLength(6);
    // The label is the `tab` variant (14 on 20, 600), in the navigator's own order: Početna, Zadaci, Dogovori.
    const words = tree.root.findAllByType(Text).filter(node => labels.includes(String(node.props.children)));
    expect(words.map(node => node.props.children)).toEqual(labels);
    for (const word of words) expect(flat(word)).toMatchObject({ fontSize: sys.type.navLabel.fontSize, lineHeight: sys.type.navLabel.lineHeight, fontFamily: 'Inter-Medium' });
    // The capsule is a child of each tab's button, drawn before the icon and the label (so they stand on it).
    for (const label of labels) {
      const inside = tab(label)!.findAll(node => typeof node.type === 'string' && ['tab-capsule', 'tab-glyph'].includes(node.props.testID));
      expect(inside.map(node => node.props.testID)).toEqual(['tab-capsule', 'tab-glyph', 'tab-glyph']);
    }
  });

  it('draws the chosen tab with its capsule shown, its brand mark shown and its label in green, and the others at rest, from the first frame', async () => {
    await opened('/');
    const capsuleOpacity = hosts('tab-capsule').map(node => flat(node).opacity);
    expect(capsuleOpacity).toEqual([1, 0, 0]);
    // Both copies of a chosen icon show the brand layer, and both copies of a resting one show the quiet layer.
    const art = hosts('tab-glyph-art').map(node => flat(node).opacity), mark = hosts('tab-glyph-mark').map(node => flat(node).opacity);
    expect(art).toEqual([1, 1, 0, 0, 0, 0]);
    expect(mark).toEqual([0, 0, 1, 1, 1, 1]);
    const words = tree.root.findAllByType(Text).filter(node => labels.includes(String(node.props.children)));
    expect(words.map(node => flat(node).color)).toEqual([sys.color.green, sys.color.muted, sys.color.muted]);
    // Nothing moved to get there.
    expect(tab('Početna')!.props.accessibilityState).toEqual({ selected: true });
  });

  it('draws each tab in the same 24dp outline family with muted and green layers', async () => {
    await opened('/');
    const pictures = tree.root.findAll(node => node.type === ('Glyph' as unknown));
    expect(pictures).toHaveLength(12);
    for (const picture of pictures) expect(picture.props).toMatchObject({ size: TAB_ICON });
    expect(pictures.filter(node => node.props.tone === 'muted')).toHaveLength(6);
    expect(pictures.filter(node => node.props.tone === 'green')).toHaveLength(6);
    expect(['home', 'map', 'agreements'].map(name => pictures.filter(node => node.props.name === name).length)).toEqual([4, 4, 4]);
  });
});

describe('a change of tab', () => {
  it('moves between ordinary root tabs at once for a screen reader, and starts the fade, the cross-fade and one pop on the native driver', async () => {
    await opened('/');
    const timing = jest.spyOn(Animated, 'timing'), sequence = jest.spyOn(Animated, 'sequence');
    await act(async () => router.navigate('/dogovori'));
    await settle();
    // The selected state is the first thing to change and does not wait for a frame of any animation.
    expect(labels.map(label => tab(label)!.props.accessibilityState.selected)).toEqual([false, false, true]);
    // The tab left and the tab entered each fade their capsule (two icons each); only the tab entered pops, once per copy.
    const calls = timing.mock.calls.map(([, config]) => config as { toValue: number; duration: number; useNativeDriver: boolean });
    expect(calls.every(call => call.useNativeDriver === true)).toBe(true);
    expect(calls.filter(call => call.toValue === TAB_POP)).toHaveLength(2);
    expect(sequence).toHaveBeenCalledTimes(2);
    // Fades: the capsule + the two copies of the icon, for the tab entered (to 1) and for the tab left (to 0).
    expect(calls.filter(call => call.toValue === 1 && call.duration === sys.motion.toggle).length).toBeGreaterThanOrEqual(3);
    expect(calls.filter(call => call.toValue === 0 && call.duration === sys.motion.toggle).length).toBeGreaterThanOrEqual(3);
  });

  it('keeps the chosen tab a root of its own: a tap on the tab already chosen starts no animation', async () => {
    await opened('/zadaci');
    const timing = jest.spyOn(Animated, 'timing');
    await act(async () => { tab('Zadaci')!.props.onPress?.({ nativeEvent: {} }); });
    await settle();
    expect(timing).not.toHaveBeenCalled();
    expect(labels.map(label => tab(label)!.props.accessibilityState.selected)).toEqual([false, true, false]);
  });

  it('keeps navigation silent on a cancelled touch, a completed tap and a tap on the selected tab (U10)', async () => {
    await opened('/');
    // Read the handler after Press has processed haptics, below the wrappers that still carry scaleTo.
    const touch = () => tab('Dogovori')!.findAll(node => typeof node.props.onPress === 'function'
      && node.props.scaleTo === undefined).at(-1)!;
    const event = { nativeEvent: {} };
    // A cancelled gesture never commits navigation.
    await act(async () => { touch().props.onPressIn?.(event); touch().props.onPressOut?.(event); });
    expect(tab('Početna')!.props.accessibilityState.selected).toBe(true);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    await act(async () => { touch().props.onPressIn?.(event); touch().props.onPress(event); touch().props.onPressOut?.(event); });
    await settle();
    expect(tab('Dogovori')!.props.accessibilityState.selected).toBe(true);
    await act(async () => { touch().props.onPress(event); });
    await settle();
    expect(tab('Dogovori')!.props.accessibilityState.selected).toBe(true);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});
