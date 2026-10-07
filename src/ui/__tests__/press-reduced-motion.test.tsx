import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { Press, PRESS_DELAY, pressDelayFor, type HapticKind } from '../Press';
import { Segmented } from '../system/Segmented';
import { forgetTicks } from '../system/haptics';
import { useReducedMotionRoot } from '../system/motion';
import { sys } from '../system/tokens';
import { usePressLift } from '../system/usePressLift';

/**
 * Press is every tap in the app. Under reduced motion the surface must not scale at all — the press still happens,
 * only the movement goes — and it must follow the setting while the app is open, because it reads the one store
 * (ui/system/motion) that the root keeps current, not a value frozen at launch.
 *
 * UI/UX pass 2026-10-02 (audit MO-M4, MO-M5): a haptic is an OUTCOME, not a touch. It fires when a tap completes, inside
 * `onPress`; a finger that lands on a card and turns into a scroll ticks nothing and shows no shrink. The tick belongs on
 * touch-down only where it IS the change (`hapticOn="in"`: a segment, a switch). A surface that does not scale
 * (`scaleTo === 1`) is a plain Pressable with no shared value. The touches below go through the real Pressability state
 * machine (grant, release, terminate), with fake timers, so the delay and the cancel are the ones the phone has.
 */

const mockSet = jest.fn();
const mockTiming = jest.fn((value: number, _config?: unknown) => ({ timing: value }));
const mockSpring = jest.fn((value: number, _config?: unknown) => ({ spring: value }));
const mockSharedValue = jest.fn();
const mockAnimatedStyle = jest.fn();
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
  useSharedValue: () => { mockSharedValue(); return { get: () => 1, set: (value: unknown) => mockSet(value) }; },
  useAnimatedStyle: () => { mockAnimatedStyle(); return {}; },
  withTiming: (value: number, config?: unknown) => mockTiming(value, config),
  withSpring: (value: number, config?: unknown) => mockSpring(value, config),
  Easing: { bezier: () => 'ease-out' },
  ReduceMotion: { System: 'system' },
}));

/** One entry per tick, named by what it is: the call itself says which kind of haptic fired. */
const mockHaptic = jest.fn();
jest.mock('expo-haptics', () => ({
  selectionAsync: () => mockHaptic('select'),
  impactAsync: (style: string) => mockHaptic(style),
  notificationAsync: (type: string) => mockHaptic(type),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('../Text', () => ({ T: 'T' }));

let mockPreference: ((value: boolean) => void) | undefined;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AccessibilityInfo') return {
      isReduceMotionEnabled: () => new Promise<boolean>(() => {}),
      addEventListener: (_name: string, callback: (value: boolean) => void) => { mockPreference = callback; return { remove: () => { mockPreference = undefined; } }; },
    };
    if (key === 'AppState') return { addEventListener: () => ({ remove: () => undefined }) };
    return Reflect.get(target, key);
  } });
});

function Root({ children }: { children: React.ReactNode }) {
  useReducedMotionRoot(false);
  return <>{children}</>;
}

const onPressIn = jest.fn(), onPressOut = jest.fn(), onPress = jest.fn(), onLongPress = jest.fn(), change = jest.fn();
let tree: ReactTestRenderer | undefined;
type PressProps = React.ComponentProps<typeof Press>;
function render(props: Partial<PressProps> = {}) {
  act(() => {
    tree = create(<Root><Press accessibilityRole="button" accessibilityLabel="Nastavi" scaleTo={0.9}
      onPressIn={onPressIn} onPressOut={onPressOut} {...props} /></Root>);
  });
}
/** The pressable surface Press draws (Reanimated's wrapper is the plain Pressable here), not the Press element itself. */
const surface = (): ReactTestInstance => tree!.root.findAll(node => node.props.accessibilityLabel === 'Nastavi'
  && typeof node.props.onPressIn === 'function' && node.props.onPressIn !== onPressIn)[0];
function reduceMotion(value: boolean) { act(() => { mockPreference!(value); }); }
function press() {
  act(() => { surface().props.onPressIn({}); });
  act(() => { surface().props.onPressOut({}); });
}

/** A finger on the surface, through the real Pressability: the responder events the native side sends. */
const touchEvent = () => ({ persist: () => undefined, currentTarget: 1, target: 1, nativeEvent: { pageX: 10, pageY: 10, timestamp: 1, touches: [] } });
const responder = (label: string): ReactTestInstance =>
  tree!.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onResponderGrant === 'function')[0];
