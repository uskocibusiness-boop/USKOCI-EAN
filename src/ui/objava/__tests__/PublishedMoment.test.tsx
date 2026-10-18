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
import { forgetTicks } from '../../system/haptics';
import { Pecat } from '../../system/Pecat';
import { Screen } from '../../system/Screen';
import { sys } from '../../system/tokens';
import { PUBLISHED_MOMENT_MS, PublishedMoment } from '../PublishedMoment';

/**
 * "Objavljeno" (plan 2.9, owner 2026-10-07; "Papir i pečat", owner's pick of 2026-10-08): the one calm moment after a confirmed publication. It must
 * be SEEN (it holds at least 1,2 s after the stamp has landed, when left alone), it must never block the way on (a tap continues at once), the paper
 * settles and the stamp falls on it (and under reduced motion both are there at once), and a screen reader is not hurried. The route's own fences
 * (focus, account, the read-back) are tested with the route (v5-review-screen); this is the moment itself.
 */
let tree: ReactTestRenderer;
const render = async (onContinue: () => void, props: Partial<React.ComponentProps<typeof PublishedMoment>> = {}) => {
  await act(async () => { tree = create(<PublishedMoment title="Zadatak je objavljen." onContinue={onContinue} {...props} />); });
};
const advance = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string'));
const action = () => tree.root.findByProps({ accessibilityLabel: 'Otvori zadatak' });
// The success mark ticks through `system/haptics`, which holds two ticks closer than `sys.motion.tickGap` to one; each case here starts
// with no past (and the one case that mounts the moment twice says so).
beforeEach(() => { jest.useFakeTimers(); forgetTicks(); mockHaptic.mockClear(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); mockReduced = false; jest.useRealTimers(); jest.restoreAllMocks(); });

it('identifies the actual published task, confirms it once and offers one green way on', async () => {
  await render(jest.fn(), { taskTitle: 'Izrada 3D figurica' });
  // The owner, 8 Oct 2026: the grey line ("Prijave stižu ovde. Javićemo ti.") explained what the green action already is.
  expect(texts()).toEqual(['Izrada 3D figurica', 'Objavljen', 'Otvori zadatak']);
  expect(texts().join(' ')).not.toMatch(/Prijave|Javićemo|zvonc/);
  const title = tree.root.findAllByType('T' as React.ElementType)[0];
  expect(title.props).toMatchObject({ variant: 'title', accessible: false });
  expect(tree.root.findByProps({ accessibilityLabel: 'Izrada 3D figurica. Zadatak je objavljen.' }).props)
    .toMatchObject({ accessible: true, accessibilityRole: 'header', accessibilityLiveRegion: 'polite' });
  expect(tree.root.findByType(Pecat).parent?.props)
    .toMatchObject({ importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true });
  // One action, the primary one, green; nothing else to press.
  expect(tree.root.findAllByType('Press' as React.ElementType)).toHaveLength(1);
  expect(action().props.accessibilityRole).toBe('button');
});

it.each([undefined, null, '', '   '])('missing task title %s leaves one confirmation without a fabricated name', async taskTitle => {
  await render(jest.fn(), { taskTitle });
  expect(texts()).toEqual(['Objavljen', 'Otvori zadatak']);
  expect(tree.root.findByProps({ accessibilityLabel: 'Zadatak je objavljen.' }).props.accessibilityRole).toBe('header');
});

it('allows a long real title to wrap and the content to scroll within the existing safe area', async () => {
  const taskTitle = '  Izrada i slanje personalizovanih 3D figurica prema dostavljenom modelu za proslavu u Novom Sadu  ';
  await render(jest.fn(), { taskTitle });
  const title = tree.root.findAllByType('T' as React.ElementType)[0];
  expect(title.children).toEqual([taskTitle.trim()]);
  expect(title.props.numberOfLines).toBeUndefined();
  expect(tree.root.findByType(Screen).props.kind).toBe('detail');
  expect(tree.root.findByType(Screen).props.scroll).not.toBe(false);
  expect(tree.root.findByType('SafeAreaView' as React.ElementType).props.edges).toContain('bottom');
});

it('is seen for at least 1,2 s after the stamp has landed, and then continues by itself, once', async () => {
  expect(PUBLISHED_MOMENT_MS).toBeGreaterThanOrEqual(sys.motion.arrive.duration + 140 + 1200);
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
  await act(async () => { tree.update(<PublishedMoment title="Zadatak je objavljen." onContinue={fresh} />); });
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

it('lays the paper with the pin and the pencil down and drops the stamp "Objavljen" on it, and under reduced motion shows both at once', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  await render(jest.fn());
  // The picture of a task laid on the table (144), not a mark with a tick in it: the paper settles once, as the picture of an empty state does.
  const picture = (kind: string) => tree.root.findAll(node => node.props.kind === kind && typeof node.props.size === 'number');
  expect(picture('publish').length).toBeGreaterThan(0); expect(new Set(picture('publish').map(node => node.props.size))).toEqual(new Set([144]));
  expect(picture('check')).toHaveLength(0);
  // The stamp is the state pill of the one state system, green, and it falls as the paper has settled (it is the stamp's own tick that is felt).
  expect(tree.root.findByType(Pecat).props).toMatchObject({ label: 'Objavljen', tone: 'green', play: true, delay: sys.motion.arrive.duration });
  expect(timing).toHaveBeenCalled();
  await act(async () => tree.unmount());
  timing.mockClear(); mockReduced = true;
  const onContinue = jest.fn();
  await render(onContinue);
  expect(picture('publish').length).toBeGreaterThan(0);
  expect(timing).not.toHaveBeenCalled();
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
  await render(jest.fn(), { title: 'Izmene su objavljene.', taskTitle: 'Izrada 3D figurica' });
  expect(texts()).toEqual(['Izrada 3D figurica', 'Izmene objavljene', 'Otvori zadatak']);
  expect(tree.root.findByProps({ accessibilityLabel: 'Izrada 3D figurica. Izmene su objavljene.' })).toBeTruthy();
});
