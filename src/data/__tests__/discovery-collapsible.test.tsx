import React, { useEffect } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Collapsible, MEASURE_GIVE_UP_MS } from '../../ui/v2/discovery/Collapsible';
import { sys } from '../../ui/system/tokens';

/**
 * The body of an open section (owner, 2026-10-07: sections open and close smoothly). The motion is the height of a clipping
 * frame while it moves, on the short timings of the system; once it has arrived the body is in normal flow, so its height is
 * always its own and nothing it later gains (a sixth week of a calendar) can be cut. The body is never mounted again.
 */
type Run = { value: Animated.Value; config: Record<string, unknown>; callback?: (result: { finished: boolean }) => void; stopped?: boolean };
let runs: Run[] = [];
let tree: ReactTestRenderer;
let mounted = 0;
function Probe() { useEffect(() => { mounted++; return () => { mounted--; }; }, []); return <View testID="probe" />; }
const settled = jest.fn();
const hold = () => {
  runs = [];
  jest.spyOn(Animated, 'timing').mockImplementation(((value: Animated.Value, config: Record<string, unknown>) => {
    const run: Run = { value, config };
    return { start: (callback?: Run['callback']) => { run.callback = callback; runs.push(run); }, stop: () => { run.stopped = true; }, reset: () => undefined };
  }) as never);
};
const finish = async () => act(async () => {
  for (const run of runs.filter(entry => entry.callback && !entry.stopped)) {
    run.value.setValue(Number(run.config.toValue)); const callback = run.callback!; run.callback = undefined; callback({ finished: true });
  }
});
const draw = (open: boolean, reduced = false) => <Collapsible open={open} reduced={reduced} testID="body" onSettled={settled}><Probe /></Collapsible>;
const render = async (open: boolean, reduced = false) => act(async () => { tree = create(draw(open, reduced)); });
const update = async (open: boolean, reduced = false) => act(async () => tree.update(draw(open, reduced)));
/** The animated frame itself: the component that draws it carries the same test id. */
const frames = () => tree.root.findAll(node => node.type !== Collapsible && node.props.testID === 'body');
const frame = () => frames()[0];
const natural = () => tree.root.findAll(node => node.props.testID === 'body-natural')[0];
const measure = async (height: number) => act(async () => natural().props.onLayout({ nativeEvent: { layout: { height } } }));
const heightOf = (run: Run) => (run.value as unknown as { __getValue(): number }).__getValue();

beforeEach(() => { mounted = 0; settled.mockReset(); hold(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

test('a body that starts open is in normal flow, with no frame and no motion, and says so once', async () => {
  await render(true);
  expect(frame().props.style).toBeUndefined(); expect(natural().props.style).toBeUndefined();
  expect(tree.root.findAllByProps({ testID: 'probe' }).length).toBeGreaterThan(0);
  expect(runs).toHaveLength(0); expect(settled).toHaveBeenCalledTimes(1); expect(settled).toHaveBeenCalledWith(true);
});

test('a body that starts closed draws nothing, and says so once', async () => {
  await render(false);
  expect(frames()).toHaveLength(0);
  expect(settled).toHaveBeenCalledTimes(1); expect(settled).toHaveBeenCalledWith(false);
});

test('under reduced motion it is there at once and gone at once, with nothing asked of the driver', async () => {
  await render(false, true);
  await update(true, true);
  expect(frame().props.style).toBeUndefined(); expect(mounted).toBe(1);
  await update(false, true);
  expect(frames()).toHaveLength(0); expect(mounted).toBe(0);
  expect(runs).toHaveLength(0);
  expect(settled.mock.calls.map(call => call[0])).toEqual([false, true, false]);
});

test('opening mounts the body at once inside a clipping frame, is measured where it stands naturally, and grows to that over the entering timing', async () => {
  await render(false); await update(true);
  expect(mounted).toBe(1);
  expect(StyleSheet.flatten(frame().props.style)).toMatchObject({ overflow: 'hidden' });
  expect(StyleSheet.flatten(natural().props.style)).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0 });
  // Nothing moves until the body is measured: the frame is closed.
  expect(runs).toHaveLength(0);
  await measure(180);
  expect(runs).toHaveLength(1);
  expect(runs[0].config).toMatchObject({ toValue: 180, duration: sys.motion.enter, useNativeDriver: false });
  // It has not arrived yet: only the state it started in has been reported.
  expect(settled.mock.calls.map(call => call[0])).toEqual([false]);
  await finish();
  // It has arrived: normal flow again, the same body (never mounted again), told once.
  expect(frame().props.style).toBeUndefined(); expect(natural().props.style).toBeUndefined();
  expect(mounted).toBe(1);
  expect(settled.mock.calls.map(call => call[0])).toEqual([false, true]);
});

test('closing leaves the body mounted while the frame shrinks from its natural height over the leaving timing, then removes it', async () => {
  await render(true); await measure(240);
  await update(false);
  expect(mounted).toBe(1);
  expect(StyleSheet.flatten(frame().props.style)).toMatchObject({ overflow: 'hidden' });
  expect(runs).toHaveLength(1);
  expect(runs[0].config).toMatchObject({ toValue: 0, duration: sys.motion.exit, useNativeDriver: false });
  // The frame starts exactly as tall as the body was: nothing jumps when the move begins.
  expect(heightOf(runs[0])).toBe(240);
  expect(sys.motion.exit).toBeLessThan(sys.motion.enter);
  await finish();
  expect(frames()).toHaveLength(0); expect(mounted).toBe(0);
  expect(settled.mock.calls.map(call => call[0])).toEqual([true, false]);
});

test('the body keeps what it holds from the first measurement to the last: it is one tree in every phase', async () => {
  await render(false); await update(true); await measure(100); await finish();
  expect(mounted).toBe(1);
  await update(false); expect(mounted).toBe(1);
  await update(true); expect(mounted).toBe(1); // asked again before it left: the same body
  await finish(); expect(mounted).toBe(1);
});

test('a body that comes back is a new body: what was measured before is not trusted', async () => {
  await render(true); await measure(300); await update(false); await finish();
  expect(frames()).toHaveLength(0);
  runs = [];
  await update(true);
  // The old height (300) is not used: nothing moves until the new body is measured.
  expect(runs).toHaveLength(0);
  await measure(120);
  expect(runs[0].config.toValue).toBe(120);
});

test('a measurement that never comes does not leave the section empty: the body simply appears', async () => {
  jest.useFakeTimers();
  await render(false); await update(true);
  expect(StyleSheet.flatten(frame().props.style)).toMatchObject({ overflow: 'hidden' });
  await act(async () => { jest.advanceTimersByTime(MEASURE_GIVE_UP_MS + 1); });
  expect(frame().props.style).toBeUndefined(); expect(mounted).toBe(1); expect(settled).toHaveBeenLastCalledWith(true);
});

test('what it gains after it has opened (a longer calendar) is not cut: in normal flow its height is its own', async () => {
  await render(true); await measure(240);
  await measure(290);
  expect(frame().props.style).toBeUndefined(); expect(natural().props.style).toBeUndefined(); expect(runs).toHaveLength(0);
});

test('the frame reports its place to a caller that places things by it', async () => {
  const onLayout = jest.fn();
  await act(async () => { tree = create(<Collapsible open reduced={false} testID="body" onLayout={onLayout}><Probe /></Collapsible>); });
  await act(async () => frame().props.onLayout({ nativeEvent: { layout: { y: 64, height: 200 } } }));
  expect(onLayout).toHaveBeenCalledTimes(1);
});
