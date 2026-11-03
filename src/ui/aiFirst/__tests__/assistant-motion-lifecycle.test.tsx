import React, { StrictMode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

type Completion = (result: { finished: boolean }) => void;
type Run = { kind: string; start: jest.Mock; stop: jest.Mock; complete?: Completion; config?: Record<string, unknown> };
const mockRuns: Run[] = [], mockValues: { stopAnimation: jest.Mock; setValue: jest.Mock }[] = [];
const mockListeners = new Set<(state: string) => void>();
let mockReduced = false, mockState = 'active';
const mockRun = (kind: string, config?: Record<string, unknown>): Run => {
  const run: Run = { kind, config, start: jest.fn((done?: Completion) => { run.complete = done; }),
    stop: jest.fn(() => run.complete?.({ finished: false })) };
  mockRuns.push(run); return run;
};
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const animation = {
    View: 'AnimatedView',
    Value: class {
      stopAnimation = jest.fn(); setValue = jest.fn();
      interpolate = jest.fn(() => ({}));
      constructor(_value: number) { mockValues.push(this); }
    },
    add: jest.fn(() => ({})),
    timing: (_value: unknown, config: Record<string, unknown>) => mockRun('timing', config),
    sequence: () => mockRun('sequence'), loop: () => mockRun('loop'),
  };
  return new Proxy(actual, { get(target, key) {
    if (key === 'View') return 'View';
    if (key === 'Animated') return animation;
    if (key === 'AppState') return { get currentState() { return mockState; },
      addEventListener: (_event: string, listener: (state: string) => void) => {
        mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) };
      } };
    return Reflect.get(target, key);
  } });
});
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => mockReduced }));
import { AiAssistantArt, AiAssistantWelcome, type AiAssistantArtProps } from '../AiAssistantArt';

let tree: ReactTestRenderer | undefined;
const render = async (props: AiAssistantArtProps, strict = false) => {
  await act(async () => { tree = create(strict ? <StrictMode><AiAssistantArt {...props} /></StrictMode> : <AiAssistantArt {...props} />); });
};
const state = (value: string) => { mockState = value; for (const listener of [...mockListeners]) listener(value); };
const blink = () => { act(() => jest.advanceTimersByTime(5000)); return mockRuns.filter(run => run.kind === 'sequence').at(-1)!; };
const loops = () => mockRuns.filter(run => run.kind === 'loop');
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] }); mockReduced = false; mockState = 'active';
  mockRuns.length = 0; mockValues.length = 0; mockListeners.clear();
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
});
afterEach(async () => {
  if (tree) await act(async () => { tree!.unmount(); });
  tree = undefined; jest.restoreAllMocks(); jest.useRealTimers();
});

test.each([{ size: 24 }, { size: 44 }, { size: 128, animated: false }] as const)(
  'static marker %j has no animation values, timers or lifecycle listeners', async props => {
    await render(props);
    expect(mockValues).toHaveLength(0); expect(mockRuns).toHaveLength(0);
    expect(mockListeners.size).toBe(0); expect(jest.getTimerCount()).toBe(0);
    const image = tree!.root.findByType('Image' as never);
    expect(image.props).toMatchObject({ contentFit: 'contain', transition: 0, accessible: false,
      style: { width: props.size, height: props.size } });
  });

test('hero uses only non-interaction native timings, including its eye animation', async () => {
  await render({ size: 88 }); blink();
  expect(mockValues).toHaveLength(3); expect(loops()).toHaveLength(1);
  const timings = mockRuns.filter(run => run.kind === 'timing');
  expect(timings).toHaveLength(4);
  for (const run of timings) expect(run.config).toMatchObject({ useNativeDriver: true, isInteraction: false });
});

