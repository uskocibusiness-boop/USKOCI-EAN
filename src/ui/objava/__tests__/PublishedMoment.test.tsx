import React from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
const mockHaptic = jest.fn(() => Promise.resolve());
jest.mock('../../system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('expo-haptics', () => ({ notificationAsync: () => mockHaptic(), NotificationFeedbackType: { Success: 'success' } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => ({ Check: 'Check' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
import { PUBLISHED_MOMENT_MS, PublishedMoment } from '../PublishedMoment';

/**
 * "Objavljeno" (plan 2.9, owner 2026-10-07): the one calm moment after a confirmed publication. It must be SEEN (it holds at least 1,2 s
 * when left alone), it must never block the way on (a tap continues at once), it keeps its success tick under reduced motion and drops
 * the movement, and a screen reader is not hurried. The route's own fences (focus, account, the read-back) are tested with the route
 * (v5-review-screen); this is the moment itself.
 */
let tree: ReactTestRenderer;
const render = async (onContinue: () => void, props: Partial<React.ComponentProps<typeof PublishedMoment>> = {}) => {
  await act(async () => { tree = create(<PublishedMoment title="Zadatak je objavljen." line="Prijave stižu ovde. Javićemo ti." onContinue={onContinue} {...props} />); });
};
const advance = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string'));
const action = () => tree.root.findByProps({ accessibilityLabel: 'Otvori zadatak' });
beforeEach(() => { jest.useFakeTimers(); mockHaptic.mockClear(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); mockReduced = false; jest.useRealTimers(); jest.restoreAllMocks(); });

it('says what happened and what comes next in black and grey words, with one green way on', async () => {
  await render(jest.fn());
  expect(texts()).toEqual(['Zadatak je objavljen.', 'Prijave stižu ovde. Javićemo ti.', 'Otvori zadatak']);
  const title = tree.root.findAllByType('T' as React.ElementType)[0];
  expect(title.props).toMatchObject({ variant: 'title', accessibilityRole: 'header', accessibilityLiveRegion: 'polite' });
  expect(tree.root.findAllByType('T' as React.ElementType)[1].props).toMatchObject({ variant: 'copy', tone: 'muted' });
  // One action, the primary one, green; nothing else to press.
  expect(tree.root.findAllByType('Press' as React.ElementType)).toHaveLength(1);
  expect(action().props.accessibilityRole).toBe('button');
});

it('is seen for at least 1,2 s, and then continues by itself, once', async () => {
  expect(PUBLISHED_MOMENT_MS).toBeGreaterThanOrEqual(1200);
  const onContinue = jest.fn();
  await render(onContinue);
  await advance(1199); expect(onContinue).not.toHaveBeenCalled();
  await advance(PUBLISHED_MOMENT_MS - 1199); expect(onContinue).toHaveBeenCalledTimes(1);
  await advance(PUBLISHED_MOMENT_MS * 3); expect(onContinue).toHaveBeenCalledTimes(1);
});

it('never blocks the way on: a tap continues at once, whenever it comes', async () => {
  const onContinue = jest.fn();
  await render(onContinue);
  await act(async () => action().props.onPress());
  expect(onContinue).toHaveBeenCalledTimes(1);
  // The timer is the route's to fence: a continuation that already happened is refused there, so the route asked twice is still one.
});

it('runs the newest continuation, not the one of the render that started the timer', async () => {
  const stale = jest.fn(), fresh = jest.fn();
  await render(stale);
  await act(async () => { tree.update(<PublishedMoment title="Zadatak je objavljen." line="Prijave stižu ovde. Javićemo ti." onContinue={fresh} />); });
  await advance(PUBLISHED_MOMENT_MS);
  expect(stale).not.toHaveBeenCalled(); expect(fresh).toHaveBeenCalledTimes(1);
});

it('stops its timer with the screen: nothing continues after it is gone', async () => {
  const onContinue = jest.fn();
  await render(onContinue);
  await act(async () => tree.unmount());
  await advance(PUBLISHED_MOMENT_MS * 2);
  expect(onContinue).not.toHaveBeenCalled();
});

it('settles in with the success tick, and under reduced motion keeps the tick and drops the movement', async () => {
  const spring = jest.spyOn(Animated, 'spring'), timing = jest.spyOn(Animated, 'timing');
  await render(jest.fn());
  expect(mockHaptic).toHaveBeenCalledTimes(1);
  expect(spring).toHaveBeenCalled();
  await act(async () => tree.unmount());
  spring.mockClear(); timing.mockClear(); mockHaptic.mockClear(); mockReduced = true;
  const onContinue = jest.fn();
  await render(onContinue);
  expect(mockHaptic).toHaveBeenCalledTimes(1);      // a tick is an outcome, not movement
  expect(spring).not.toHaveBeenCalled(); expect(timing).not.toHaveBeenCalled();
  // The moment is as long and as quick to leave under reduced motion: nothing about its length is motion.
  await advance(PUBLISHED_MOMENT_MS); expect(onContinue).toHaveBeenCalledTimes(1);
});

it('does not hurry a screen reader: it waits for the person to continue', async () => {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  const onContinue = jest.fn();
  await render(onContinue);
  await advance(PUBLISHED_MOMENT_MS * 5);
  expect(onContinue).not.toHaveBeenCalled();
  await act(async () => action().props.onPress());
  expect(onContinue).toHaveBeenCalledTimes(1);
});

it('a screen reader that is turned on while the moment is shown stops the timer', async () => {
  let listener: ((on: boolean) => void) | undefined;
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_event: string, handler: (on: boolean) => void) => {
    listener = handler; return { remove: () => undefined };
  }) as never);
  const onContinue = jest.fn();
  await render(onContinue);
  await advance(PUBLISHED_MOMENT_MS - 100);
  await act(async () => listener?.(true));
  await advance(PUBLISHED_MOMENT_MS * 3);
  expect(onContinue).not.toHaveBeenCalled();
});

it('says "Izmene su objavljene." for a changed task when it is handed those words', async () => {
  await render(jest.fn(), { title: 'Izmene su objavljene.', line: 'Prijave stižu ovde.' });
  expect(texts()).toEqual(['Izmene su objavljene.', 'Prijave stižu ovde.', 'Otvori zadatak']);
});