function finger(label = 'Nastavi') {
  return {
    down: () => act(() => { responder(label).props.onResponderGrant(touchEvent()); }),
    release: () => act(() => { responder(label).props.onResponderRelease(touchEvent()); }),
    /** The scroll takes the gesture, or the finger is lifted away: the responder is terminated, not released. */
    cancel: () => act(() => { responder(label).props.onResponderTerminate(touchEvent()); }),
    wait: (ms: number) => act(() => { jest.advanceTimersByTime(ms); }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // An implementation given by one test must not reach the next.
  mockHaptic.mockReset(); onPress.mockReset(); onLongPress.mockReset(); change.mockReset();
  jest.useFakeTimers();
  // The ticks go through the haptics wrapper, which holds two ticks closer than `sys.motion.tickGap` to one. Each test starts a
  // fake clock of its own, so the last tick of the test before must not hold back the first tick of this one.
  forgetTicks();
});
afterEach(() => { act(() => { tree?.unmount(); tree = undefined; }); jest.useRealTimers(); });

it('does not scale under reduced motion; the press itself still happens', () => {
  render(); reduceMotion(true);
  press();
  expect(mockTiming).not.toHaveBeenCalled();
  expect(mockSpring).not.toHaveBeenCalled();
  // The only write puts the surface back at rest, instantly.
  expect(mockSet.mock.calls).toEqual([[1]]);
  expect(onPressIn).toHaveBeenCalledTimes(1);
  expect(onPressOut).toHaveBeenCalledTimes(1);
});

it('scales on the press duration and springs back when motion is allowed', () => {
  render();
  press();
  expect(mockTiming).toHaveBeenCalledWith(0.9, expect.objectContaining({ duration: sys.motion.press }));
  expect(mockSpring).toHaveBeenCalledWith(1, expect.objectContaining(sys.motion.spring));
  expect(mockSet.mock.calls).toEqual([[{ timing: 0.9 }], [{ spring: 1 }]]);
});

it('follows the setting while the app is open: turning motion off stops the next press from scaling', () => {
  render();
  press(); expect(mockTiming).toHaveBeenCalledTimes(1);
  reduceMotion(true); jest.clearAllMocks();
  press(); expect(mockTiming).not.toHaveBeenCalled(); expect(mockSet.mock.calls).toEqual([[1]]);
  reduceMotion(false); jest.clearAllMocks();
  press(); expect(mockTiming).toHaveBeenCalledTimes(1);
});

it('takes its default give from the press-scale ladder, not from a number of its own', () => {
  render({ scaleTo: undefined });
  press();
  expect(sys.motion.pressScale).toBe(sys.motion.scale.button);
  expect(mockTiming).toHaveBeenCalledWith(sys.motion.pressScale, expect.anything());
  expect(mockTiming).toHaveBeenCalledWith(sys.motion.scale.button, expect.anything());
});

describe('the haptic is an outcome: it fires when a tap completes, inside onPress', () => {
  it('fires once on release, before the caller\'s own onPress, and never on touch-down', () => {
    const order: string[] = [];
    mockHaptic.mockImplementation(kind => order.push(`haptic:${kind}`));
    onPress.mockImplementation(() => order.push('onPress'));
    render({ haptic: 'select', onPress });
    const f = finger();
    f.down(); f.wait(PRESS_DELAY + 50);
    expect(mockHaptic).not.toHaveBeenCalled();
    f.release(); f.wait(200);
    expect(order).toEqual(['haptic:select', 'onPress']);
  });

  it('keeps every kind of haptic reachable: select, light, medium, success and error', () => {
    const kinds: [HapticKind, string][] = [['select', 'select'], ['light', 'light'], ['medium', 'medium'], ['success', 'success'], ['error', 'error']];
    for (const [haptic, expected] of kinds) {
      mockHaptic.mockClear();
      render({ haptic, onPress });
      const f = finger();
      f.down(); f.release(); f.wait(200);
      expect(mockHaptic.mock.calls).toEqual([[expected]]);
      act(() => { tree!.unmount(); tree = undefined; });
    }
  });

  it('says nothing for haptic none, and hands the caller\'s onPress through untouched', () => {
    render({ onPress });
    expect(surface().props.onPress).toBe(onPress);
    const f = finger();
    f.down(); f.release(); f.wait(200);
    expect(mockHaptic).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a tap on a surface that has no onPress does nothing, so it ticks nothing; its long press is what ticks (a chat bubble)', () => {
    render({ haptic: 'select', onLongPress });
    const f = finger();
    f.down(); f.release(); f.wait(200);
    expect(mockHaptic).not.toHaveBeenCalled();
    f.down(); f.wait(700); f.release(); f.wait(200);
    expect(mockHaptic.mock.calls).toEqual([['select']]);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('a touch that turns into a scroll before the delay fires nothing and does not shrink', () => {
    render({ haptic: 'select', onPress, scaleTo: sys.motion.scale.row });
    const f = finger();
    f.down();
    // Nothing has moved at touch-down: the give waits for the delay.
    expect(mockTiming).not.toHaveBeenCalled();
    f.wait(PRESS_DELAY - 20);
    f.cancel(); // the list takes the gesture
    f.wait(500);
    expect(mockHaptic).not.toHaveBeenCalled();
    expect(mockTiming).not.toHaveBeenCalled();
    expect(mockSpring).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
    expect(onPressIn).not.toHaveBeenCalled();
    expect(onPressOut).not.toHaveBeenCalled();
  });

  it('a slower drag that starts to shrink and is then taken by a scroll still ticks nothing, and the surface returns', () => {
    render({ haptic: 'select', onPress, scaleTo: sys.motion.scale.row });
    const f = finger();
    f.down(); f.wait(PRESS_DELAY + 20);
    expect(mockTiming).toHaveBeenCalledTimes(1);
    f.cancel(); f.wait(300);
    expect(mockHaptic).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
    expect(mockSet.mock.calls[mockSet.mock.calls.length - 1]).toEqual([{ spring: 1 }]);
  });

  it('a quick tap is not dead: it shrinks, ticks once on release and presses once', () => {
    render({ haptic: 'select', onPress, scaleTo: sys.motion.scale.row });
    const f = finger();
    f.down(); f.wait(10); // released before the delay has passed
    f.release();
    expect(mockHaptic.mock.calls).toEqual([['select']]);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(mockTiming).toHaveBeenCalledTimes(1);
    f.wait(300);
    expect(onPressOut).toHaveBeenCalledTimes(1);
    expect(mockSpring).toHaveBeenCalledTimes(1);
  });

  it('a long press ticks when it happens (the press is cancelled by it), not on the release after it', () => {
    render({ haptic: 'light', onPress, onLongPress });
    const f = finger();
    f.down(); f.wait(700);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(mockHaptic.mock.calls).toEqual([['light']]);
    f.release(); f.wait(200);
    expect(onPress).not.toHaveBeenCalled();
    expect(mockHaptic).toHaveBeenCalledTimes(1);
  });

  it('keeps ticking under reduced motion: a tick is not movement', () => {
    render({ haptic: 'select', onPress }); reduceMotion(true);
    const f = finger();
    f.down(); f.release(); f.wait(300);
    expect(mockHaptic.mock.calls).toEqual([['select']]);
    expect(mockTiming).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

// Wave-1 review, minor (g): the 60 ms delay was on EVERY Press that did not tick on touch-down, buttons and sheet commands included,
// far from any scroll; a deliberate tap on them began to give 60 ms late. The delay is for a surface in a scrolling list: a row or
// a card (the row rung of the ladder and above, and a surface that does not give itself, which is how a card's body is drawn).
describe('the delay belongs to a row in a list, not to a button', () => {
  it('names the surfaces: a button rung and below gives at once, the row rung and above waits', () => {
    expect([undefined, 0.9, 0.94, sys.motion.scale.button, 0.975].map(pressDelayFor)).toEqual([0, 0, 0, 0, 0]);
    expect([0.98, 0.985, sys.motion.scale.row, 0.986, 0.99, 1].map(pressDelayFor)).toEqual(Array(6).fill(PRESS_DELAY));
    expect(PRESS_DELAY).toBeLessThanOrEqual(60);
  });

  it.each([['the default (a button)', undefined], ['the button rung', sys.motion.scale.button], ['a stronger button', 0.9]])(
    '%s gives the instant the finger lands, and ticks on release', (_name, scaleTo) => {
      render({ scaleTo, haptic: 'select', onPress });
      const f = finger();
      f.down();
      expect(mockTiming).toHaveBeenCalledTimes(1);
      expect(onPressIn).toHaveBeenCalledTimes(1);
      expect(mockHaptic).not.toHaveBeenCalled();
      f.release(); f.wait(200);
      expect(mockHaptic.mock.calls).toEqual([['select']]);
    });

  it.each([['the row rung', sys.motion.scale.row], ['a row at 0.99', 0.99], ['a row at 0.98', 0.98]])(
    '%s waits for the delay before it gives, so a finger that is about to scroll shrinks nothing', (_name, scaleTo) => {
      render({ scaleTo, onPress });
      const f = finger();
      f.down();
      expect(mockTiming).not.toHaveBeenCalled();
      f.wait(PRESS_DELAY - 10);
      expect(mockTiming).not.toHaveBeenCalled();
      f.wait(20);
      expect(mockTiming).toHaveBeenCalledTimes(1);
    });

  it('a card body that does not give itself (scaleTo 1) delays what the card above it gives on: onPressIn arrives after the delay', () => {
    render({ scaleTo: 1, onPress });
    const f = finger();
    f.down();
    expect(onPressIn).not.toHaveBeenCalled();
    f.wait(PRESS_DELAY + 5);
    expect(onPressIn).toHaveBeenCalledTimes(1);
  });

  it('a sheet command or a button that is tapped quickly gives and settles before a row would even have begun', () => {
    render({ onPress });
    const f = finger();
    f.down(); f.wait(10); f.release(); f.wait(300);
    expect(mockTiming).toHaveBeenCalledTimes(1);
    expect(mockSpring).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('hapticOn="in": the tick is the change, so it is on touch-down', () => {
  it('ticks the moment the finger lands, with no delay, and not a second time on release', () => {
    render({ haptic: 'select', hapticOn: 'in', onPress });
    const f = finger();
    f.down();
    expect(mockHaptic.mock.calls).toEqual([['select']]);
    expect(mockTiming).toHaveBeenCalledTimes(1);
    f.release(); f.wait(300);
    expect(mockHaptic).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('still hands the caller\'s onPress through untouched', () => {
    render({ haptic: 'select', hapticOn: 'in', onPress });
    expect(surface().props.onPress).toBe(onPress);
  });

  it('a caller\'s own delay is respected', () => {
    render({ haptic: 'select', unstable_pressDelay: 200 });
    const f = finger();
    f.down(); f.wait(PRESS_DELAY + 50);
    expect(mockTiming).not.toHaveBeenCalled();
    f.wait(200);
    expect(mockTiming).toHaveBeenCalledTimes(1);
  });
});

describe('scaleTo === 1 is a plain Pressable: no shared value, no animated style, no timing', () => {
  it('draws no Reanimated state at all, yet keeps the press, the haptic and the caller\'s handlers', () => {
    render({ scaleTo: 1, haptic: 'select', onPress });
    expect(mockSharedValue).not.toHaveBeenCalled();
    expect(mockAnimatedStyle).not.toHaveBeenCalled();
    const f = finger();
    f.down(); f.wait(PRESS_DELAY + 20); f.release(); f.wait(300);
    expect(mockTiming).not.toHaveBeenCalled();
    expect(mockSpring).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    // The card above it that lifts reads these two (TaskCard, ApplicationFace): they must still arrive, once each.
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockHaptic.mock.calls).toEqual([['select']]);
  });

  it('a scaling Press does draw one shared value and one animated style', () => {
    render({ scaleTo: 0.97 });
    expect(mockSharedValue).toHaveBeenCalledTimes(1);
    expect(mockAnimatedStyle).toHaveBeenCalledTimes(1);
  });

  it('is chosen at mount: the surface is never swapped for another element type, so nothing under it remounts', () => {
    let mounts = 0;
    function Probe() { useEffect(() => { mounts++; }, []); return null; }
    const withScale = (scaleTo: number) => <Root><Press accessibilityRole="button" accessibilityLabel="Nastavi" scaleTo={scaleTo}><Probe /></Press></Root>;
    act(() => { tree = create(withScale(1)); });
    act(() => { tree!.update(withScale(0.97)); });
    expect(mounts).toBe(1);
    expect(mockSharedValue).not.toHaveBeenCalled();
    act(() => { tree!.unmount(); tree = undefined; });
    jest.clearAllMocks(); mounts = 0;
    act(() => { tree = create(withScale(0.97)); });
    act(() => { tree!.update(withScale(1)); });
    expect(mounts).toBe(1);
  });

  it('holds still under reduced motion, as it always did, and still ticks', () => {
    render({ scaleTo: 1, haptic: 'select', onPress }); reduceMotion(true);
    const f = finger();
    f.down(); f.release(); f.wait(300);
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockHaptic.mock.calls).toEqual([['select']]);
  });
});

describe('usePressLift: the one give, settle and lift of a card that holds its own presses', () => {
  let lift: ReturnType<typeof usePressLift> | undefined;
  function Card({ to }: { to?: number }) { lift = to === undefined ? usePressLift() : usePressLift(to); return null; }
  const draw = (to?: number) => act(() => { tree = create(<Root><Card to={to} /></Root>); });

  it('gives to the row rung of the ladder by default and springs back; one shared value and one style', () => {
    draw();
    expect(mockSharedValue).toHaveBeenCalledTimes(1);
    expect(mockAnimatedStyle).toHaveBeenCalledTimes(1);
    act(() => { lift!.give(); });
    expect(mockTiming).toHaveBeenCalledWith(sys.motion.scale.row, expect.objectContaining({ duration: sys.motion.press }));
    act(() => { lift!.settle(); });
    expect(mockSpring).toHaveBeenCalledWith(1, expect.objectContaining(sys.motion.spring));
    expect(lift!.style).toEqual({});
  });

  it('takes another rung when asked', () => {
    draw(sys.motion.scale.button);
    act(() => { lift!.give(); });
    expect(mockTiming).toHaveBeenCalledWith(sys.motion.scale.button, expect.anything());
  });

  it('under reduced motion never gives, and puts the card back at once, even if the setting changed mid-press', () => {
    draw();
    act(() => { lift!.give(); });
    expect(mockTiming).toHaveBeenCalledTimes(1);
    reduceMotion(true); jest.clearAllMocks();
    act(() => { lift!.settle(); }); // the press that began before the setting changed ends under it
    expect(mockSet.mock.calls).toEqual([[1]]);
    expect(mockSpring).not.toHaveBeenCalled();
    act(() => { lift!.give(); });
    expect(mockTiming).not.toHaveBeenCalled();
  });
});

// Wave-1 review, minor (f): a non-scrolling Segmented ticked on touch-down but committed on release, so a finger that landed on a
// segment and turned into a page scroll ticked and changed nothing: the false tick rule R5 set out to remove. The tick follows the
// commit in every mode.
describe('Segmented: the tick follows the change, on release, in every mode', () => {
  const options = [{ key: 'a' as const, label: 'Aktivni' }, { key: 'b' as const, label: 'Istorija' }];
  const segmented = (extra: Partial<React.ComponentProps<typeof Segmented<'a' | 'b'>>> = {}) =>
    act(() => { tree = create(<Root><Segmented options={options} value="a" onChange={change} {...extra} /></Root>); });

  it.each([['a fixed control', {}], ['a rail that scrolls', { scroll: true }]])('%s: ticks once, on release, with the change, and not when the finger lands', (_name, extra) => {
    const order: string[] = [];
    mockHaptic.mockImplementation(kind => order.push(`haptic:${kind}`));
    change.mockImplementation(key => order.push(`change:${key}`));
    segmented(extra);
    const f = finger('Istorija');
    f.down();
    expect(mockHaptic).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
    f.release(); f.wait(300);
    expect(order).toEqual(['haptic:select', 'change:b']);
  });

  it.each([['a fixed control', {}], ['a rail that scrolls', { scroll: true }]])('%s: a finger that lands and is taken by a scroll ticks nothing and changes nothing', (_name, extra) => {
    segmented(extra);
    const f = finger('Istorija');
    f.down(); f.wait(20); f.cancel(); f.wait(300);
    expect(mockHaptic).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
  });

  it('ticks nothing for the segment that is already chosen: nothing changes', () => {
    segmented();
    const f = finger('Aktivni');
    f.down(); f.release(); f.wait(300);
    expect(mockHaptic).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
  });

  it('a segment that gives takes the button rung of the ladder', () => {
    segmented();
    const f = finger('Istorija');
    f.down();
    expect(mockTiming).toHaveBeenCalledWith(sys.motion.scale.button, expect.anything());
  });

  it('in a rail that scrolls, a finger that starts a drag ticks nothing and shrinks nothing; the tick waits for the tap to complete', () => {
    segmented({ scroll: true });
    const f = finger('Istorija');
    f.down(); f.wait(20); f.cancel(); f.wait(300);
    expect(mockHaptic).not.toHaveBeenCalled();
    expect(mockTiming).not.toHaveBeenCalled();
    f.down(); f.release(); f.wait(300);
    expect(mockHaptic.mock.calls).toEqual([['select']]);
    expect(change).toHaveBeenCalledWith('b');
  });
});
