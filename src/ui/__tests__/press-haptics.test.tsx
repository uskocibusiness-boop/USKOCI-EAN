import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Haptics from 'expo-haptics';
import { Press, type HapticKind } from '../Press';
import { forgetTicks } from '../system/haptics';

/**
 * A Press ticks through `system/haptics` (motion pass, M-03), so what it asks the phone for is the wrapper's: the system's own
 * haptic constant on Android, the generators on iOS. WHEN it ticks is unchanged and is `press-reduced-motion.test.tsx`'s: on
 * release, inside `onPress`, or on touch-down where the tick is the change (`hapticOn="in"`). What this adds is the two things the
 * old direct call did not give a tap: the right sensation per platform, and that a haptic engine which refuses (or throws) never
 * costs the person their tap. `scaleTo={1}` keeps the surface a plain Pressable: no animated state is needed to read the ticks.
 */
jest.mock('expo-haptics', () => ({
  __esModule: true,
  ...jest.requireActual('expo-haptics'),
  selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(), performAndroidHapticsAsync: jest.fn(),
}));
let mockOs: 'ios' | 'android' = 'ios';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get: (target, key) => key === 'Platform' ? { ...target.Platform, OS: mockOs } : Reflect.get(target, key) });
});

/** The four recorders the package was replaced by, by name. */
const NAMES = ['selectionAsync', 'impactAsync', 'notificationAsync', 'performAndroidHapticsAsync'] as const;
const mocks = Object.fromEntries(NAMES.map(name => [name, (Haptics as unknown as Record<string, jest.Mock>)[name]])) as Record<typeof NAMES[number], jest.Mock>;
const flush = async () => { for (let turn = 0; turn < 25; turn++) await Promise.resolve(); };
const onPress = jest.fn();
let tree: ReactTestRenderer | undefined;

beforeEach(() => {
  mockOs = 'ios';
  forgetTicks();
  onPress.mockReset();
  for (const mock of Object.values(mocks)) mock.mockReset().mockImplementation(() => Promise.resolve());
});
afterEach(() => { act(() => { tree?.unmount(); tree = undefined; }); });

function draw(props: Partial<React.ComponentProps<typeof Press>> = {}) {
  act(() => { tree = create(<Press accessibilityRole="button" accessibilityLabel="Nastavi" scaleTo={1} onPress={onPress} {...props} />); });
  // The Pressable Press draws is the innermost element that carries the label and an `onPress`: the Press elements above it carry
  // the caller's own props, and the host view below it carries none of them. (React Native's Pressable is a memo, which
  // `findByType` does not see through.)
  const surface = () => tree!.root.findAll(node => node.props.accessibilityLabel === 'Nastavi' && typeof node.props.onPress === 'function').slice(-1)[0];
  return {
    tap: () => act(() => { surface().props.onPress({}); }),
    touchDown: () => act(() => { surface().props.onPressIn({}); }),
  };
}

/** What each kind of tick a Press can be asked for is: iOS's generator and call, and Android's first system constant. */
const KINDS: [Exclude<HapticKind, 'none'>, [keyof typeof mocks, unknown[]], string][] = [
  ['select', ['selectionAsync', []], 'segment-tick'],
  ['light', ['impactAsync', ['light']], 'virtual-key'],
  ['medium', ['impactAsync', ['medium']], 'long-press'],
  ['success', ['notificationAsync', ['success']], 'confirm'],
  ['error', ['notificationAsync', ['error']], 'reject'],
];

describe('a Press ticks through the wrapper', () => {
  it.each(KINDS)('%s on iOS is the generator %j', async (haptic, [name, args]) => {
    const order: string[] = [];
    mocks[name].mockImplementation(() => { order.push('haptic'); return Promise.resolve(); });
    onPress.mockImplementation(() => { order.push('onPress'); });
    draw({ haptic }).tap();
    await flush();
    expect(mocks[name]).toHaveBeenCalledWith(...args);
    expect(mocks.performAndroidHapticsAsync).not.toHaveBeenCalled();
    // The tick comes first and the tap still arrives, once.
    expect(order).toEqual(['haptic', 'onPress']);
  });

  it.each(KINDS.map(([haptic, , constant]) => [haptic, constant] as const))('%s on Android is the system constant %s and no vibrator waveform', async (haptic, constant) => {
    mockOs = 'android';
    draw({ haptic }).tap();
    await flush();
    expect(mocks.performAndroidHapticsAsync.mock.calls).toEqual([[constant]]);
    for (const name of ['selectionAsync', 'impactAsync', 'notificationAsync'] as const) expect(mocks[name]).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a tick on touch-down (the tick is the change) is the same wrapper, with the same constant', async () => {
    mockOs = 'android';
    const press = draw({ haptic: 'select', hapticOn: 'in' });
    press.touchDown();
    expect(mocks.performAndroidHapticsAsync.mock.calls).toEqual([['segment-tick']]);
    press.tap();
    await flush();
    // One tick, not two: the release adds none.
    expect(mocks.performAndroidHapticsAsync).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says nothing for haptic none, on either platform', async () => {
    for (const os of ['ios', 'android'] as const) {
      mockOs = os;
      draw().tap();
      await flush();
      act(() => { tree?.unmount(); tree = undefined; });
    }
    expect(Object.values(mocks).map(mock => mock.mock.calls.length)).toEqual([0, 0, 0, 0]);
    expect(onPress).toHaveBeenCalledTimes(2);
  });
});

describe('a haptic engine that refuses never costs the person their tap', () => {
  const refuse = () => {
    for (const mock of Object.values(mocks)) mock.mockImplementation(() => { throw new Error('A haptics engine is not available on this device'); });
  };

  it.each(['ios', 'android'] as const)('%s: when every call throws, the tap still reaches onPress, once', async os => {
    mockOs = os;
    refuse();
    draw({ haptic: 'success' }).tap();
    await flush();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each(['ios', 'android'] as const)('%s: when every call rejects, the tap still reaches onPress, once', async os => {
    mockOs = os;
    for (const mock of Object.values(mocks)) mock.mockImplementation(() => Promise.reject(new Error('refused')));
    draw({ haptic: 'error' }).tap();
    await flush();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