test('unmount stops in-flight eyes and breathing; retained completion cannot schedule work', async () => {
  await render({ size: 88 }); const eye = blink(), late = eye.complete;
  await act(async () => { tree!.unmount(); }); tree = undefined;
  expect(eye.stop).toHaveBeenCalledTimes(1); expect(loops()[0].stop).toHaveBeenCalledTimes(1);
  expect(mockValues.every(value => value.stopAnimation.mock.calls.length > 0)).toBe(true);
  expect(mockListeners.size).toBe(0); expect(jest.getTimerCount()).toBe(0);
  act(() => late?.({ finished: true })); expect(jest.getTimerCount()).toBe(0);
});

test('background stops immediately; old completion cannot interfere with a new foreground run', async () => {
  await render({ size: 88 }); const eye = blink(), late = eye.complete;
  // Verify inside the native event, before React can flush another render/effect.
  act(() => { state('background'); expect(eye.stop).toHaveBeenCalledTimes(1); });
  expect(jest.getTimerCount()).toBe(0);
  act(() => state('active'));
  expect(loops()).toHaveLength(2); expect(jest.getTimerCount()).toBe(1);
  act(() => late?.({ finished: true })); expect(jest.getTimerCount()).toBe(1);
  act(() => state('active')); expect(loops()).toHaveLength(2);
});

test('reduced motion stops current eye motion and removes scheduling', async () => {
  await render({ size: 88 }); const eye = blink();
  mockReduced = true;
  // A changed size forces this memoized component to read the changed hook stub.
  await act(async () => { tree!.update(<AiAssistantArt size={128} />); });
  expect(eye.stop).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
  expect(mockListeners.size).toBe(0); expect(mockValues).toHaveLength(3);
  for (const value of mockValues) expect(value.setValue).toHaveBeenLastCalledWith(0);
});

test('initial background does not start a decorative loop', async () => {
  mockState = 'background'; await render({ size: 88 });
  expect(loops()).toHaveLength(0); expect(jest.getTimerCount()).toBe(0);
  act(() => state('active')); expect(loops()).toHaveLength(1);
});

test('an interrupted native eye animation does not restart itself', async () => {
  await render({ size: 88 }); const eye = blink();
  act(() => eye.complete?.({ finished: false }));
  expect(jest.getTimerCount()).toBe(0);
});

test('StrictMode leaves one live loop/listener/timer; explicit static mode releases them', async () => {
  await render({ size: 88 }, true);
  expect(loops().filter(run => run.start.mock.calls.length && !run.stop.mock.calls.length)).toHaveLength(1);
  expect(mockListeners.size).toBe(1); expect(jest.getTimerCount()).toBe(1);
  await act(async () => { tree!.update(<StrictMode><AiAssistantArt size={88} animated={false} /></StrictMode>); });
  expect(mockListeners.size).toBe(0); expect(jest.getTimerCount()).toBe(0);
  expect(loops().every(run => run.stop.mock.calls.length > 0)).toBe(true);
});

test('welcome opacity still arrives once per conversation and never replays after keyboard hiding', async () => {
  mockReduced = true; // Isolate entrance ownership from decorative hero loops.
  const memory = { current: { key: undefined as string | undefined, consumed: false } };
  await act(async () => { tree = create(<AiAssistantWelcome conversationKey="a" memory={memory} />); });
  expect(memory.current).toEqual({ key: 'a', consumed: true });
  await act(async () => { tree!.unmount(); });
  mockReduced = false;
  await act(async () => { tree = create(<AiAssistantWelcome conversationKey="a" memory={memory} />); });
  // An entrance would time to 1 over sys.motion.enter (240 ms). Breathing is 2400 ms.
  expect(mockRuns.filter(run => run.kind === 'timing' && run.config?.duration === 240)).toHaveLength(0);
});


test('initial reduced motion stays static without timers or AppState listeners', async () => {
  mockReduced = true; await render({ size: 88 });
  expect(loops()).toHaveLength(0); expect(jest.getTimerCount()).toBe(0); expect(mockListeners.size).toBe(0);
});
