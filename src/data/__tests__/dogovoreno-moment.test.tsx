import React from 'react';
import { Animated } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
const mockTick = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  const Modal = ({ visible, children, ...props }: any) => visible ? require('react').createElement('Modal', props, children) : null;
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return Modal;
    return ['View', 'ScrollView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar', FaceEdge: 'FaceEdge', FACE_EDGE: 2 }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/system/haptics', () => ({ tick: (...args: unknown[]) => mockTick(...args) }));
import { DogovorenoMoment } from '../../ui/v2/DogovorenoMoment';
import { sys } from '../../ui/system/tokens';

/**
 * "Dogovoreno!" (owner's pick of 2026-10-08, "Susret dva lica", C, with his addition: the task's title under the faces). Two faces come toward each other and
 * stop overlapped (240 ms, decelerating, no bounce), the tick of an outcome plays when they touch, then the title and the word, three rows one by one and the
 * one green way on. Only `transform` and `opacity` move, on the native driver. Reopened on an outcome that already stood, and under reduced motion, it is the
 * last frame at once (the tick stays under reduced motion, and does not play for an outcome that was already there).
 */
let tree: ReactTestRenderer;
const element = (patch: Partial<React.ComponentProps<typeof DogovorenoMoment>> = {}) => <DogovorenoMoment fresh youFace={<React.Fragment />} themFace={<React.Fragment />}
  people="Ti i Milan Petrović" taskTitle="Unos ormara na treći sprat" term="26. sep · 10:00–12:00 (po vremenu u Srbiji)" amount="4.500 RSD ukupno"
  action={React.createElement('Green' as unknown as React.ElementType)} onBack={jest.fn()} {...patch} />;
const text = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
type Timing = { toValue: number; duration: number; delay?: number; useNativeDriver: boolean };
let timing: jest.SpyInstance;
beforeEach(() => { jest.useFakeTimers(); timing = jest.spyOn(Animated, 'timing'); mockTick.mockClear(); });
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); mockReduced = false; });
const advance = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
const runs = () => timing.mock.calls.map(call => call[1] as Timing);

it('stands on one white screen, in this order: the two faces, the task\'s title, the word, the two of you, the term, the amount, and the one way on', async () => {
  await act(async () => { tree = create(element()); });
  expect(text()).toBe('Unos ormara na treći sprat | Dogovoreno! | Ti i Milan Petrović | 26. sep · 10:00–12:00 (po vremenu u Srbiji) | 4.500 RSD ukupno');
  expect(tree.root.findAll(node => node.type === ('FactArt' as React.ElementType)).map(node => `${node.props.kind}:${node.props.size}`)).toEqual(['users:28', 'calendar:28', 'offers:28']);
  expect(tree.root.findAllByType('FaceEdge' as unknown as React.ElementType)).toHaveLength(2);
  expect(tree.root.findAllByType('Green' as unknown as React.ElementType)).toHaveLength(1);
  // The pair is one stop for a screen reader, the faces inside it are decoration, and the word is announced when it has just happened.
  const pair = tree.root.findAll(node => node.props.accessibilityLabel === 'Ti i Milan Petrović' && node.props.accessible === true && node.findAllByType('FaceEdge' as unknown as React.ElementType).length === 2);
  expect(pair).toHaveLength(1);
  expect(pair[0].findAll(node => node.props.importantForAccessibility === 'no-hide-descendants' && node.props.accessibilityElementsHidden === true).length).toBeGreaterThanOrEqual(2);
  expect(tree.root.findAll(node => node.props.children === 'Dogovoreno!')[0].props).toMatchObject({ variant: 'display', accessibilityRole: 'alert', accessibilityLiveRegion: 'polite' });
  expect(tree.root.findByType('Modal' as unknown as React.ElementType).props.statusBarTranslucent).toBe(true);
});

it('is a modal whose Android Back is the screen\'s Back', async () => {
  const onBack = jest.fn();
  await act(async () => { tree = create(element({ onBack })); });
  await act(async () => tree.root.findByType('Modal' as unknown as React.ElementType).props.onRequestClose());
  expect(onBack).toHaveBeenCalledTimes(1);
});

it('brings the faces together in 240 ms, then the words, then three rows 40 ms apart, then the action, all decelerating, on the native driver', async () => {
  await act(async () => { tree = create(element()); });
  const all = runs();
  const meet = sys.motion.enter, words = meet + sys.motion.press, rows = words + sys.motion.enter / 2, action = rows + 3 * sys.motion.stagger + sys.motion.enter / 2;
  expect(all.every(run => run.useNativeDriver && run.toValue === 1)).toBe(true);
  expect(all.map(run => [run.duration, run.delay ?? 0])).toEqual([
    [meet, 0],                                                    // the faces
    [sys.motion.enter, words],                                    // the title and the word
    [sys.motion.enter, rows], [sys.motion.enter, rows + sys.motion.stagger], [sys.motion.enter, rows + 2 * sys.motion.stagger],   // the rows
    [sys.motion.enter, action],                                   // the way on
  ]);
});

it('ticks once, when the faces touch, and not before', async () => {
  await act(async () => { tree = create(element()); });
  await advance(sys.motion.enter - 1); expect(mockTick).not.toHaveBeenCalled();
  await advance(1); expect(mockTick.mock.calls).toEqual([['success']]);
  await advance(5000); expect(mockTick).toHaveBeenCalledTimes(1);
});

it('is the last frame at once under reduced motion, and keeps its tick (a tick is an outcome, not movement)', async () => {
  mockReduced = true;
  await act(async () => { tree = create(element()); });
  expect(timing).not.toHaveBeenCalled();
  await advance(0); expect(mockTick.mock.calls).toEqual([['success']]);
});

it('is the last frame, with no tick, for an outcome that already stood when the screen opened, and is then the screen\'s heading', async () => {
  await act(async () => { tree = create(element({ fresh: false })); });
  expect(timing).not.toHaveBeenCalled();
  await advance(5000); expect(mockTick).not.toHaveBeenCalled();
  expect(tree.root.findAll(node => node.props.children === 'Dogovoreno!')[0].props.accessibilityRole).toBe('header');
  expect(text()).toContain('Dogovoreno!');
});

it('stops its tick with the screen: nothing plays after it is gone', async () => {
  await act(async () => { tree = create(element()); });
  await act(async () => tree.unmount());
  await advance(5000); expect(mockTick).not.toHaveBeenCalled();
});
