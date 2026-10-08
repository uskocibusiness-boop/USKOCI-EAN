import React from 'react';
import { Animated, Easing, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Arrive, useBreath } from '../Arrive';
import { sys } from '../tokens';

/**
 * The two motions this file owns, each of them a token (motion pass, M-07b; rules R4 and R6 of `sys.motion`): the picture of an
 * empty state settling in once (`sys.motion.arrive`) and the breath of a skeleton (`sys.motion.loop.breath`). Until this item
 * they spelled 800 and 700 themselves, so a change of the token would have moved nothing. Reduced motion (R7) starts neither.
 */
let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));

let tree: ReactTestRenderer | undefined;
afterEach(() => { act(() => { tree?.unmount(); tree = undefined; }); mockReduced = false; jest.restoreAllMocks(); });

type TimingConfig = { toValue: number; duration: number; delay?: number; easing: (t: number) => number; useNativeDriver: boolean };
const configs = (timing: jest.SpyInstance) => timing.mock.calls.map(([, config]) => config as TimingConfig);

function Breather() {
  const opacity = useBreath();
  return <Animated.View style={{ opacity }} />;
}

describe('Arrive: the picture of an empty state settles in once', () => {
  it('takes sys.motion.arrive: its duration and its curve, on the native driver, after the delay it was given', () => {
    const timing = jest.spyOn(Animated, 'timing');
    act(() => { tree = create(<Arrive delay={120}><View /></Arrive>); });
    expect(timing).toHaveBeenCalledTimes(1);
    const [config] = configs(timing);
    expect(config).toMatchObject({ toValue: 1, duration: sys.motion.arrive.duration, delay: 120, useNativeDriver: true });
    const curve = Easing.bezier(...sys.motion.arrive.easing);
    for (const t of [0, 0.1, 0.3, 0.6, 0.9, 1]) expect(config.easing(t)).toBeCloseTo(curve(t), 6);
  });

  it('is long on purpose: a moment, never something a finger waits on (R6)', () => {
    expect(sys.motion.arrive.duration).toBeGreaterThan(sys.motion.enter);
  });

  // "Bez odskoka" (the owner's choice, 2026-10-08): the picture only settles. It used to rise 3 dp over its place and tilt 1° past straight before it came back.
  it('only settles: every value goes one way, from where it starts to where it stays, and none goes past it', () => {
    const interpolate = jest.spyOn(Animated.Value.prototype, 'interpolate');
    act(() => { tree = create(<Arrive><View /></Arrive>); });
    const ranges = interpolate.mock.calls.map(([config]) => config as { inputRange: number[]; outputRange: (number | string)[] });
    expect(ranges).toHaveLength(3);
    const [rise, tilt, opacity] = ranges;
    expect(rise).toEqual({ inputRange: [0, 1], outputRange: [4, 0] });
    expect(tilt).toEqual({ inputRange: [0, 1], outputRange: ['-3deg', '0deg'] });
    expect(opacity.outputRange.every(value => (value as number) >= 0.65 && (value as number) <= 1)).toBe(true);
    for (const { outputRange } of ranges) {
      const values = outputRange.map(value => parseFloat(String(value))), resting = values[values.length - 1];
      // Each step is no farther from where the picture stays than the one before it: it never overshoots and never turns back.
      for (let at = 1; at < values.length; at += 1) expect(Math.abs(values[at] - resting)).toBeLessThanOrEqual(Math.abs(values[at - 1] - resting));
    }
  });

  it('follows a curve that does not overshoot either: it stays between 0 and 1 from the first moment to the last', () => {
    const curve = Easing.bezier(...sys.motion.arrive.easing);
    for (let step = 0; step <= 100; step += 1) {
      const at = curve(step / 100);
      expect(at).toBeGreaterThanOrEqual(-1e-9); expect(at).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect([curve(0), curve(1)]).toEqual([0, 1]);
  });

  it('does not move at all under reduced motion: it is simply there', () => {
    mockReduced = true;
    const timing = jest.spyOn(Animated, 'timing');
    act(() => { tree = create(<Arrive><View /></Arrive>); });
    expect(timing).not.toHaveBeenCalled();
  });

  it('under reduced motion it stands at once in its final place: no rise, no tilt, full opacity', () => {
    mockReduced = true;
    act(() => { tree = create(<Arrive><View /></Arrive>); });
    const style = (tree!.toJSON() as unknown as { props: { style: { opacity: number; transform: Record<string, number | string>[] } } }).props.style;
    expect(style.opacity).toBe(1);
    expect(style.transform).toEqual([{ translateY: 0 }, { rotate: '0deg' }]);
  });
});

describe('useBreath: a skeleton breathes, one half-turn at a time', () => {
  it('goes down and up over sys.motion.loop.breath each, on the native driver', () => {
    const timing = jest.spyOn(Animated, 'timing');
    act(() => { tree = create(<Breather />); });
    expect(configs(timing).map(({ toValue, duration, useNativeDriver }) => ({ toValue, duration, useNativeDriver })))
      .toEqual([{ toValue: 0.55, duration: sys.motion.loop.breath, useNativeDriver: true },
        { toValue: 1, duration: sys.motion.loop.breath, useNativeDriver: true }]);
  });

  it('does not breathe under reduced motion: the placeholder stands still at full opacity', () => {
    mockReduced = true;
    const timing = jest.spyOn(Animated, 'timing');
    act(() => { tree = create(<Breather />); });
    expect(timing).not.toHaveBeenCalled();
  });
});
